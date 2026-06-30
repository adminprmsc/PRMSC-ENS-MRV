#!/usr/bin/env bash
# One-command VM setup: env → restore Supabase dump (if present) → start full stack.
#
# Usage (on the VM, from repo root):
#   chmod +x deploy/setup.sh deploy/scripts/*.sh
#   ./deploy/setup.sh
#
# Optional:
#   PUBLIC_ORIGIN=http://101.50.86.169 ./deploy/setup.sh
#   SUPABASE_DATABASE_URL='postgresql://...' ./deploy/setup.sh   # migrate from Supabase
#   SKIP_RESTORE=1 ./deploy/setup.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=deploy/lib/compose.sh
source "$ROOT_DIR/deploy/lib/compose.sh"

ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.docker}"
ENV_EXAMPLE="$ROOT_DIR/.env.docker.example"
DUMP_FILE="${DUMP_FILE:-$ROOT_DIR/prmsc_backup.dump}"

DC="$(compose_cmd)"
COMPOSE=($DC $(compose_args "$ROOT_DIR"))

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed."
    echo "Install: curl -fsSL https://get.docker.com | sudo sh"
    echo "Then log out/in and re-run: ./deploy/setup.sh"
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon not running or permission denied."
    echo "Try: sudo usermod -aG docker $USER && newgrp docker"
    exit 1
  fi
}

random_hex() {
  openssl rand -hex "${1:-16}"
}

ensure_env() {
  local cli_public_origin="${PUBLIC_ORIGIN:-}"

  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ ! -f "$ENV_EXAMPLE" ]]; then
      echo "Missing $ENV_EXAMPLE" >&2
      exit 1
    fi
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo "Created $ENV_FILE from template."
  fi

  # shellcheck disable=SC1090
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a

  local changed=0
  local origin="${cli_public_origin:-${PUBLIC_ORIGIN:-}}"

  if [[ "$origin" == "CHANGE_ME" || -z "$origin" ]]; then
    local ip
    ip="$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
    if [[ -n "$ip" ]]; then
      origin="http://${ip}"
    else
      origin="http://localhost"
    fi
    sed -i.bak "s|^PUBLIC_ORIGIN=.*|PUBLIC_ORIGIN=${origin}|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
    changed=1
    echo "Set PUBLIC_ORIGIN=${origin}"
  elif [[ "$origin" != "$(grep -E '^PUBLIC_ORIGIN=' "$ENV_FILE" | cut -d= -f2-)" ]]; then
    sed -i.bak "s|^PUBLIC_ORIGIN=.*|PUBLIC_ORIGIN=${origin}|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
    changed=1
    echo "Set PUBLIC_ORIGIN=${origin}"
  fi

  if [[ "${POSTGRES_PASSWORD:-}" == "CHANGE_ME" || -z "${POSTGRES_PASSWORD:-}" ]]; then
    local pw
    pw="$(random_hex 16)"
    sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pw}|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
    changed=1
    echo "Generated POSTGRES_PASSWORD"
  fi

  if [[ "${SECRET_KEY:-}" == "CHANGE_ME" || -z "${SECRET_KEY:-}" ]]; then
    sed -i.bak "s|^SECRET_KEY=.*|SECRET_KEY=$(random_hex 32)|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
    changed=1
    echo "Generated SECRET_KEY"
  fi

  if [[ "${JWT_SECRET_KEY:-}" == "CHANGE_ME" || -z "${JWT_SECRET_KEY:-}" ]]; then
    sed -i.bak "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=$(random_hex 32)|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
    changed=1
    echo "Generated JWT_SECRET_KEY"
  fi

  if [[ "$changed" -eq 1 ]]; then
    echo "Updated $ENV_FILE — review if needed: nano .env.docker"
  fi
}

restore_if_needed() {
  if [[ "${SKIP_RESTORE:-}" == "1" ]]; then
    echo "SKIP_RESTORE=1 — skipping database restore."
    return
  fi

  if [[ -n "${SUPABASE_DATABASE_URL:-}" ]]; then
    echo "SUPABASE_DATABASE_URL set — migrating from Supabase..."
    ENV_FILE="$ENV_FILE" "$ROOT_DIR/deploy/scripts/migrate-from-supabase.sh"
  elif [[ -f "$DUMP_FILE" && -s "$DUMP_FILE" ]]; then
    echo "Found $(basename "$DUMP_FILE") — restoring Supabase data..."
    ENV_FILE="$ENV_FILE" COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.yml}" \
      "$ROOT_DIR/deploy/scripts/restore-from-supabase.sh" "$DUMP_FILE"
  else
    echo "No dump at $DUMP_FILE — starting with empty database (TypeORM migrations on first boot)."
    "${COMPOSE[@]}" up -d postgres
    echo "Waiting for postgres..."
    until "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-prmsc}" -d "${POSTGRES_DB:-prmsc_mrv}" >/dev/null 2>&1; do
      sleep 2
    done
  fi
}

start_stack() {
  echo "Building and starting full stack..."
  "${COMPOSE[@]}" up -d --build

  echo "Waiting for API health..."
  local i
  for i in $(seq 1 30); do
    if curl -sf "http://localhost/api/health" >/dev/null 2>&1; then
      break
    fi
    sleep 3
  done

  echo ""
  echo "=== PRMSC-MRV is up ==="
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  echo "Open: ${PUBLIC_ORIGIN:-http://localhost}/"
  echo "API:  curl -s http://localhost/api/health"
  echo ""
  "${COMPOSE[@]}" ps
}

main() {
  require_docker
  chmod +x "$ROOT_DIR/deploy/scripts/"*.sh 2>/dev/null || true
  ensure_env
  restore_if_needed
  start_stack
}

main "$@"
