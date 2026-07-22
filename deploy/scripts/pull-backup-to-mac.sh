#!/usr/bin/env bash
# Download the latest Postgres dump from the production VM to this Mac.
#
# Run from your Mac — NOT from inside an SSH session on the VM.
#
# Usage:
#   ./deploy/scripts/pull-backup-to-mac.sh
#   VM_HOST=101.50.86.169 ./deploy/scripts/pull-backup-to-mac.sh

set -euo pipefail

VM_USER="${VM_USER:-adminprms98}"
VM_HOST="${VM_HOST:-101.50.86.169}"
VM="${VM_USER}@${VM_HOST}"
REMOTE_REPO="${REMOTE_REPO:-PRMSC-ENS-MRV}"
LOCAL_DIR="${LOCAL_DIR:-$HOME/Downloads/prmsc-backups}"

if [[ -n "${SSH_CONNECTION:-}" ]]; then
  echo "This script must run on your Mac, not inside SSH on the VM." >&2
  echo "Exit SSH (type: exit) and run it from a local terminal." >&2
  exit 1
fi

mkdir -p "$LOCAL_DIR"

echo "Finding latest dump on $VM ..."
LATEST=$(
  ssh "$VM" "ls -1t ~/${REMOTE_REPO}/backups/prmsc_mrv_*.dump 2>/dev/null | head -1" || true
)

if [[ -z "$LATEST" ]]; then
  echo "No dump found on VM." >&2
  echo "SSH in and run: cd ~/${REMOTE_REPO} && ./deploy/scripts/backup-postgres.sh" >&2
  exit 1
fi

echo "Downloading: $LATEST"
scp "${VM}:${LATEST}" "$LOCAL_DIR/"

echo ""
echo "Saved to $LOCAL_DIR:"
ls -lht "$LOCAL_DIR" | head -6

if command -v open >/dev/null 2>&1; then
  open "$LOCAL_DIR"
fi
