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

### Этап 1. Ядро системы, управление пулом проектов и API КИ

**Принцип «один студент = один индивидуальный проект».**

* `backend/app/providers/openstack.py` - `OpenStackProvider` поверх openstacksdk, реализующий абстрактный `CloudProvider`. Использует системный credential для администрирования и отдельные коннекты per-project. Включает legacy TLS adapter для старого Keystone КИ, экспоненциальные ретраи (`tenacity`) и прогрев авторизации.
* `backend/app/services/pool_manager.py` - `PoolManager.allocate()` атомарно блокирует свободный проект через `SELECT … FOR UPDATE SKIP LOCKED`, проверяет, что у пользователя нет другого активного стенда, и возвращает запись `PoolProject`. После очистки стенд возвращает проект в статус `FREE`.
* Уникальный частичный индекс `uq_stands_owner_active` в БД гарантирует «один активный стенд на пользователя» на уровне PostgreSQL.
* Пул наполняется через YAML-сид `config/pool.yaml` (валидатор `scripts/validate-pool.py`), API `POST /api/v1/pool/projects/bulk` или авто-обнаружение `GET /api/v1/pool/discover` (читает проекты из КИ через Keystone admin API).
* `backend/app/core/cloud_init.py` собирает cloud-init `user-data`, который инжектит публичный SSH-ключ inspector'а внутрь ВМ. Cloud-init настраивает пользователя `inspector` с ограниченным sudo-списком (только команды, нужные для проверок).
* При запуске стенда `Stand.provision` (Celery-задача) генерирует одноразовый keypair через `provider.create_keypair()` (нативные ключи КИ), сохраняет private key в Redis с TTL и удаляет keypair при destroy. Статических паролей в коде нет.
* Корректная обработка крайних случаев: пустой пул `PoolExhaustedError 409`, дубликат `AlreadyAllocatedError 409`, тайм-аут провижена через `provision_stall_seconds` с авто-переводом в `FAILED`.

### Этап 1. Контроль ёмкости кластера

**Жёсткий предиктивный контроль с порогом 90% (`CAPACITY_THRESHOLD_PERCENT`).**

* `backend/app/services/capacity_checker.py` - `CapacityChecker`:
  * Снимает текущую утилизацию через `nova /os-hypervisors/statistics`. Если эндпойнт закрыт правами (что бывает в КИ), деградирует на `os-quota-sets` системного проекта + Cinder usage.
  * Считает `current_max_percent = max(vcpus%, ram%, disk%)`. При наличии `flavor_id` запрашиваемой ВМ считает **предиктивный** `projected_max_percent = max((used+req)/total ...)`.
  * Если `projected ≥ threshold`, бросает `CapacityExceededError 503` с понятным сообщением для UI.
  * Кеш утилизации `capacity_cache_ttl_seconds` с принудительной инвалидацией в «горячей зоне» (когда `current_max` подходит к порогу ближе чем на 10 п. п.), чтобы не выдать allow на устаревших данных.
* `backend/app/services/capacity_audit.py` фиксирует каждый отказ в таблице `capacity_rejections` (кто, когда, какой flavor, какая утилизация). Админ читает историю через `GET /api/v1/admin/audit/capacity-rejections`.
* На фронтенде `features/capacity` показывает живую utilization-карту, на странице обзора `/admin` визуализируется поведение пула и КИ.

### Этап 2. Асинхронный жизненный цикл и тайм-ауты

**Все долгие операции (provision, destroy, sweep, check) асинхронные через Celery.**

* `backend/app/celery_app.py` поднимает Celery с broker и backend в Redis. `task_acks_late=True`, `worker_prefetch_multiplier=1`, авто-ретраи с экспоненциальным backoff.
* `backend/app/tasks/stands.py`:
  * `stands.provision` - keypair, server create, attach floating IP, переход в `READY` с расчётом `expires_at`. Обрабатывает повторный запуск (idempotent по `ki_server_id`/`ki_keypair_name`).
  * `stands.destroy` - удаление ВМ + keypair, перевод проекта в `FREE`, очистка credentials в Redis.
  * `stands.sweep_expired` - Celery-beat задача (каждые `sweep_interval_seconds` секунд) собирает истёкшие стенды и зависшие в `ALLOCATING`/`DEPLOYING` дольше `provision_stall_seconds`, переводит их в `FAILED` или ставит destroy.
* `backend/app/tasks/inspector.py` - асинхронные SSH-проверки.

**Машина состояний** (`backend/app/core/state_machine.py`):

`ALLOCATING → DEPLOYING → READY → FROZEN ⇄ READY → CLEANING → DESTROYED`, с переходами в `FAILED` из любого «активного» состояния. `assert_transition()` бросает `InvalidTransitionError 409`, если перехода не существует. Каждый переход журналируется через structlog.

**Гибкое управление временем жизни** (`backend/app/services/lifecycle_service.py`):

* `freeze` - переводит стенд `READY → FROZEN`, ставит `expires_at = now + freeze_ttl`.
* `report_incident` - то же самое, но с описанием инцидента, флагом `incident_reported` и сохранением мета-данных в `extra` стенда. UI на странице студента подсвечивает такие стенды красным баджиком, в админке появляется отдельный фильтр «Инциденты».
* `unfreeze`, `extend` - обратные операции с настраиваемым TTL.
* `RuntimeSetting` + `LifecycleSettings` - три глобальных параметра (`stand_default_ttl_seconds`, `stand_freeze_ttl_seconds`, `capacity_threshold_percent`) хранятся в БД и доступны на запись для супер-админа через `PATCH /api/v1/admin/lifecycle-settings`. Кеш 5 секунд, инвалидируется при апдейте. Каждое изменение пишется в `lifecycle_setting_changes` (история, кто и когда менял).
* UI: страница `/admin/settings` с формой управления лимитами и панелью истории изменений (`features/admin/components/LifecycleHistoryPanel`).

### Этап 3. SSH-движок автоматической проверки конфигураций

**Безагентный движок, расширяемый через YAML-шаблоны.**

* `backend/app/inspector/ssh.py` - подключение к ВМ через `asyncssh` ed25519-ключом (`secrets/inspector_ed25519`). Ключ генерируется один раз в `entrypoint.sh`, публичный ключ инжектится в каждую новую ВМ через cloud-init.
* `backend/app/inspector/types.py` - 13 типов проверок (`CheckKind`):
  * `package_installed`, `systemd_active`, `port_listening`, `file_exists`, `file_contains`, `command_exit_zero`, `command_output_matches`, `os_release`, `user_exists`, `process_running`, `http_endpoint`, `dns_resolves`, `command_output_compare`.
  * Каждая проверка имеет `section` (`os` / `software` / `network` / `other`) и `severity` (`critical` / `warning` / `info`). Warning-провалы не валят весь чек-ран целиком.
* `backend/app/inspector/loader.py` - Pydantic-валидация YAML-шаблонов с понятными ошибками (по индексу шага, по полям, с разрешённым списком типов).
* `backend/app/inspector/checks.py` - registry хендлеров: для каждого `CheckKind` отдельная async-функция, формирующая SSH-команду, парсящая stdout/stderr/exit_code и возвращающая `CheckOutcome`.
* `backend/app/inspector/runner.py` - обходит шаги шаблона, ловит ошибки SSH-соединения, собирает `RunReport` со счётчиками `passed/failed/errored`.
* `backend/app/tasks/inspector.py` (`inspector.run`) - Celery-таска: пересоздаёт сессию, прогоняет шаблон, сохраняет результаты в `check_runs` и `check_results` с stdout/stderr/exit_code/duration по каждому шагу.
* Шаблоны лежат в `config/check_templates/`:
  * `lab-01.yaml` - базовая проверка ОС;
  * `lab-02-nginx.yaml` - установка nginx, reverse proxy на 127.0.0.1:8080, gzip;
  * `lab-03-postgres.yaml` - PostgreSQL и его конфигурация;
  * `lab-04-network.yaml` - сетевые проверки.
* Frontend (`features/inspector`): `InspectorPanel` запускает шаблон, `CheckRunReport` показывает детальный лог каждого шага со статусом, секцией и полным stdout/stderr.

### Этап 4. Интеграция с LMS Moodle и маппинг пользователей

**Полноценный LTI 1.3 + REST fallback.**

* OIDC-инициация: `GET/POST /api/v1/lti/login` (`backend/app/api/v1/endpoints/lti.py` + `services/lti_service.py`):
  * Платформа отправляет `iss`, `login_hint`, `target_link_uri`. Сервис находит `LtiPlatform` по issuer + client_id, генерирует криптостойкие `state` и `nonce`, кладёт `LaunchState` в Redis на 5 минут (`lti:launch-state:<state>`) и редиректит на `auth_login_url` платформы.
* Получение и валидация `id_token` (`backend/app/lti/validator.py`):
  * Скачивает JWKS платформы (`backend/app/lti/jwks.py`, кеш 10 минут).
  * Проверяет подпись (RS256/384/512), `iss`, `aud`, `exp`, `iat`, `nonce`, `version=1.3.0`, `message_type=LtiResourceLinkRequest`, `deployment_id` против allowlist платформы.
  * Парсит claims: `sub`, `email`, `name`, `roles`, `context.id/title`, `resource_link.id/title`, `custom.*`.
* Маппинг (`CourseMapping`):
  * Ключ `(lti_context_id, resource_link_id)` (resource_link опционально). При нескольких совпадениях берётся самый свежий, в логе пишется warning.
  * Один маппинг указывает на `ki_domain_name` (фильтр пула), `image_id`, `flavor_id`, `lab_code`, `inspector_template`. Поля custom в LTI могут переопределять `image`/`flavor`/`lab_code`.
  * Если маппинга нет, запрос фиксируется в `PendingLtiBinding` (preview контекста, последний пользователь, счётчик попыток) и студенту возвращается понятная 422-ошибка. Преподаватель видит эти запросы в админке `/admin/mappings` и создаёт маппинг одним кликом.
* Идентификация пользователя: `owner_external_id = "<platform.id>:<sub>"`. Запись о пользователе кэшируется в `LtiUser` (журнал входов с email, name, последним курсом и числом сессий, доступен в админке).
* Идемпотентный запуск: если у владельца уже есть активный стенд, повторный launch не создаёт новый, а возвращает редирект на существующий (`reused=True`).
* `GET /api/v1/lti/jwks.json` отдаёт публичный ключ инструмента (RS256), `GET /api/v1/lti/config.json` - JSON-дескриптор для регистрации в Moodle.
* REST fallback: `POST /api/v1/integrations/moodle/launch` для интеграции через Moodle Web Services без полноценного LTI. Также фиксирует unmapped-запросы в `PendingLtiBinding`.
* После успешного launch backend редиректит студента на frontend-страницу `/lti/launching/<stand_id>`, где живой статус провижена через polling `useStand`.

### Этап 5. DevOps и DevSecOps

**Запуск одной командой:**

```bash
make bootstrap   # cp .env.example .env, cp pool.example.yaml pool.yaml
# отредактировать .env (OS_*, SUPER_ADMIN_*) и config/pool.yaml (UUID проектов КИ)
make up          # docker compose up --build -d
```

Контейнеры (`docker-compose.yml`):

* `db` - PostgreSQL 16-alpine, healthcheck `pg_isready`;
* `redis` - Redis 7-alpine, persistence `--save 60 1`;
* `guacd` - `guacamole/guacd:1.5.5` для web-консоли VNC/RDP/SSH;
* `api` - FastAPI через uvicorn, `entrypoint.sh` ждёт Postgres/Redis, генерирует ed25519 + RSA ключи, прогоняет `scripts/init_db.py` (создание схемы + сид пула);
* `worker` - Celery worker (очередь `orchestrator`, пул `threads`, concurrency 4 по умолчанию);
* `beat` - Celery beat для sweep-задачи;
* `web` - Next.js 16 (standalone build, non-root);
* `nginx` - reverse proxy на порту 8080: маршрутизация `/api/`, `/docs`, `/redoc`, `/openapi.json`, WebSocket `/api/v1/stands/<id>/console`, проксирование noVNC через `/console-proxy/`, CSP `frame-ancestors` для LTI embed.

**DevSecOps-стандарт:**

* Все контейнеры под non-root (`app:app`, UID 10001/10002), `security_opt: no-new-privileges:true`.
* Секреты не лежат в репозитории: `.env.example` пустой шаблон, ключи генерируются в `entrypoint.sh`. Скрипт `scripts/check-no-secrets-files.sh` запрещает коммит в `secrets/`. Gitleaks-конфиг (`.gitleaks.toml`) на CI и в pre-commit.
* Linting и SAST: `ruff` + `bandit` для backend, `eslint` + `tsc --noEmit` для frontend.
* Аудит зависимостей: `pip-audit`, `npm audit --audit-level=high`.
* Сканирование образов: Trivy на CI (CRITICAL/HIGH, ignore-unfixed=false, fail-on-detection).
* Pre-commit hooks (`.pre-commit-config.yaml`): trailing-whitespace, end-of-file-fixer, detect-private-key, detect-aws-credentials, ruff (lint + format), bandit, gitleaks, pip-audit, forbid-secrets-dir-content.
* GitHub Actions workflow (`.github/workflows/security.yml`): backend-lint, backend-sast (Bandit SARIF upload), python-deps-audit, frontend-lint, frontend-deps-audit, secret-scan, container-scan (Trivy SARIF), pre-commit.

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
├── Makefile                    # bootstrap, up, down, nuke, logs, ps, lint, sast, test, pool-*
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

Пул проектов КИ описывается в `config/pool.yaml`: список с `ki_project_id`, `ki_project_name`, `ki_domain_id`, `ki_domain_name`, `ki_network_id`, `ki_router_id`. Валидируется `make pool-validate`. Изменения подхватываются перезапуском `make pool-reload` (запускает `scripts/init_db.py` внутри контейнера api).

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

* `make bootstrap` - создать `.env` и `config/pool.yaml` из примеров
* `make up` - `docker compose up --build -d`, показать статус
* `make down` - остановить контейнеры (volume сохраняются)
* `make nuke` - остановить и удалить volume (потеря данных)
* `make logs SERVICE=api` - хвост логов сервиса
* `make ps` - статус health контейнеров
* `make shell` - Python REPL внутри api-контейнера
* `make pool-reload` - прогнать `scripts/init_db.py` для подхвата изменений `pool.yaml`
* `make pool-validate` - проверить YAML-схему пула
* `make lint` - `ruff check`
* `make fmt` - `ruff format`
* `make sast` - `bandit`
* `make test` - `pytest`

## Точки расширения

* Новый облачный провайдер: реализовать абстрактный `CloudProvider` из `backend/app/providers/base.py` и зарегистрировать в `get_cloud_provider()`.
* Новый тип проверки: добавить `CheckKind`, Pydantic-модель в `inspector/loader.py` и хендлер в `inspector/checks.py`.
* Новая лабораторная: положить YAML-шаблон в `config/check_templates/` и привязать к курсу через `CourseMapping.inspector_template` либо запускать вручную через `/api/v1/stands/{id}/checks`.
* Новый протокол консоли: расширить `console_catalog` и `GuacdConnection.to_handshake_params()`.
* Новая LMS: либо зарегистрировать как LTI 1.3 платформу (`POST /api/v1/lti/platforms`), либо использовать REST endpoint `/api/v1/integrations/moodle/launch` как пример собственного шлюза.
