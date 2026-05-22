# Cloud-Lab Manager

Безопасный веб-сервис (шлюз оркестрации) для управления облачными лабораторными стендами на платформе **«Кибер Инфраструктура»** (далее КИ, поверх OpenStack API). Сервис распределяет заранее подготовленный пул проектов между студентами по запросу из LMS Moodle или вручную, контролирует утилизацию кластера, автоматически разворачивает виртуальные машины, выполняет безагентные SSH-проверки конфигураций и возвращает проекты в пул после завершения работ.

Проект разработан в рамках кейса хакатона «Автоматизация работы с лабораторными стендами». Все 5 этапов ТЗ реализованы; ниже архитектура расписана поэтапно.

## Технологический стек

* **Backend**: Python 3.12, FastAPI, SQLAlchemy 2 (async + sync), Pydantic v2, Celery 5, Tenacity, structlog
* **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5, TanStack Query 5, Tailwind CSS 4, Sonner
* **База данных**: PostgreSQL 16
* **Очереди и state-store**: Redis 7 (Celery broker, Celery result backend, credentials store, LTI launch state)
* **Cloud API**: OpenStack SDK (openstacksdk 4.x), keystoneauth1
* **SSH-движок**: asyncssh, PyYAML
* **LTI 1.3**: PyJWT[crypto], httpx (JWKS fetch), cryptography
* **Web-консоль ВМ**: Apache Guacamole guacd 1.5 (SSH / VNC / RDP по WebSocket)
* **Аутентификация**: JWT (HS256), Argon2-cffi (хеш паролей), CSRF-токены, HttpOnly cookies
* **Контейнеризация**: Docker, docker-compose, Nginx 1.27 (reverse proxy + WebSocket)
* **DevSecOps**: Ruff, Bandit, Gitleaks, pip-audit, Trivy, pre-commit, GitHub Actions

## Этапы ТЗ и реализация

### Этап 1. Ядро, пул проектов и контроль ёмкости

Принцип «один студент = один индивидуальный проект» вынесен на уровень БД: частичный уникальный индекс `uq_stands_owner_active` не даст создать второй активный стенд тому же владельцу.

**Пул проектов.** `PoolManager.allocate()` в `backend/app/services/pool_manager.py` атомарно берёт свободный проект через `SELECT … FOR UPDATE SKIP LOCKED`, проверяет отсутствие активного стенда и возвращает `PoolProject`. После destroy стенд возвращает проект в `FREE`. Пул наполняется через `config/pool.yaml` (валидатор `scripts/validate-pool.py`), bulk-API `POST /api/v1/pool/projects/bulk` либо авто-обнаружение `GET /api/v1/pool/discover`, которое читает домены и проекты из КИ через Keystone admin API. На пустой пул сервис отвечает `PoolExhaustedError 409`, на дубликат - `AlreadyAllocatedError 409`.

**КИ как провайдер.** `OpenStackProvider` в `backend/app/providers/openstack.py` реализует абстрактный `CloudProvider` поверх `openstacksdk`. Для администрирования открывается отдельный системный коннект, для развёртывания ВМ - индивидуальный per-project. Старый Keystone КИ требует legacy TLS adapter (отключение `SECLEVEL`, ручной `requests.Session`), это решено внутри провайдера. Все вызовы обёрнуты в `tenacity.retry` с экспоненциальным backoff, перед длинными цепочками вызовов выполняется прогрев авторизации.

**Безопасный доступ.** Никаких статических паролей: `Stand.provision` (Celery-задача в `backend/app/tasks/stands.py`) запрашивает keypair у Nova внутри проекта через `provider.create_keypair()`, кладёт приватный ключ в Redis с TTL `credentials_ttl_seconds` и удаляет keypair при destroy. Публичный ключ inspector'а инжектится в ВМ через cloud-init (`backend/app/core/cloud_init.py`), причём sudo для пользователя `inspector` ограничен whitelist'ом команд под проверки.

**Capacity guard.** `CapacityChecker` в `backend/app/services/capacity_checker.py`:

* первым делом тянет утилизацию через `nova /os-hypervisors/statistics`; если права закрыты (типичная история в КИ), деградирует на `os-quota-sets` системного проекта плюс Cinder usage;
* считает `current_max_percent = max(vcpus%, ram%, disk%)`, а зная `flavor_id` запрашиваемой ВМ - **предиктивный** `projected_max_percent = max((used + req) / total ...)`;
* если `projected ≥ threshold`, бросает `CapacityExceededError 503` с детальным телом для UI;
* кеширует снимок на `capacity_cache_ttl_seconds`, но в «горячей зоне» (когда текущая утилизация подобралась к порогу ближе чем на 10 п. п.) принудительно перестраивает кеш, чтобы не выдать allow на устаревших данных.

Любой отказ пишется в таблицу `capacity_rejections` через `CapacityAuditRecorder` (кто, когда, какой flavor, что было с кластером в момент отказа). Админ читает историю на `GET /api/v1/admin/audit/capacity-rejections`. На фронте `features/capacity/CapacityCard` показывает живую utilization-карту в `/admin`. Stand-сервис также страхуется от зависания: `provision_stall_seconds` для проваленного провижена и авто-перевод в `FAILED` через sweep-таску.

### Этап 2. Асинхронный жизненный цикл и тайм-ауты

Все долгие операции (provision, destroy, sweep, проверка) отделены от HTTP-запросов и крутятся в Celery. Брокер и result-backend - Redis. В `backend/app/celery_app.py` выставлены `task_acks_late=True`, `worker_prefetch_multiplier=1` (равномерное распределение нагрузки) и авто-ретраи `provision` на `CloudProviderError / ConnectionError / TimeoutError` с экспоненциальным backoff до 3 попыток, у `destroy` - до 5.

В `backend/app/tasks/stands.py` живут три задачи: `stands.provision` идёт по цепочке «keypair → create_server → attach_floating_ip → READY» и идемпотентен по `ki_server_id` + `ki_keypair_name`, чтобы повторный запуск после краша не дублировал ресурсы; `stands.destroy` удаляет ВМ и keypair, возвращает проект в `FREE` и стирает credentials из Redis; `stands.sweep_expired` бьёт по двум целям сразу - истёкшие стенды (`expires_at < now`) переводит на destroy, а зависшие в `ALLOCATING`/`DEPLOYING` дольше `provision_stall_seconds` помечает `FAILED`. Запускается по Celery-beat каждые `sweep_interval_seconds`.

**Машина состояний** живёт в `backend/app/core/state_machine.py`. Допустимые переходы:

`ALLOCATING → DEPLOYING → READY → FROZEN ⇄ READY → CLEANING → DESTROYED`, плюс переход в `FAILED` из любого активного состояния. На каждом шаге `assert_transition()` сверяется с whitelist'ом и при попытке невалидного перехода бросает `InvalidTransitionError 409`. Каждый переход журналируется в structlog с прежним и новым статусом.

**Гибкое управление временем жизни** реализовано в `LifecycleService`:

* `freeze(stand_id, reason)` переводит `READY → FROZEN`, продлевает `expires_at` на `freeze_ttl` и обновляет TTL у credentials в Redis;
* `report_incident(stand_id, description, reported_by)` делает то же самое, но дописывает в `extra` стенда флаг `incident_reported`, метку времени и описание - именно по этому флагу UI студента подсвечивает стенд красным значком, а в админке появляется отдельная вкладка «Инциденты»;
* `unfreeze` и `extend` - обратные операции с произвольным TTL.

**Hot-reload лимитов.** Три глобальных параметра (`stand_default_ttl_seconds`, `stand_freeze_ttl_seconds`, `capacity_threshold_percent`) хранятся в таблице `runtime_settings`, читаются через `LifecycleSettings` с кешем на 5 секунд и пишутся через `PATCH /api/v1/admin/lifecycle-settings`. Каждое изменение порождает запись в `lifecycle_setting_changes` (кто, когда, со старого значения на новое). Эти изменения мгновенно влияют на новых стендов без рестарта - sweep-таска, provision-таска и capacity-checker читают актуальные значения при каждом запуске. Преподавателю всё это доступно из UI на странице `/admin/settings` (форма + панель истории).

### Этап 3. Безагентный движок SSH-проверок

Безагентное подключение к ВМ ученика делается из контейнера worker'а: `asyncssh` стучится по ed25519-ключу `secrets/inspector_ed25519`. Сам ключ генерируется один раз в `entrypoint.sh`, его публичная часть инжектится в каждую новую ВМ через cloud-init под пользователя `inspector` с урезанным sudo. Никаких паролей и общих ключей.

Тестовый движок построен вокруг 13 типов проверок (`CheckKind` в `backend/app/inspector/types.py`):

`package_installed`, `systemd_active`, `port_listening`, `file_exists`, `file_contains`, `command_exit_zero`, `command_output_matches`, `os_release`, `user_exists`, `process_running`, `http_endpoint`, `dns_resolves`, `command_output_compare`.

У каждой проверки два дополнительных поля: `section` (`os` / `software` / `network` / `other`) для группировки в UI и `severity` (`critical` / `warning` / `info`). Только провал critical-проверки роняет общий результат - warning'и видны, но не валят весь чек-ран. Это нужно, чтобы курс мог иметь, например, обязательный `port_listening: 80` и рекомендованный `file_contains: gzip on`.

YAML-шаблоны лежат в `config/check_templates/`. Сейчас их четыре: `lab-01.yaml` (базовая ОС), `lab-02-nginx.yaml` (nginx как reverse proxy на 127.0.0.1:8080 + gzip), `lab-03-postgres.yaml` (PostgreSQL и конфигурация), `lab-04-network.yaml` (сетевые проверки). При загрузке шаблона `inspector/loader.py` валидирует каждую запись через отдельную Pydantic-модель и кидает `TemplateError 422` с указанием индекса шага и поля, где ошибка - преподаватель сразу видит, что именно неправильно в его YAML.

Сам прогон устроен так: `InspectorService.schedule` создаёт `CheckRun` в БД и кидает Celery-таску `inspector.run`. Таска грузит шаблон, открывает SSH-сессию через `inspector/runner.py`, по очереди вызывает хендлеры из `inspector/checks.py` (по одному на `CheckKind`), парсит stdout/stderr/exit_code и сохраняет `CheckResult` для каждого шага вместе с длительностью. Если соединение упало - все оставшиеся шаги получают статус `error` с понятным сообщением. На фронте `features/inspector/InspectorPanel` запускает шаблон, а `CheckRunReport` показывает результат с детализацией по каждой проверке и полным stdout/stderr.

### Этап 4. Интеграция с LMS Moodle и маппинг пользователей

Реализован полноценный LTI 1.3 со всеми обязательными элементами OIDC-инициации и валидации `id_token`, плюс простой REST-эндпойнт как резервный канал для тех, кто не готов поднимать LTI.

**Login flow.** На `GET/POST /api/v1/lti/login` (см. `backend/app/api/v1/endpoints/lti.py`) платформа отправляет `iss`, `login_hint`, `target_link_uri`. Сервис ищет `LtiPlatform` по `(issuer, client_id)`, генерирует криптостойкие `state` (32 байта) и `nonce` (24 байта) через `secrets.token_urlsafe`, кладёт `LaunchState` в Redis под ключом `lti:launch-state:<state>` с TTL 5 минут и редиректит браузер на `auth_login_url` платформы. Если issuer не зарегистрирован или для одного issuer'а несколько платформ без `client_id` - сразу 403.

**Launch и валидация id_token.** На колбэке `POST /api/v1/lti/launch` модуль `backend/app/lti/validator.py`:

* достаёт JWKS платформы через `httpx` (cache 10 минут, см. `backend/app/lti/jwks.py`), выбирает ключ по `kid`;
* проверяет подпись (RS256 / RS384 / RS512), а также claims `iss`, `aud`, `exp`, `iat`, `sub`;
* сверяет `nonce` с тем, что лежит в Redis-state'е, и потребляет state одной командой `GETDEL` - повторный launch с тем же state невозможен;
* убеждается, что `version=1.3.0`, `message_type=LtiResourceLinkRequest`, и что присланный `deployment_id` входит в allowlist платформы (без allowlist'а launch отбивается с явной ошибкой - запрещаем «слепое» доверие);
* распаковывает claims: `sub`, `email`, `name`, `roles`, `context.id/title`, `resource_link.id/title`, `custom.*`.

**Маппинг и обработка неизвестных курсов.** Сущность `CourseMapping` хранит связь `(lti_context_id, resource_link_id) → (ki_domain_name, image_id, flavor_id, lab_code, inspector_template)`. `resource_link_id` опционален: сначала ищем по полному ключу, иначе fallback на маппинг без resource_link. Если в LTI пришли поля `custom.ki_image`, `custom.ki_flavor`, `custom.lab_id` - они переопределяют соответствующие поля маппинга, что даёт точечную настройку прямо из Moodle.

Когда маппинга нет, запрос не теряется: `record_unmapped_launch()` сохраняет его в `PendingLtiBinding` со счётчиком попыток, заголовком курса/задания и последним пользователем. Студенту уходит 422 с текстом «курс ещё не настроен преподавателем». Преподаватель открывает `/admin/mappings`, видит список `PendingLtiBinding` с превью контекста и одним кликом создаёт маппинг с предзаполненными `lti_context_id`/`resource_link_id` - копипастить ID руками не нужно. После создания маппинга связанные `PendingLtiBinding` автоматически снимаются (`drop_pending_for_mapping`).

**Идентификация и переиспользование.** `owner_external_id` формируется как `"<platform.id>:<sub>"` - изолирует пользователей разных Moodle'ов друг от друга. Параллельно `LtiUser` ведёт журнал входов (email, name, последний курс, login_count, last_seen). Если у владельца уже есть активный стенд (`ALLOCATING`/`DEPLOYING`/`READY`/`FROZEN`/`CLEANING`), повторный launch не создаёт новый стенд, а отдаёт редирект на существующий с пометкой `reused=True`. Это закрывает кейс «студент кликнул в Moodle второй раз».

**Регистрация инструмента в Moodle.** `GET /api/v1/lti/jwks.json` отдаёт публичный JWK инструмента (RS256, 4096 бит), приватный ключ генерируется в `entrypoint.sh` при первом запуске. `GET /api/v1/lti/config.json` отдаёт JSON-дескриптор Tool: `oidc_initiation_url`, `target_link_uri`, `public_jwk_url` - можно скормить Moodle напрямую.

**REST fallback.** `POST /api/v1/integrations/moodle/launch` принимает `lti_context_id`, `resource_link_id`, `user_id`, `user_display_name` через Moodle Web Services, разрешает маппинг той же логикой и тоже умеет писать unmapped-запросы в `PendingLtiBinding`. Используется для интеграций, которым LTI поднимать дорого.

После любого успешного launch backend редиректит студента на frontend-страницу `/lti/launching/<stand_id>`, где компонент `useStand` поллит статус стенда и переключает экран с «разворачиваем» на «готово» по мере прохождения FSM.

### Этап 5. DevOps и DevSecOps

Всё окружение поднимается через `docker compose`:

```bash
cp .env.example .env
cp config/pool.example.yaml config/pool.yaml
# отредактировать .env (OS_*, SUPER_ADMIN_*) и config/pool.yaml (UUID проектов КИ)
docker compose up --build -d
```

`docker-compose.yml` описывает восемь сервисов. `db` (PostgreSQL 16-alpine) и `redis` (7-alpine с `--save 60 1`) - state и healthcheck-зависимости. `guacd` (Guacamole 1.5.5) обслуживает web-консоль VNC/RDP/SSH. `api` стартует FastAPI через uvicorn, при этом `entrypoint.sh` сначала ждёт TCP-доступности Postgres и Redis, генерирует ed25519- и RSA-ключи в `/app/secrets`, если их там нет, и запускает `scripts/init_db.py` - тот создаёт схему и сидит пул из `pool.yaml`. `worker` поднимает Celery с очередью `orchestrator`, пулом `threads` и concurrency 4, `beat` крутит планировщик sweep-задачи. `web` - Next.js 16 в standalone-сборке, non-root. Снаружи всё закрывается одним `nginx` на порту 8080: он маршрутизирует `/api/`, `/docs`, `/redoc`, `/openapi.json`, поднимает WebSocket для консоли на `/api/v1/stands/<id>/console`, проксирует noVNC через `/console-proxy/` (включая `Upgrade` для websockify) и навешивает CSP `frame-ancestors` для LTI embed.

**DevSecOps.** Контейнеры стартуют от выделенных пользователей `app:app` (UID 10001/10002), на всех проставлен `security_opt: no-new-privileges:true`. Секреты в репозиторий не пропускаются: `.env.example` - пустой шаблон, реальные ключи генерируются в `entrypoint.sh`, локальный pre-commit hook `scripts/check-no-secrets-files.sh` запрещает коммит чего-либо в `secrets/`, а Gitleaks с конфигом `.gitleaks.toml` проверяет код и в pre-commit, и в CI. Backend линтится через `ruff` и сканируется `bandit` (SARIF загружается в Code Scanning), frontend - через `eslint` и `tsc --noEmit`. Зависимости проверяются `pip-audit` для backend и `npm audit --audit-level=high` для frontend. Контейнерные образы прогоняются через Trivy с уровнем CRITICAL/HIGH и `exit-code: "1"`, чтобы CI красился на первом найденном CVE. Полный pipeline лежит в `.github/workflows/security.yml`: `python-lint`, `python-sast`, `python-deps-audit`, `frontend-lint`, `frontend-deps-audit`, `secret-scan`, `container-scan` и `pre-commit`. Pre-commit hooks при локальной разработке (`.pre-commit-config.yaml`): trailing-whitespace, end-of-file-fixer, detect-private-key, detect-aws-credentials, ruff (lint + format), bandit, gitleaks, pip-audit и собственная защита `secrets/`.

## Дополнительные возможности сверх ТЗ

### Аутентификация и авторизация

* `backend/app/services/auth_service.py`, `core/security.py`: JWT access (15 минут) + refresh (7 дней), Argon2 hashing паролей супер-админа.
* Cookies `HttpOnly`, `Secure` (опционально), `SameSite`, CSRF-токен в отдельной cookie.
* Супер-админ создаётся при старте из `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD_HASH` (`services/admin_seeder.py`). Хеш генерируется `backend/scripts/generate_admin_password.py`.
* `dev/login` endpoint открыт только при `APP_ENV != production` для локальной разработки.
* Frontend middleware (`frontend/src/proxy.ts`) проверяет `/api/v1/auth/is-authenticated` на каждом переходе и редиректит на `/login`, если нет валидной сессии. Для `/admin/*` требует флаг `is_super_admin`.

### Веб-консоль ВМ в браузере

* `backend/app/services/console_session.py` + `services/guacd_bridge.py`: WebSocket-мост между браузером и `guacd`. Поддерживает SSH (по ключу из credentials store), VNC и RDP (с паролем, сгенерированным при провижене и инжектированным через cloud-init `chpasswd`).
* `services/console_catalog.py` определяет протокол консоли по `image_id` (`config/console_catalog.example.yaml`), позволяя смешивать в одной системе Linux SSH, Astra VNC и Windows RDP.
* `POST /api/v1/stands/<id>/console/token` выдаёт одноразовый WS-токен (1 минута TTL), `GET /api/v1/stands/<id>/console-url` - URL noVNC из КИ для прямого RDP/VNC.
* Frontend `features/stands/StandConsole` рендерит canvas через `guacamole-common-js`.

### Хранение credentials

* `backend/app/services/credentials_store.py`: SSH private key, fingerprint и console-пароль кладутся в Redis с TTL `credentials_ttl_seconds` (по умолчанию 48 часов). При freeze TTL расширяется автоматически, при destroy ключ удаляется.

## Структура каталогов

```
cloud-lab-manager/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # auth, capacity, cloud, console, health, inspector, integrations, lti, pool, admin, stands
│   │   ├── core/               # exceptions, state_machine, security, cloud_init, logging
│   │   ├── db/                 # SQLAlchemy base, async + sync sessions
│   │   ├── inspector/          # checks.py, loader.py, runner.py, ssh.py, types.py
│   │   ├── lti/                # validator, jwks, claims, state_store (Redis)
│   │   ├── models/             # Stand, PoolProject, User, LtiPlatform, CourseMapping, PendingLtiBinding, LtiUser, CheckRun/Result, CapacityRejection, RuntimeSetting, LifecycleSettingChange
│   │   ├── providers/          # CloudProvider abstract + OpenStackProvider
│   │   ├── schemas/            # Pydantic in/out для каждого ресурса
│   │   ├── services/           # бизнес-логика (pool_manager, stand_service, capacity_checker, lifecycle_service, lti_service, ...)
│   │   ├── tasks/              # Celery-таски (stands, inspector)
│   │   ├── celery_app.py
│   │   ├── config.py           # pydantic-settings, читает .env
│   │   └── main.py             # FastAPI factory, lifespan, обработчик OrchestratorError
│   ├── scripts/                # init_db, check_os_*, generate_admin_password
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── app/                # Next.js App Router: /, /login, /admin/*, /stands/[id]/console, /lti/launching/[id]
│       ├── features/           # admin, auth, capacity, cloud, inspector, mappings, platforms, pool, stands
│       ├── shared/             # api-клиент, layout, ui, utils, icons, identity, modal
│       └── proxy.ts            # middleware: auth-redirect + role-gate
├── config/
│   ├── pool.example.yaml       # шаблон пула проектов
│   ├── console_catalog.example.yaml
│   └── check_templates/        # YAML-шаблоны проверок (lab-01, lab-02-nginx, lab-03-postgres, lab-04-network)
├── docker/
│   ├── backend.Dockerfile      # multi-stage, non-root, tini
│   ├── frontend.Dockerfile     # multi-stage Next.js standalone
│   ├── entrypoint.sh           # ed25519 + RSA генерация, ожидание зависимостей, init_db, запуск api/worker/beat
│   └── nginx/default.conf.template
├── scripts/
│   ├── validate-pool.py        # схема-валидатор config/pool.yaml
│   └── check-no-secrets-files.sh
├── docker-compose.yml
├── .env.example                # пустой шаблон
├── .gitleaks.toml
├── .pre-commit-config.yaml
├── .github/workflows/security.yml
└── ТЗ.md
```

## Конфигурация

Все настройки задаются через переменные окружения (`.env` рядом с `docker-compose.yml`). Полный список - в `.env.example` и `backend/app/config.py`. Ключевые группы:

* `APP_*` - режим, секреты приложения;
* `DATABASE_URL`, `REDIS_URL`, `CELERY_*` - инфраструктура;
* `OS_*` - credential для подключения к Keystone КИ;
* `CAPACITY_THRESHOLD_PERCENT`, `CAPACITY_CACHE_TTL_SECONDS` - capacity guard;
* `STAND_DEFAULT_TTL_SECONDS` (по умолчанию 7200 = 2 часа), `STAND_FREEZE_TTL_SECONDS` (по умолчанию 86400 = 24 часа), `SWEEP_INTERVAL_SECONDS`, `PROVISION_STALL_SECONDS`;
* `INSPECTOR_SSH_*`, `CHECK_TEMPLATES_DIR` - параметры безагентного движка;
* `LTI_TOOL_BASE_URL`, `LTI_FRONTEND_LAUNCH_URL`, `LTI_TOOL_PRIVATE_KEY_PATH`, `LTI_TOOL_KID`, `LTI_LAUNCH_STATE_TTL_SECONDS`, `LTI_EMBED_FRAME_ANCESTORS_EXTRA`;
* `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD_HASH`;
* `COOKIE_*`, `CSRF_*`;
* `GUACD_HOST`, `GUACD_PORT`, `CONSOLE_TOKEN_TTL_SECONDS`, `NOVNC_UPSTREAM`;
* `NGINX_HOST_PORT` (по умолчанию 8080).

Пул проектов КИ описывается в `config/pool.yaml`: список с `ki_project_id`, `ki_project_name`, `ki_domain_id`, `ki_domain_name`, `ki_network_id`, `ki_router_id`. Валидируется `python3 scripts/validate-pool.py`. Изменения подхватываются командой `docker compose exec api python -m scripts.init_db`.

## API

* `GET /api/v1/healthz`, `GET /api/v1/readyz` - health-checks;
* `POST /api/v1/auth/admin/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `GET /api/v1/auth/is-authenticated`;
* `GET /api/v1/capacity` - текущая утилизация и пороговое решение;
* `GET /api/v1/pool/inventory`, `GET /api/v1/pool/projects`, `POST /api/v1/pool/projects[/bulk]`, `DELETE /api/v1/pool/projects/{id}`, `GET /api/v1/pool/discover`;
* `POST /api/v1/stands`, `GET /api/v1/stands?owner_external_id=...`, `GET /api/v1/stands/{id}`, `DELETE /api/v1/stands/{id}`, `GET /api/v1/stands/{id}/credentials`, `POST /api/v1/stands/{id}/freeze|unfreeze|extend|report-incident`;
* `POST /api/v1/stands/{id}/console/token`, `WS /api/v1/stands/{id}/console`, `GET /api/v1/stands/{id}/console-url`;
* `GET /api/v1/inspector/templates`, `POST /api/v1/stands/{id}/checks`, `GET /api/v1/stands/{id}/checks`, `GET /api/v1/checks/{run_id}`;
* `GET /api/v1/admin/stands`, `GET/PATCH /api/v1/admin/lifecycle-settings`, `GET /api/v1/admin/lifecycle-settings/history`, `GET /api/v1/admin/audit/capacity-rejections`, `GET /api/v1/admin/lti-users`;
* `GET/POST /api/v1/lti/login`, `POST /api/v1/lti/launch`, `GET /api/v1/lti/jwks.json`, `GET /api/v1/lti/config.json`, `GET/POST/DELETE /api/v1/lti/platforms`, `GET/POST/DELETE /api/v1/lti/mappings`, `GET/DELETE /api/v1/lti/pending-bindings`, `POST /api/v1/lti/mappings/{id}/launch`;
* `POST /api/v1/integrations/moodle/launch` - REST fallback;
* `GET /api/v1/cloud/networks|images|flavors` - passthrough к КИ для UI.

Полная Swagger-документация: `http://localhost:8080/docs`, ReDoc: `/redoc`, OpenAPI: `/openapi.json`.

## Машина состояний стенда

Состояния: `allocating`, `deploying`, `ready`, `frozen`, `failed`, `cleaning`, `destroyed`.

Разрешённые переходы:

* `allocating` -> `deploying`, `failed`, `cleaning`;
* `deploying` -> `ready`, `failed`, `cleaning`;
* `ready` -> `frozen`, `cleaning`, `failed`;
* `frozen` -> `ready`, `cleaning`;
* `failed` -> `cleaning`, `destroyed`;
* `cleaning` -> `destroyed`, `failed`;
* `destroyed` - терминальное.

Активные статусы (`is_active`): `allocating`, `deploying`, `ready`, `frozen`, `cleaning`. Внутри этих статусов проект КИ занят пользователем.

## Команды разработки

* `cp .env.example .env && cp config/pool.example.yaml config/pool.yaml` - подготовить конфиги из шаблонов
* `docker compose up --build -d` - собрать и поднять весь стек
* `docker compose ps` - статус health контейнеров
* `docker compose down` - остановить контейнеры (volume сохраняются)
* `docker compose down -v` - остановить и удалить volume (потеря данных)
* `docker compose logs -f --tail=200 api` - хвост логов сервиса (замените `api` на нужный)
* `docker compose exec api python` - Python REPL внутри api-контейнера
* `docker compose exec api python -m scripts.init_db` - подхватить изменения `pool.yaml`
* `python3 scripts/validate-pool.py` - проверить YAML-схему пула
* `docker compose exec api ruff check app` - lint backend
* `docker compose exec api ruff format app` - format backend
* `docker compose exec api bandit -c pyproject.toml -r app -ll -ii` - SAST
* `docker compose exec api pytest` - тесты
