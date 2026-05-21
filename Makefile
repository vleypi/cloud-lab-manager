COMPOSE ?= docker compose

.PHONY: help up down build logs ps shell lint sast fmt test

help:
	@echo "Targets:"
	@echo "  up      - bring the stack up (docker compose up --build)"
	@echo "  down    - stop everything"
	@echo "  build   - rebuild backend image"
	@echo "  logs    - tail logs"
	@echo "  ps      - service status"
	@echo "  shell   - python shell inside the api container"
	@echo "  lint    - ruff check on backend"
	@echo "  fmt     - ruff format on backend"
	@echo "  sast    - bandit on backend"
	@echo "  test    - pytest inside api container"

up:
	$(COMPOSE) up --build -d
	$(COMPOSE) ps

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build api

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

shell:
	$(COMPOSE) exec api python

lint:
	cd backend && ruff check .

fmt:
	cd backend && ruff format .

sast:
	cd backend && bandit -r app -ll -ii

test:
	$(COMPOSE) exec api pytest
