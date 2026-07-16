# Daily ops — backup to Mac & deploy

Quick commands for day-to-day production work.

| Item               | Value                |
| ------------------ | -------------------- |
| **VM IP**          | `101.50.86.169`      |
| **SSH user**       | `adminprms98`        |
| **App URL**        | http://101.50.86.169 |
| **Repo on VM**     | `~/PRMSC-ENS-MRV`    |
| **Branch on prod** | `main`               |

For full ops (logs, SQL, troubleshooting), see [../VM-OPS.md](../VM-OPS.md).

---

## 1. Connect to the VM

From your **Mac**:

```bash
ssh adminprms98@101.50.86.169
```

Then:

```bash
cd ~/PRMSC-ENS-MRV
```

---

## 2. Take a DB backup on the VM, then copy it to your Mac

### Step A — create the dump (on the VM)

```bash
cd ~/PRMSC-ENS-MRV
./deploy/scripts/backup-postgres.sh
ls -lh backups/
```

File name looks like: `backups/prmsc_mrv_YYYYMMDD_HHMMSS.dump`

### Step B — download to your Mac (run on the Mac, not the VM)

> **zsh note:** quote the remote path so `*` is not expanded locally.

```bash
mkdir -p ~/Downloads/prmsc-backups

scp 'adminprms98@101.50.86.169:~/PRMSC-ENS-MRV/backups/prmsc_mrv_*.dump' ~/Downloads/prmsc-backups/
```

Download only the newest dump:

```bash
mkdir -p ~/Downloads/prmsc-backups

LATEST=$(ssh adminprms98@101.50.86.169 'ls -1t ~/PRMSC-ENS-MRV/backups/prmsc_mrv_*.dump | head -1')
scp "adminprms98@101.50.86.169:$LATEST" ~/Downloads/prmsc-backups/
```

Confirm on Mac:

```bash
ls -lh ~/Downloads/prmsc-backups/
```

---

## 3. Daily changes deployment

Production always deploys from **`main`**. Merge your feature branch into `main` first (PR or local merge), then deploy on the VM.

### On your Mac (before deploy)

1. Merge / push your work to `main` (via PR from `dev-` → `main`, or equivalent).
2. Confirm GitHub `main` has the commit you want.

### On the VM — deploy

```bash
ssh adminprms98@101.50.86.169
```

```bash
cd ~/PRMSC-ENS-MRV

# optional but recommended before a big release
./deploy/scripts/backup-postgres.sh

git pull origin main
docker compose --env-file .env.docker up -d --build
```

### Verify

```bash
curl -s http://localhost/api/health
docker compose --env-file .env.docker ps
```

Open: **http://101.50.86.169/**

### Faster rebuilds (when only one side changed)

Backend only:

```bash
docker compose --env-file .env.docker up -d --build backend
```

Frontend only:

```bash
docker compose --env-file .env.docker up -d --build frontend
```

---

## 4. One-liner cheat sheet

**SSH in**

```bash
ssh adminprms98@101.50.86.169
```

**Backup on VM + pull dump to Mac** (two terminals / two steps)

```bash
# VM
cd ~/PRMSC-ENS-MRV && ./deploy/scripts/backup-postgres.sh

# Mac
mkdir -p ~/Downloads/prmsc-backups && scp 'adminprms98@101.50.86.169:~/PRMSC-ENS-MRV/backups/prmsc_mrv_*.dump' ~/Downloads/prmsc-backups/
```

**Daily deploy on VM**

```bash
cd ~/PRMSC-ENS-MRV && git pull origin main && docker compose --env-file .env.docker up -d --build
```

Optional VM alias (same as in VM-OPS):

```bash
alias mrv-deploy='cd ~/PRMSC-ENS-MRV && git pull origin main && docker compose --env-file .env.docker up -d --build'
```

---

## Related

- [../VM-OPS.md](../VM-OPS.md) — full production operations
- [../README.md](../README.md) — first-time VM setup

cd ~/PRMSC-ENS-MRV
git pull origin main
docker compose --env-file .env.docker up -d --build
curl -s http://localhost/api/health

mkdir -p ~/Downloads/prmsc-backups

scp 'adminprms98@101.50.86.169:~/PRMSC-ENS-MRV/backups/prmsc*mrv*\*.dump' ~/Downloads/prmsc-backups/

ls -lh ~/Downloads/prmsc-backups/

zsh is expanding the \* on your Mac before scp runs. Quote the remote path, and run scp only from your Mac.

> **zsh note:** quote the remote path so `*` is not expanded locally.

```bash

# Mac
mkdir -p ~/Downloads/prmsc-backups && scp adminprms98@101.50.86.169:~/PRMSC-ENS-MRV/backups/prmsc_mrv_*.dump ~/Downloads/prmsc-backups/
mkdir -p ~/Downloads/prmsc-backups && scp 'adminprms98@101.50.86.169:~/PRMSC-ENS-MRV/backups/prmsc_mrv_*.dump' ~/Downloads/prmsc-backups/
```

Two separate issues:

Mac (zsh) — _ was expanded locally → quote the remote path
VM — scp must run on your Mac, not inside the SSH session
On your Mac only (terminal 6)
mkdir -p ~/Downloads/prmsc-backups
scp 'adminprms98@101.50.86.169:~/PRMSC-ENS-MRV/backups/prmsc*mrv*_.dump' ~/Downloads/prmsc-backups/
ls -lh ~/Downloads/prmsc-backups/
Or just the newest file:

mkdir -p ~/Downloads/prmsc-backups
LATEST=$(ssh adminprms98@101.50.86.169 'ls -1t ~/PRMSC-ENS-MRV/backups/prmsc_mrv_*.dump | head -1')
scp "adminprms98@101.50.86.169:$LATEST" ~/Downloads/prmsc-backups/
You can leave the VM SSH session open; download from a local Mac terminal.
