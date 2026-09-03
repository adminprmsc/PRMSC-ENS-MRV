#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Production DB backup: create on the VM first, then copy to this Mac.
#
# Two steps (you can also run them separately):
#   1. On the VM  →  ./deploy/scripts/backup-postgres.sh
#        (or: make db-backup  if `make` is installed)
#        writes ~/PRMSC-ENS-MRV/backups/prmsc_mrv_*.dump or prmsc-mrv-*.dump
#        (stays on the VM)
#   2. On your Mac →  this script (or --pull-only)
#        scp that file into ./backups/ on your laptop
#
# Usage (from your Mac, repo root):
#   make backup-to-mac
#   ./deploy/backup-db.sh
#   PRMSC_SSH_HOST=101.50.87.168 PRMSC_SSH_USER=prmsc101 PRMSC_SSH_PASSWORD_AUTH=1 ./deploy/backup-db.sh --pull-only
#   ./deploy/backup-db.sh --host 101.50.87.168 --user prmsc101 --password-auth --pull-only
#
# Optional env / flags:
#   PRMSC_SSH_HOST           VM hostname or IP       (default: 101.50.86.169)
#   PRMSC_SSH_USER           SSH user                (default: adminprms98)
#   PRMSC_SSH_PASSWORD_AUTH  Set to 1 for password-only SSH/scp (no pubkey)
#   PRMSC_SSH_KEY            Path to private key     (optional; password auth OK)
#   PRMSC_REMOTE_DIR         App directory on VM     (default: $HOME/PRMSC-ENS-MRV)
#   PRMSC_BACKUP_DIR         Local folder for dumps  (default: <repo>/backups)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SSH_HOST="${PRMSC_SSH_HOST:-101.50.86.169}"
SSH_USER="${PRMSC_SSH_USER:-adminprms98}"
SSH_KEY="${PRMSC_SSH_KEY:-}"
REMOTE_DIR="${PRMSC_REMOTE_DIR:-\$HOME/PRMSC-ENS-MRV}"
BACKUP_DIR="${PRMSC_BACKUP_DIR:-$ROOT_DIR/backups}"
PULL_ONLY=0
DELETE_REMOTE=0
PASSWORD_AUTH=0
if [[ "${PRMSC_SSH_PASSWORD_AUTH:-0}" == "1" ]]; then
  PASSWORD_AUTH=1
fi

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,28p' "$0" | sed 's/^# \?//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -H|--host)         SSH_HOST="$2"; shift 2 ;;
    -u|--user)         SSH_USER="$2"; shift 2 ;;
    -i|--identity)     SSH_KEY="$2"; shift 2 ;;
    -d|--remote-dir)   REMOTE_DIR="$2"; shift 2 ;;
    -o|--output)       BACKUP_DIR="$2"; shift 2 ;;
    --pull-only)       PULL_ONLY=1; shift ;;
    --password-auth)   PASSWORD_AUTH=1; shift ;;
    --delete-remote)   DELETE_REMOTE=1; shift ;;
    -h|--help)         usage ;;
    *) die "Unknown option: $1 (try --help)" ;;
  esac
done

[[ -n "$SSH_HOST" ]] || die "Set PRMSC_SSH_HOST or pass --host <ip>. Example:
  ./deploy/backup-db.sh --host 101.50.86.169"

if [[ -n "${SSH_CONNECTION:-}" ]]; then
  die "Run this on your Mac, not inside SSH on the VM.
  On the VM first:  cd ~/PRMSC-ENS-MRV && ./deploy/scripts/backup-postgres.sh
  Then exit SSH and run:  ./deploy/backup-db.sh --pull-only"
fi

command -v ssh >/dev/null 2>&1 || die "ssh is required"
command -v scp >/dev/null 2>&1 || die "scp is required"

if [[ -n "$SSH_KEY" ]]; then
  SSH_KEY="${SSH_KEY/#\~/$HOME}"
  [[ -f "$SSH_KEY" ]] || die "SSH key not found: $SSH_KEY"
fi

# Normalize ~/… so remote shell expands $HOME
case "$REMOTE_DIR" in
  ~/PRMSC-ENS-MRV|~/PRMSC-ENS-MRV/) REMOTE_DIR='$HOME/PRMSC-ENS-MRV' ;;
esac

mkdir -p "$BACKUP_DIR"

REMOTE="${SSH_USER}@${SSH_HOST}"

# macOS caps Unix socket paths ~104 chars; TMPDIR paths are often too long.
# %C is a short hash of the connection — keeps ControlPath under the limit.
CONTROL_PATH="/tmp/prmsc-ssh-%C"

cleanup() {
  ssh -O exit \
    -o ControlPath="$CONTROL_PATH" \
    "$REMOTE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=15
  -o ControlMaster=auto
  -o ControlPath="$CONTROL_PATH"
  -o ControlPersist=60
)

if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY" -o IdentitiesOnly=yes)
elif [[ "$PASSWORD_AUTH" -eq 1 ]]; then
  SSH_OPTS+=(
    -o PreferredAuthentications=password
    -o PubkeyAuthentication=no
  )
fi

log "Connecting to ${REMOTE} (enter password/passphrase once if prompted)..."
ssh "${SSH_OPTS[@]}" "$REMOTE" 'echo connected' >/dev/null \
  || die "SSH failed. Try: ssh ${REMOTE}"

REMOTE_REL=""
if [[ "$PULL_ONLY" -eq 1 ]]; then
  log "Step 1 skipped (--pull-only). Finding latest backup on VM..."
  REMOTE_REL="$(
    ssh "${SSH_OPTS[@]}" "$REMOTE" \
      "set -e; cd ${REMOTE_DIR}; ls -1t backups/prmsc-mrv-*.dump backups/prmsc_mrv_*.dump 2>/dev/null | head -1 || true"
  )"
  [[ -n "$REMOTE_REL" ]] || die "No backups found on VM under ${REMOTE_DIR}/backups/
  On the VM run first: cd ~/PRMSC-ENS-MRV && ./deploy/scripts/backup-postgres.sh"
else
  log "Step 1/2 — creating backup on the VM (./deploy/scripts/backup-postgres.sh)..."
  REMOTE_OUT="$(
    ssh "${SSH_OPTS[@]}" "$REMOTE" \
      "set -e; cd ${REMOTE_DIR}; ./deploy/scripts/backup-postgres.sh"
  )"
  printf '%s\n' "$REMOTE_OUT"
  REMOTE_REL="$(printf '%s\n' "$REMOTE_OUT" | sed -n 's/^CREATED://p' | tail -1)"
  [[ -n "$REMOTE_REL" ]] || die "VM backup finished but no CREATED: path was printed.
  On the VM check: cd ~/PRMSC-ENS-MRV && ./deploy/scripts/backup-postgres.sh"
fi

REMOTE_NAME="$(basename "$REMOTE_REL")"
OUT_FILE="$BACKUP_DIR/$REMOTE_NAME"

REMOTE_ABS="$(
  ssh "${SSH_OPTS[@]}" "$REMOTE" "cd ${REMOTE_DIR} && pwd"
)"
[[ -n "$REMOTE_ABS" ]] || die "Could not resolve remote app directory"

log "Step 2/2 — copying ${REMOTE_ABS}/${REMOTE_REL} → ${OUT_FILE}..."
scp "${SSH_OPTS[@]}" "${REMOTE}:${REMOTE_ABS}/${REMOTE_REL}" "$OUT_FILE" \
  || die "scp download failed"

BYTES="$(wc -c <"$OUT_FILE" | tr -d ' ')"
[[ "$BYTES" -ge 100 ]] || { rm -f "$OUT_FILE"; die "Downloaded backup empty (${BYTES} bytes)."; }

if [[ "$DELETE_REMOTE" -eq 1 ]]; then
  log "Removing VM copy (--delete-remote)..."
  ssh "${SSH_OPTS[@]}" "$REMOTE" "rm -f '${REMOTE_ABS}/${REMOTE_REL}'" || true
else
  log "VM copy kept at ${REMOTE_ABS}/${REMOTE_REL}"
fi

SIZE="$(du -h "$OUT_FILE" | awk '{print $1}')"
log "Local backup: ${OUT_FILE} (${SIZE})"
log "Done."
