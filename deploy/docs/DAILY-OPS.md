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

**Recommended: two steps** — backup on prod first, then pull to Mac.

### Which terminal am I in?

| Prompt looks like | You are on | What to run |
| --- | --- | --- |
| `adminprms98@prmsc-ens-mrv:~$` | **VM (SSH)** | `./deploy/scripts/backup-postgres.sh` |
| `➜  PRMSC-MRV` or `aubairakif@...` | **Mac** | `./deploy/scripts/pull-backup-to-mac.sh` |

If you run the Mac pull script while still SSH’d into the VM, it will refuse and tell you to exit first.

### Step A — VM (create the dump)

```bash
ssh adminprms98@101.50.86.169
cd ~/PRMSC-ENS-MRV
./deploy/scripts/backup-postgres.sh
ls -lh backups/
```

You should see a new file like `prmsc_mrv_20260729_110224.dump` (~400KB–1MB is normal — custom format is compressed).

Then leave the VM:

```bash
exit
```

### Step B — Mac (copy that dump here)

From your **Mac** project folder:

```bash
cd /Users/aubairakif/Codebases/PRMSC-HO/MRV-NAYATEL/code/PRMSC-MRV
./deploy/scripts/pull-backup-to-mac.sh
```

This downloads the newest dump from the VM to `~/Downloads/prmsc-backups/` and reveals it in Finder.

Optional one-shot from Mac only (creates dump via SSH, then downloads):

```bash
./deploy/scripts/pull-backup-to-mac.sh --create
```

### Manual scp (if you prefer)

```bash
mkdir -p ~/Downloads/prmsc-backups

LATEST=$(ssh adminprms98@101.50.86.169 'ls -1t ~/PRMSC-ENS-MRV/backups/prmsc_mrv_*.dump | head -1')
echo "Downloading: $LATEST"
scp "adminprms98@101.50.86.169:$LATEST" ~/Downloads/prmsc-backups/
```

You should see today’s file under `~/Downloads/prmsc-backups/`.

---

## 3. Daily changes deployment

Production always deploys from **`main`**. Merge your feature branch into `main` first (PR or local merge), then deploy on the VM.

### On your Mac (before deploy)

1. Merge / push your work to `main` (via PR from `dev-` → `main`, or equivalent).
2. Confirm GitHub `main` has the commit you want:

```bash
git fetch origin main
git log -1 --oneline origin/main
```

### On the VM — deploy (normal path)

Use this when the VM can reach GitHub **and** Docker Hub:

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

### On the VM — deploy when GitHub / Docker Hub DNS fails

If you see errors like:

- `Could not resolve host: github.com`
- `lookup registry-1.docker.io ... i/o timeout`

the VM has no working outbound DNS. Use the **Mac → VM bundle + local rebuild** path below (or fix DNS, then use the normal path).

#### A. Mac — create and upload a git bundle of `main`

```bash
cd /path/to/PRMSC-MRV
git fetch origin main
git bundle create /tmp/prmsc-main.bundle origin/main
git bundle list-heads /tmp/prmsc-main.bundle
# expect a line ending in: refs/remotes/origin/main

scp /tmp/prmsc-main.bundle adminprms98@101.50.86.169:~/prmsc-main.bundle
```

#### B. VM — apply the bundle (use this exact fetch ref)

```bash
cd ~/PRMSC-ENS-MRV

./deploy/scripts/backup-postgres.sh

# stash local VM-only edits if git complains
git stash push -u -m "vm-local" || true

# IMPORTANT: the bundle ref is refs/remotes/origin/main (not plain "main")
git fetch ~/prmsc-main.bundle refs/remotes/origin/main:refs/remotes/bundle/main
git merge --ff-only bundle/main
git log -1 --oneline
# expect the same commit as origin/main on your Mac
```

#### C. VM — rebuild using **cached** base images (no Docker Hub pull)

If `node:22-alpine` (and other bases) were pulled on a previous successful deploy, skip registry metadata lookups:

```bash
cd ~/PRMSC-ENS-MRV
DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 \
  docker compose --env-file .env.docker build --pull=false
docker compose --env-file .env.docker up -d
```

If that still fails looking up `registry-1.docker.io`, the base image is not
cached on the VM. **Build images on the Mac and load them on the VM** (no Docker Hub needed on the server):

#### D. Mac — build & upload app images

```bash
cd /path/to/PRMSC-MRV
git fetch origin main && git checkout main && git pull   # or stay on the commit you deployed

docker compose --env-file .env.docker build backend frontend
docker tag prmsc-mrv-backend:latest prmsc-ens-mrv-backend:latest
docker tag prmsc-mrv-frontend:latest prmsc-ens-mrv-frontend:latest
docker save prmsc-ens-mrv-backend:latest prmsc-ens-mrv-frontend:latest \
  | gzip > /tmp/prmsc-app-images.tar.gz

scp /tmp/prmsc-app-images.tar.gz adminprms98@101.50.86.169:~/prmsc-app-images.tar.gz
```

#### E. VM — load images and recreate containers (no `--build`)

```bash
cd ~/PRMSC-ENS-MRV
gunzip -c ~/prmsc-app-images.tar.gz | docker load
docker compose --env-file .env.docker up -d --force-recreate --no-build backend frontend
docker compose --env-file .env.docker ps
curl -s http://localhost/api/health
```

Containers should show **Created** / **Up** as *just now*, not “3 days ago”.

### Verify

```bash
curl -s http://localhost/api/health
docker compose --env-file .env.docker ps
git log -1 --oneline
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

**Backup on VM, then pull to Mac**

```bash
# Terminal A — VM
ssh adminprms98@101.50.86.169
cd ~/PRMSC-ENS-MRV && ./deploy/scripts/backup-postgres.sh
exit

# Terminal B — Mac
./deploy/scripts/pull-backup-to-mac.sh
```

**Daily deploy on VM (normal DNS)**

```bash
cd ~/PRMSC-ENS-MRV && git pull origin main && docker compose --env-file .env.docker up -d --build
```

**Daily deploy on VM (no GitHub DNS — after Mac uploaded bundle)**

```bash
cd ~/PRMSC-ENS-MRV \
  && git fetch ~/prmsc-main.bundle refs/remotes/origin/main:refs/remotes/bundle/main \
  && git merge --ff-only bundle/main \
  && DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 docker compose --env-file .env.docker build --pull=false \
  && docker compose --env-file .env.docker up -d
```

Optional VM alias (same as in VM-OPS):

```bash
alias mrv-deploy='cd ~/PRMSC-ENS-MRV && git pull origin main && docker compose --env-file .env.docker up -d --build'
```

---

## Related

- [../VM-OPS.md](../VM-OPS.md) — full production operations
- [../README.md](../README.md) — first-time VM setup
