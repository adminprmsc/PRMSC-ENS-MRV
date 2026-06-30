#!/usr/bin/env bash
# Restore a pg_dump (from Supabase) into the Postgres container.
#
# Usually run via ./deploy/setup.sh — or manually:
#   ./deploy/scripts/restore-from-supabase.sh
#   ./deploy/scripts/restore-from-supabase.sh /path/to/prmsc_backup.dump

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=deploy/lib/compose.sh
source "$ROOT_DIR/deploy/lib/compose.sh"

ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.docker}"
DUMP_FILE="${1:-$ROOT_DIR/prmsc_backup.dump}"

DC="$(compose_cmd)"
COMPOSE=($DC $(compose_args "$ROOT_DIR"))

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — run ./deploy/setup.sh or cp .env.docker.example .env.docker" >&2
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Dump not found: $DUMP_FILE" >&2
  exit 1
fi

if [[ ! -s "$DUMP_FILE" ]]; then
  echo "Dump file is empty: $DUMP_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source "$ENV_FILE"
set +a

POSTGRES_USER="${POSTGRES_USER:-prmsc}"
POSTGRES_DB="${POSTGRES_DB:-prmsc_mrv}"

echo "Starting postgres..."
"${COMPOSE[@]}" up -d postgres

echo "Waiting for postgres to be healthy..."
until "${COMPOSE[@]}" exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  sleep 2
done

echo "Recreating database $POSTGRES_DB..."
"${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
"${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${POSTGRES_DB};"

echo "Restoring from $DUMP_FILE (this may take a few minutes)..."
# Supabase dumps use PG17 pg_dump format — must restore with PG17+ client.
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in $ENV_FILE}"
COMPOSE_NETWORK="$("${COMPOSE[@]}" ps -q postgres | xargs -r docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' | head -1)"
docker run --rm \
  --network "$COMPOSE_NETWORK" \
  -v "$DUMP_FILE:/dump:ro" \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  postgres:17-alpine \
  pg_restore \
  -h prmsc-postgres \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner --no-acl /dump \
  || true

echo "Seeding TypeORM migrations baseline..."
"${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  timestamp bigint NOT NULL,
  name character varying NOT NULL
);
INSERT INTO migrations (timestamp, name)
SELECT 1730000000000, 'InitialSchema1730000000000'
WHERE NOT EXISTS (
  SELECT 1 FROM migrations WHERE timestamp = 1730000000000
);
SQL

echo "Row counts:"
"${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) AS users FROM users;"
"${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) AS submissions FROM submissions;"

echo "Restore complete. Start (or refresh) the stack:"
echo "  docker compose --env-file .env.docker up -d --build"
