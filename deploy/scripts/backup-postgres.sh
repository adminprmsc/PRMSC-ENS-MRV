#!/usr/bin/env bash
# Backup Postgres from the running Docker stack (run on the VM).
#
# Usage:
#   ./deploy/scripts/backup-postgres.sh
#   ./deploy/scripts/backup-postgres.sh /path/to/output.dump
#   make db-backup
#
# Copy off the VM: on Mac run `make backup-to-mac` or `./deploy/backup-db.sh --pull-only`

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=deploy/lib/compose.sh
source "$ROOT_DIR/deploy/lib/compose.sh"

ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.docker}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT="${1:-$ROOT_DIR/backups/prmsc_mrv_${TIMESTAMP}.dump}"

mkdir -p "$(dirname "$OUT")"

DC="$(compose_cmd)"
COMPOSE=($DC $(compose_args "$ROOT_DIR"))

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — run ./deploy/setup.sh first" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source "$ENV_FILE"
set +a

POSTGRES_USER="${POSTGRES_USER:-prmsc}"
POSTGRES_DB="${POSTGRES_DB:-prmsc_mrv}"

echo "Backing up $POSTGRES_DB to $OUT ..."
"${COMPOSE[@]}" exec -T postgres pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner --no-acl -Fc >"$OUT"

ls -lh "$OUT"
REL_OUT="${OUT#"$ROOT_DIR"/}"
echo "CREATED:${REL_OUT}"
