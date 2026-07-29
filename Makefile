# PRMSC-MRV — production operations
# Thin wrappers around the Docker Compose stack (.env.docker).
#
#   make help          list available targets
#   make deploy        pull latest code, rebuild, migrate (on start), restart
#   make db-backup     dump Postgres to ./backups/ (run on the VM)
#   make up            build + start the stack
#   make down          stop stack (data preserved)
#   make seed          note: location catalog seeds automatically when empty

COMPOSE := docker compose --env-file .env.docker
ENV_FILE := .env.docker
BACKUP_DIR := backups

.DEFAULT_GOAL := help
.PHONY: help check-env up down restart deploy build migrate seed logs logs-backend ps health db-shell db-backup prune

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

# Creates ./backups/prmsc-mrv-YYYYMMDD-HHMMSS.dump on this machine (typically the VM).
# Prints CREATED:<path> as the last line so deploy/backup-db.sh can scp it.
db-backup: check-env ## Dump Postgres into ./backups/ (run on the VM)
	@mkdir -p $(BACKUP_DIR)
	@stamp=$$(date +%Y%m%d-%H%M%S); \
	out="$(BACKUP_DIR)/prmsc-mrv-$$stamp.dump"; \
	echo "==> Dumping database to $$out"; \
	$(COMPOSE) exec -T postgres true >/dev/null \
	  || { echo "ERROR: postgres container is not running (make ps)"; exit 1; }; \
	$(COMPOSE) exec -T postgres \
	  sh -c 'pg_dump -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" --no-owner --no-acl -Fc' \
	  > "$$out"; \
	bytes=$$(wc -c < "$$out" | tr -d ' '); \
	if [ "$$bytes" -lt 100 ]; then \
	  rm -f "$$out"; \
	  echo "ERROR: dump was empty ($$bytes bytes)"; \
	  exit 1; \
	fi; \
	echo "==> Backup written: $$out ($$bytes bytes)"; \
	echo "CREATED:$$out"

prune: ## Remove dangling images to reclaim disk
	docker image prune -f
