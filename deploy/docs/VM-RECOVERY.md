# VM disaster recovery — new Nayatel IAAS server

Use this when the production VM was lost and you need a **new server** with the **same app + database data**.

| What you need | Where to get it |
| --- | --- |
| **Database dump** | Mac `./backups/prmsc_mrv_*.dump` (from `./deploy/backup-db.sh`), or any teammate copy |
| **`.env.docker` from old prod** (recommended) | Password manager / old VM backup — keeps JWT + Supabase keys so users stay logged in and uploads work |
| **Git `main`** | GitHub, or a git bundle from a laptop |
| **New VM** | Nayatel IAAS — Ubuntu 22.04+ recommended, **port 80** open inbound |

Update placeholders below:

| Item | Old (lost VM) | New (fill in) |
| --- | --- | --- |
| VM IP | `101.50.86.169` | `<NEW_IP>` |
| SSH user | `adminprms98` | `<SSH_USER>` |
| App URL | `http://101.50.86.169` | `http://<NEW_IP>` |
| Repo path on VM | `~/PRMSC-ENS-MRV` | same |

---

## Phase 0 — Find your backup (do this first)

On any Mac that ran backups:

```bash
ls -lh ./backups/prmsc_mrv_*.dump
# or
ls -lh ~/Downloads/prmsc*.dump
```

Pick the **latest** file (non-zero size, typically tens of MB+).

If **no dump exists anywhere**, but legacy Supabase Postgres is still online:

- Get `SUPABASE_DATABASE_URL` from Supabase Dashboard → Database → URI
- On the new VM you can run `./deploy/setup.sh` with that URL (see Phase 4, option B)

**File uploads (meter photos, bills)** live in **Supabase Storage**, not in the Postgres dump. Keep the same `SUPABASE_*` values from production `.env.docker` if the Supabase project is unchanged.

---

## Phase 1 — Nayatel / VM basics

1. Create IAAS VM (Linux, 2+ vCPU, 4GB+ RAM, 40GB+ disk).
2. Create SSH user (or use provided admin account).
3. **Firewall:** allow inbound **TCP 80** (and 443 later if you add TLS).
4. Note the **public IP** → use as `PUBLIC_ORIGIN=http://<NEW_IP>`.

SSH test from Mac:

```bash
ssh <SSH_USER>@<NEW_IP>
```

---

## Phase 2 — Install Docker on the new VM

On the VM:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

---

## Phase 3 — Get application code on the VM

### Option A — Git clone (VM can reach GitHub)

```bash
cd ~
git clone https://github.com/<org>/PRMSC-MRV.git PRMSC-ENS-MRV
cd ~/PRMSC-ENS-MRV
git checkout main
git pull --ff-only origin main

chmod +x deploy/setup.sh deploy/scripts/*.sh deploy/backup-db.sh
```

### Option B — No GitHub from VM (git bundle from Mac)

On **Mac**:

```bash
cd /path/to/PRMSC-MRV
git fetch origin main
git bundle create /tmp/prmsc-main.bundle origin/main
scp /tmp/prmsc-main.bundle <SSH_USER>@<NEW_IP>:~/prmsc-main.bundle
```

On **VM**:

```bash
cd ~
git clone --bare /dev/null PRMSC-ENS-MRV 2>/dev/null || mkdir -p PRMSC-ENS-MRV && cd PRMSC-ENS-MRV && git init
cd ~/PRMSC-ENS-MRV
git fetch ~/prmsc-main.bundle refs/remotes/origin/main:refs/heads/main
git checkout main
chmod +x deploy/setup.sh deploy/scripts/*.sh
```

### Option C — No GitHub + build images on Mac (VM cannot pull Docker Hub)

Follow **Phase 5** after database restore.

---

## Phase 4 — Environment + database restore + start stack

### 4a — Create `.env.docker`

```bash
cd ~/PRMSC-ENS-MRV
cp .env.docker.example .env.docker
nano .env.docker
```

**Minimum for production:**

| Variable | Action |
| --- | --- |
| `PUBLIC_ORIGIN` | `http://<NEW_IP>` (no trailing slash) |
| `POSTGRES_PASSWORD` | Strong password (or **same as old prod** if you have it) |
| `SECRET_KEY` / `JWT_SECRET_KEY` | **Restore from old `.env.docker`** if possible; else new keys → all users must log in again |
| `SUPABASE_*` | **Same as old prod** so existing upload URLs work |

Or let `setup.sh` auto-generate secrets (only if you do not have the old file):

```bash
PUBLIC_ORIGIN=http://<NEW_IP> ./deploy/setup.sh
# stop after env is created if you want to edit .env.docker first
```

### 4b — Copy database dump to VM

On **Mac** (replace paths and IP):

```bash
scp ./backups/prmsc_mrv_20260810_120000.dump \
  <SSH_USER>@<NEW_IP>:~/PRMSC-ENS-MRV/prmsc_backup.dump
```

`setup.sh` looks for `prmsc_backup.dump` at the **repo root** by default.

Or copy into `backups/` and restore manually (Phase 4c).

### 4c — One-command setup (recommended)

On **VM**:

```bash
cd ~/PRMSC-ENS-MRV

# If dump is at repo root as prmsc_backup.dump:
PUBLIC_ORIGIN=http://<NEW_IP> ./deploy/setup.sh
```

This will: ensure `.env.docker` → start Postgres → **restore dump** → build & start all containers → wait for `/api/health`.

**If you already created `.env.docker` manually and only want restore + start:**

```bash
cd ~/PRMSC-ENS-MRV
docker compose --env-file .env.docker up -d postgres
./deploy/scripts/restore-from-supabase.sh ./backups/prmsc_mrv_YYYYMMDD_HHMMSS.dump
docker compose --env-file .env.docker up -d --build
```

### 4d — Option B: migrate from Supabase Postgres (no local dump)

```bash
cd ~/PRMSC-ENS-MRV
export SUPABASE_DATABASE_URL='postgresql://postgres.[ref]:[password]@...pooler.supabase.com:5432/postgres'
PUBLIC_ORIGIN=http://<NEW_IP> ./deploy/setup.sh
```

---

## Phase 5 — If VM cannot build (no Docker Hub / GitHub)

After **database is restored** and `.env.docker` exists:

### Mac — build and upload images

```bash
cd /path/to/PRMSC-MRV
git checkout main
docker compose --env-file .env.docker build backend frontend
docker tag prmsc-mrv-backend:latest prmsc-ens-mrv-backend:latest
docker tag prmsc-mrv-frontend:latest prmsc-ens-mrv-frontend:latest
docker save prmsc-ens-mrv-backend:latest prmsc-ens-mrv-frontend:latest \
  | gzip > /tmp/prmsc-app-images.tar.gz
scp /tmp/prmsc-app-images.tar.gz <SSH_USER>@<NEW_IP>:~/
```

### VM — load images and start (postgres already running)

```bash
cd ~/PRMSC-ENS-MRV
gunzip -c ~/prmsc-app-images.tar.gz | docker load
docker compose --env-file .env.docker up -d --no-build
```

Nginx and postgres images still need to be available once (`postgres:17-alpine`, `nginx:1.27-alpine`) — pull on Mac and save if VM has no registry access.

---

## Phase 6 — Verify recovery

On VM:

```bash
cd ~/PRMSC-ENS-MRV
curl -fsS http://localhost/api/health && echo

docker compose --env-file .env.docker ps

docker compose --env-file .env.docker exec -T postgres \
  psql -U prmsc -d prmsc_mrv -c "SELECT COUNT(*) AS users FROM users;"

docker compose --env-file .env.docker exec -T postgres \
  psql -U prmsc -d prmsc_mrv -c "SELECT COUNT(*) AS submissions FROM submissions;"
```

From Mac browser: `http://<NEW_IP>/`

- Log in with a known operator / manager account
- Open a submission with an image (Supabase storage)
- Submit a test log if appropriate

---

## Phase 7 — Post-recovery (same day)

1. **Take a fresh backup** on the new VM:

```bash
cd ~/PRMSC-ENS-MRV
./deploy/scripts/backup-postgres.sh
```

2. **Pull copy to Mac:**

```bash
PRMSC_SSH_HOST=<NEW_IP> PRMSC_SSH_USER=<SSH_USER> \
  ./deploy/backup-db.sh --pull-only
```

3. **Update team docs** with new IP, SSH user, and `PUBLIC_ORIGIN`.
4. **Store `.env.docker` securely** (password manager, encrypted backup) — not in git.

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `502` on `/api` | `docker compose --env-file .env.docker logs backend` — wait for migrations |
| CORS errors in browser | `PUBLIC_ORIGIN` must match exact URL (http, IP, no trailing slash) |
| Everyone forced to re-login | Expected if `JWT_SECRET_KEY` changed — restore old key from backup `.env.docker` |
| Uploads/images 404 | Wrong `SUPABASE_*` keys or bucket — restore old env values |
| `pg_restore` warnings | Extension warnings (e.g. `supabase_vault`) are often OK |
| Empty DB after restore | Check dump size `ls -lh prmsc_backup.dump`; re-copy dump |
| Cannot `git pull` | Use git bundle (Phase 3B) |
| Cannot `docker build` | Use Mac image export (Phase 5) |

---

## Quick command summary

```bash
# Mac → copy dump
scp ./backups/prmsc_mrv_LATEST.dump <SSH_USER>@<NEW_IP>:~/PRMSC-ENS-MRV/prmsc_backup.dump

# VM → full setup
ssh <SSH_USER>@<NEW_IP>
cd ~/PRMSC-ENS-MRV
PUBLIC_ORIGIN=http://<NEW_IP> ./deploy/setup.sh

# Verify
curl -s http://localhost/api/health
```

---

## Related

- [DAILY-OPS.md](./DAILY-OPS.md) — routine backup & deploy
- [../README.md](../README.md) — first-time setup details
- [../VM-OPS.md](../VM-OPS.md) — logs, SQL, operations
