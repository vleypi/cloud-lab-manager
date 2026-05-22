COMPOSE ?= docker compose
SERVICE  ?=

.PHONY: help bootstrap up down nuke build logs ps shell pool-init pool-validate pool-reload lint sast fmt test

help:
	@echo "Bootstrap:"
	@echo "  bootstrap     - copy .env.example -> .env and pool.example.yaml -> pool.yaml"
	@echo "  pool-init     - copy pool.example.yaml -> pool.yaml only"
	@echo "  pool-validate - YAML schema check on config/pool.yaml"
	@echo "  pool-reload   - re-run init_db inside the running api container"
	@echo ""
	@echo "Compose lifecycle:"
	@echo "  up            - docker compose up --build -d, prints status"
	@echo "  down          - stop everything (keeps volumes)"
	@echo "  nuke          - stop and DELETE volumes (data loss!)"
	@echo "  build         - rebuild backend image only"
	@echo "  logs          - tail logs (SERVICE=name to filter)"
	@echo "  ps            - service health overview"
	@echo "  shell         - python shell inside the api container"
	@echo ""
	@echo "Dev tools:"
	@echo "  lint          - ruff check on backend"
	@echo "  fmt           - ruff format on backend"
	@echo "  sast          - bandit on backend"
	@echo "  test          - pytest inside api container"

bootstrap:
	@if [ ! -f .env ]; then cp .env.example .env; echo "[ok] created .env from .env.example"; else echo "[skip] .env already exists"; fi
	@if [ ! -f config/pool.yaml ]; then cp config/pool.example.yaml config/pool.yaml; echo "[ok] created config/pool.yaml from pool.example.yaml"; else echo "[skip] config/pool.yaml already exists"; fi
	@echo ""
	@echo "Next steps:"
	@echo "  1. Edit .env -- replace OS_* and SUPER_ADMIN_* values"
	@echo "  2. Edit config/pool.yaml -- paste KI project / network / router UUIDs"
	@echo "  3. Run: make up"

pool-init:
	@if [ ! -f config/pool.yaml ]; then cp config/pool.example.yaml config/pool.yaml; echo "[ok] created config/pool.yaml"; else echo "[skip] config/pool.yaml already exists"; fi

pool-validate:
	@python3 scripts/validate-pool.py

pool-reload:
	$(COMPOSE) exec api python -m scripts.init_db

up:
	$(COMPOSE) up --build -d
	$(COMPOSE) ps

down:
	$(COMPOSE) down

nuke:
	$(COMPOSE) down -v

build:
	$(COMPOSE) build api

logs:
ifeq ($(SERVICE),)
	$(COMPOSE) logs -f --tail=200
else
	$(COMPOSE) logs -f --tail=200 $(SERVICE)
endif

ps:
	$(COMPOSE) ps

shell:
	$(COMPOSE) exec api python

lint:
	cd backend && ruff check app

fmt:
	cd backend && ruff format app

sast:
	cd backend && bandit -c pyproject.toml -r app -ll -ii

test:
	$(COMPOSE) exec api pytest
