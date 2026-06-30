#!/usr/bin/env bash
# Create a pg_dump from Supabase PostgreSQL 17+ (optional — laptop backup only).
#
# On the VM, prefer migrate-from-supabase.sh (dump + restore in one step, no scp):
#   SUPABASE_DATABASE_URL='postgresql://...' ./deploy/scripts/migrate-from-supabase.sh
#
# Usage (laptop):
#   export SUPABASE_DATABASE_URL='postgresql://postgres.[ref]:[pass]@...pooler.supabase.com:5432/postgres'
#   ./deploy/scripts/dump-from-supabase.sh
#   ./deploy/scripts/dump-from-supabase.sh /path/to/output.dump

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT_DIR/prmsc_backup.dump}"

if [[ -z "${SUPABASE_DATABASE_URL:-}" ]]; then
  echo "Set SUPABASE_DATABASE_URL (Supabase Dashboard → Database → connection string)" >&2
  exit 1
fi

echo "Dumping to $OUT ..."
docker run --rm \
  -v "$(dirname "$OUT"):/backup" \
  postgres:17-alpine \
  pg_dump "$SUPABASE_DATABASE_URL" --no-owner --no-acl -Fc -f "/backup/$(basename "$OUT")"

ls -lh "$OUT"
echo "Copy to VM: scp $OUT adminprms98@<vm-ip>:~/prmsc-mrv/"
