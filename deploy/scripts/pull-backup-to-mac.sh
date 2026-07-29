#!/usr/bin/env bash
# Copy the latest Postgres dump from the production VM to this Mac.
#
# Recommended flow (two steps):
#   1) On the VM:  cd ~/PRMSC-ENS-MRV && ./deploy/scripts/backup-postgres.sh
#   2) On the Mac: ./deploy/scripts/pull-backup-to-mac.sh
#
# Run this script from your Mac — NOT from inside an SSH session on the VM.
#
# Usage:
#   ./deploy/scripts/pull-backup-to-mac.sh
#   ./deploy/scripts/pull-backup-to-mac.sh --create   # optional: create dump on VM via SSH, then download
#   VM_HOST=101.50.86.169 LOCAL_DIR=~/Downloads/prmsc-backups ./deploy/scripts/pull-backup-to-mac.sh

set -euo pipefail

VM_USER="${VM_USER:-adminprms98}"
VM_HOST="${VM_HOST:-101.50.86.169}"
VM="${VM_USER}@${VM_HOST}"
REMOTE_REPO="${REMOTE_REPO:-PRMSC-ENS-MRV}"
LOCAL_DIR="${LOCAL_DIR:-$HOME/Downloads/prmsc-backups}"
CREATE_BACKUP=0
OPEN_FINDER=1

usage() {
  cat <<'EOF'
Usage: pull-backup-to-mac.sh [options]

Recommended:
  1) On VM:  cd ~/PRMSC-ENS-MRV && ./deploy/scripts/backup-postgres.sh
  2) On Mac: ./deploy/scripts/pull-backup-to-mac.sh

Options:
  (default)        Download the newest existing dump from the VM
  --create         Create a fresh dump on the VM via SSH, then download it
  --no-open        Do not open the dump in Finder
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
      # Kept for backwards compatibility; this is already the default.
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
  echo "" >&2
  echo "On the VM, take the backup first:" >&2
  echo "  cd ~/${REMOTE_REPO} && ./deploy/scripts/backup-postgres.sh" >&2
  echo "" >&2
  echo "Then exit SSH (type: exit) and on your Mac run:" >&2
  echo "  ./deploy/scripts/pull-backup-to-mac.sh" >&2
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
  echo "Take a backup on the VM first, then re-run this script:" >&2
  echo "  ssh ${VM}" >&2
  echo "  cd ~/${REMOTE_REPO} && ./deploy/scripts/backup-postgres.sh" >&2
  echo "  exit" >&2
  echo "  ./deploy/scripts/pull-backup-to-mac.sh" >&2
  exit 1
fi

BASENAME="$(basename "$LATEST")"
DEST="${LOCAL_DIR}/${BASENAME}"

echo "Downloading: $LATEST"
echo "         to: $DEST"
scp "${VM}:${LATEST}" "$DEST"

echo ""
echo "Saved: $DEST"
ls -lh "$DEST" || true

# Directory listing can fail under macOS TCC (e.g. Cursor terminal → ~/Downloads).
if ls -lht "$LOCAL_DIR" >/dev/null 2>&1; then
  echo ""
  echo "Recent files in $LOCAL_DIR:"
  ls -lht "$LOCAL_DIR" | head -6
else
  echo ""
  echo "(Could not list $LOCAL_DIR — macOS privacy; the dump above is still saved.)"
fi

if [[ "$OPEN_FINDER" -eq 1 ]] && command -v open >/dev/null 2>&1; then
  open -R "$DEST" 2>/dev/null || open "$LOCAL_DIR" 2>/dev/null || true
fi
