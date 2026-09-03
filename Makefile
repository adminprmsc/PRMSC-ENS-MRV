# PRMSC-MRV — production operations
# Thin wrappers around the Docker Compose stack (.env.docker).
#
#   make help          list available targets
#   make deploy        pull latest code, rebuild, migrate (on start), restart
#   make db-backup       dump Postgres to ./backups/ (run on the VM)
#   make backup-to-mac   backup on prod VM + copy to ./backups/ (run on Mac)
#   make up            build + start the stack
#   make down          stop stack (data preserved)
#   make seed          note: location catalog seeds automatically when empty

COMPOSE := docker compose --env-file .env.docker
ENV_FILE := .env.docker
BACKUP_DIR := backups

# ENS production VM — override on Mac if needed:
#   make backup-to-mac PRMSC_SSH_HOST=101.50.87.168 PRMSC_SSH_USER=prmsc101
PRMSC_SSH_HOST ?= 101.50.87.168
PRMSC_SSH_USER ?= prmsc101
PRMSC_SSH_PASSWORD_AUTH ?= 1

.DEFAULT_GOAL := help
.PHONY: help check-env up down restart deploy build migrate seed logs logs-backend ps health db-shell db-backup backup-to-mac backup-pull-mac prune

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

check-env: ## Fail fast if .env.docker is missing
	@test -f $(ENV_FILE) || { \
	  echo "ERROR: $(ENV_FILE) not found. Run: cp .env.docker.example .env.docker"; \
	  exit 1; \
	}

up: check-env ## Build and start the full stack (detached)
	$(COMPOSE) up -d --build

down: ## Stop and remove containers (named volumes/data preserved)
	$(COMPOSE) down

restart: ## Restart all services
	$(COMPOSE) restart

build: check-env ## Build images without starting
	$(COMPOSE) build

# Standard deploy: refresh code, rebuild images, bring stack up.
# Backend entrypoint runs TypeORM migrations on start.
deploy: check-env ## Pull latest git + rebuild + restart (migrations on boot)
	git pull --ff-only origin main
	$(COMPOSE) up -d --build
	@echo "Deploy complete. Run 'make health' to verify."

migrate: check-env ## Apply pending DB migrations (no full rebuild)
	$(COMPOSE) exec -T backend node ./node_modules/typeorm/cli.js migration:run \
	  -d dist/infrastructure/database/data-source.js

seed: ## Location catalog seeds automatically when empty — restart backend to retry
	@echo "Location catalog seed runs in the backend when the catalog is empty."
	@echo "Restarting backend…"
	$(COMPOSE) restart backend

logs: ## Tail logs from all services
	$(COMPOSE) logs -f

logs-backend: ## Tail backend logs only
	$(COMPOSE) logs -f backend

ps: ## Show running services
	$(COMPOSE) ps

health: ## Hit API health via nginx
	@curl -fsS http://localhost/api/health && echo " <- api ok"

db-shell: check-env ## Open a psql shell inside the postgres container
	$(COMPOSE) exec postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

# Prefer shell script (make is not installed on all VMs).
db-backup: check-env ## Dump Postgres into ./backups/ (run on the VM)
	@./deploy/scripts/backup-postgres.sh

# Run on your Mac (not inside SSH). Creates dump on VM, then scp to ./backups/.
backup-to-mac: ## Prod DB backup on VM + download to ./backups/ (Mac only)
	@PRMSC_SSH_HOST=$(PRMSC_SSH_HOST) \
	 PRMSC_SSH_USER=$(PRMSC_SSH_USER) \
	 PRMSC_SSH_PASSWORD_AUTH=$(PRMSC_SSH_PASSWORD_AUTH) \
	 ./deploy/backup-db.sh

backup-pull-mac: ## Download latest VM backup to ./backups/ only (Mac only)
	@PRMSC_SSH_HOST=$(PRMSC_SSH_HOST) \
	 PRMSC_SSH_USER=$(PRMSC_SSH_USER) \
	 PRMSC_SSH_PASSWORD_AUTH=$(PRMSC_SSH_PASSWORD_AUTH) \
	 ./deploy/backup-db.sh --pull-only

prune: ## Remove dangling images to reclaim disk
	docker image prune -f
