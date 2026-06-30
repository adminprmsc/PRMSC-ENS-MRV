#!/usr/bin/env bash
# Pull data from Supabase and load it into local Docker Postgres (no scp needed).
#
# Usage (on the VM, from repo root):
#   export SUPABASE_DATABASE_URL='postgresql://postgres.[ref]:[password]@...pooler.supabase.com:5432/postgres'
#   ./deploy/scripts/migrate-from-supabase.sh
#
# Or pass the URL as the first argument:
#   ./deploy/scripts/migrate-from-supabase.sh 'postgresql://postgres.[ref]:...'
#
# Requires .env.docker (run ./deploy/setup.sh once, or cp .env.docker.example .env.docker).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.docker}"
DUMP_FILE="${DUMP_FILE:-$ROOT_DIR/prmsc_backup.dump}"
SUPABASE_URL="${SUPABASE_DATABASE_URL:-${1:-}}"

if [[ -z "$SUPABASE_URL" ]]; then
  echo "Provide Supabase connection string:" >&2
  echo "  export SUPABASE_DATABASE_URL='postgresql://postgres.[ref]:[pass]@...pooler.supabase.com:5432/postgres'" >&2
  echo "  ./deploy/scripts/migrate-from-supabase.sh" >&2
  echo "" >&2
  echo "Find it in: Supabase Dashboard → Project Settings → Database → Connection string (URI)" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — run: cp .env.docker.example .env.docker" >&2
  echo "Or run full setup: ./deploy/setup.sh" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

echo "Dumping from Supabase (PostgreSQL 17)..."
echo "Saving backup to $(basename "$DUMP_FILE") ..."
docker run --rm \
  -v "$ROOT_DIR:/backup" \
  postgres:17-alpine \
  pg_dump "$SUPABASE_URL" --no-owner --no-acl -Fc -f "/backup/$(basename "$DUMP_FILE")"

if [[ ! -s "$DUMP_FILE" ]]; then
  echo "Dump failed or is empty. Check SUPABASE_DATABASE_URL and VM outbound network." >&2
  exit 1
fi

ls -lh "$DUMP_FILE"
echo ""
echo "Restoring into local Docker Postgres..."

ENV_FILE="$ENV_FILE" "$ROOT_DIR/deploy/scripts/restore-from-supabase.sh" "$DUMP_FILE"

echo ""
echo "Migration complete. Start (or refresh) the app:"
echo "  docker compose --env-file .env.docker up -d --build"
