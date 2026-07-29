#!/usr/bin/env bash
# Thin wrapper — prefer ./deploy/backup-db.sh (same WFM-style flow).
#
# Recommended:
#   1) On VM:  make db-backup
#   2) On Mac: ./deploy/backup-db.sh --pull-only
#
# This wrapper maps old flags onto backup-db.sh.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARGS=(--pull-only)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --create)
      ARGS=()
      shift
      ;;
    --latest-only)
      ARGS=(--pull-only)
      shift
      ;;
    --no-open)
      shift
      ;;
    -h|--help)
      exec "$ROOT_DIR/deploy/backup-db.sh" --help
      ;;
    *)
      echo "Unknown option: $1 (see ./deploy/backup-db.sh --help)" >&2
      exit 1
      ;;
  esac
done

if [[ -n "${LOCAL_DIR:-}" ]]; then
  export PRMSC_BACKUP_DIR="$LOCAL_DIR"
fi
if [[ -n "${VM_HOST:-}" ]]; then
  export PRMSC_SSH_HOST="$VM_HOST"
fi
if [[ -n "${VM_USER:-}" ]]; then
  export PRMSC_SSH_USER="$VM_USER"
fi

exec "$ROOT_DIR/deploy/backup-db.sh" "${ARGS[@]}"
