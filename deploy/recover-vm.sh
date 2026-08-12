#!/usr/bin/env bash
# Run from Mac (repo root) after SSH works: ./deploy/recover-vm.sh
#
# Prerequisites:
#   ssh prmsc101@101.50.87.168   # must work (key in agent or password)
#
# Optional env:
#   PRMSC_SSH_HOST=101.50.87.168
#   PRMSC_SSH_USER=prmsc101
#   PRMSC_DUMP=backups/prmsc_mrv_20260810_073432.dump

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOST="${PRMSC_SSH_HOST:-101.50.87.168}"
USER="${PRMSC_SSH_USER:-prmsc101}"
DUMP="${PRMSC_DUMP:-backups/prmsc_mrv_20260810_073432.dump}"
ORIGIN="http://${HOST}"
REPO_URL="${PRMSC_REPO_URL:-https://github.com/adminprmsc/PRMSC-ENS-MRV.git}"
REMOTE_DIR="${PRMSC_REMOTE_DIR:-PRMSC-ENS-MRV}"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
if [[ -n "${PRMSC_SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "$PRMSC_SSH_KEY")
fi

ssh_cmd() { ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" "$@"; }

if [[ ! -f "$DUMP" ]]; then
  echo "Missing dump: $DUMP" >&2
  exit 1
fi

echo "=== 1/4 Test SSH to ${USER}@${HOST} ==="
ssh_cmd "echo SSH_OK"

echo "=== 2/4 Copy DB dump ($(basename "$DUMP")) ==="
ssh_cmd "mkdir -p ~/${REMOTE_DIR}"
scp "${SSH_OPTS[@]}" "$DUMP" "${USER}@${HOST}:~/${REMOTE_DIR}/prmsc_backup.dump"

echo "=== 3/4 Install Docker + clone repo (may ask VM sudo password) ==="
ssh_cmd bash -s <<EOF
set -euo pipefail
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "\$USER"
fi
if [[ ! -d ~/${REMOTE_DIR}/.git ]]; then
  git clone ${REPO_URL} ~/${REMOTE_DIR}
fi
cd ~/${REMOTE_DIR}
git fetch origin main
git checkout main
git pull --ff-only origin main || true
chmod +x deploy/setup.sh deploy/scripts/*.sh deploy/recover-vm.sh 2>/dev/null || true
EOF

echo "=== 4/4 Restore DB + start stack (10–20 min first build) ==="
ssh_cmd "cd ~/${REMOTE_DIR} && PUBLIC_ORIGIN=${ORIGIN} ./deploy/setup.sh"

echo ""
echo "=== Done ==="
echo "App: ${ORIGIN}/"
echo "Health: curl -s ${ORIGIN}/api/health"
