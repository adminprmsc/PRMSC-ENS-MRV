#!/usr/bin/env bash
# Create a Postgres dump on the production VM (over SSH), then copy it to this Mac.
#
# Run from your Mac — NOT from inside an SSH session on the VM.
#
# Usage:
#   ./deploy/scripts/pull-backup-to-mac.sh
#   ./deploy/scripts/pull-backup-to-mac.sh --latest-only   # skip create; download newest existing dump
#   VM_HOST=101.50.86.169 LOCAL_DIR=~/Downloads/prmsc-backups ./deploy/scripts/pull-backup-to-mac.sh

set -euo pipefail

VM_USER="${VM_USER:-adminprms98}"
VM_HOST="${VM_HOST:-101.50.86.169}"
VM="${VM_USER}@${VM_HOST}"
REMOTE_REPO="${REMOTE_REPO:-PRMSC-ENS-MRV}"
LOCAL_DIR="${LOCAL_DIR:-$HOME/Downloads/prmsc-backups}"
CREATE_BACKUP=1
OPEN_FINDER=1

usage() {
  cat <<'EOF'
Usage: pull-backup-to-mac.sh [options]

  --create         Create a fresh dump on the VM, then download it (default)
  --latest-only    Skip create; download the newest existing dump only
  --no-open        Do not open the local folder in Finder
  -h, --help       Show this help

Env overrides:
  VM_USER     SSH user (default: adminprms98)
  VM_HOST     SSH host (default: 101.50.86.169)
  REMOTE_REPO Repo folder under ~ on the VM (default: PRMSC-ENS-MRV)
  LOCAL_DIR   Mac destination (default: ~/Downloads/prmsc-backups)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --create)
      CREATE_BACKUP=1
      shift
      ;;
    --latest-only)
      CREATE_BACKUP=0
      shift
      ;;
    --no-open)
      OPEN_FINDER=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -n "${SSH_CONNECTION:-}" ]]; then
  echo "This script must run on your Mac, not inside SSH on the VM." >&2
  echo "Exit SSH (type: exit) and run it from a local terminal." >&2
  exit 1
fi

mkdir -p "$LOCAL_DIR"

if [[ "$CREATE_BACKUP" -eq 1 ]]; then
  echo "Creating fresh dump on $VM ..."
  ssh "$VM" "cd ~/${REMOTE_REPO} && ./deploy/scripts/backup-postgres.sh"
  echo ""
fi

echo "Finding latest dump on $VM ..."
LATEST=$(
  ssh "$VM" "ls -1t ~/${REMOTE_REPO}/backups/prmsc_mrv_*.dump 2>/dev/null | head -1" || true
)

if [[ -z "$LATEST" ]]; then
  echo "No dump found on VM." >&2
  if [[ "$CREATE_BACKUP" -eq 0 ]]; then
    echo "Re-run without --latest-only to create one, or SSH in and run:" >&2
    echo "  cd ~/${REMOTE_REPO} && ./deploy/scripts/backup-postgres.sh" >&2
  fi
  exit 1
fi

BASENAME="$(basename "$LATEST")"
DEST="${LOCAL_DIR}/${BASENAME}"

echo "Downloading: $LATEST"
echo "         to: $DEST"
scp "${VM}:${LATEST}" "$DEST"

echo ""
echo "Saved:"
ls -lh "$DEST"

echo ""
echo "Recent files in $LOCAL_DIR:"
ls -lht "$LOCAL_DIR" | head -6

if [[ "$OPEN_FINDER" -eq 1 ]] && command -v open >/dev/null 2>&1; then
  open "$LOCAL_DIR"
fi
