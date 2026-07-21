# PRMSC-MRV — VM operations guide

Day-to-day commands for the production server. For first-time setup, see [README.md](./README.md).

| Item               | Value                        |
| ------------------ | ---------------------------- |
| **VM IP**          | `101.50.86.169`              |
| **SSH user**       | `adminprms98`                |
| **App URL**        | http://101.50.86.169         |
| **Repo on server** | `~/PRMSC-ENS-MRV`            |
| **Env file**       | `.env.docker` (never commit) |

All `docker compose` commands below assume you are in the repo root and use `.env.docker`.

---

## Quick reference

```bash
cd ~/PRMSC-ENS-MRV
export DC="docker compose --env-file .env.docker"
```

Use `$DC` instead of typing the full compose command each time.

---

## 1. Connect to the VM

From your laptop:

```bash
ssh adminprms98@101.50.86.169
```

Then go to the project:

```bash
cd ~/PRMSC-ENS-MRV
```

---

## 2. Deploy latest changes

Pull code and rebuild containers:

```bash
cd ~/PRMSC-ENS-MRV
git pull origin main
docker compose --env-file .env.docker up -d --build
```

Watch the build if needed:

```bash
docker compose --env-file .env.docker up -d --build 2>&1 | tee /tmp/deploy.log
```

Verify after deploy:

```bash
curl -s http://localhost/api/health
docker compose --env-file .env.docker ps
```

Open in browser: **http://101.50.86.169/**

### Deploy a single service

Rebuild only the backend (faster when only API changed):

```bash
docker compose --env-file .env.docker up -d --build backend
```

Rebuild only the frontend:

```bash
docker compose --env-file .env.docker up -d --build frontend
```

**After changing `deploy/nginx/default.conf`** (upload size, timeouts), reload or recreate nginx — a bind-mounted config file does not apply until nginx restarts:

```bash
docker compose --env-file .env.docker exec nginx nginx -s reload
# or, if reload fails:
docker compose --env-file .env.docker up -d --force-recreate nginx
```

Confirm the live limit:

```bash
docker compose --env-file .env.docker exec nginx nginx -T 2>/dev/null | grep client_max_body_size
# expect: client_max_body_size 210m;
```

Restart without rebuild (e.g. after editing `.env.docker`):

```bash
docker compose --env-file .env.docker up -d
```

---

## 3. Check container status

List all services:

```bash
docker compose --env-file .env.docker ps
```

Expected containers (all **running**):

| Container        | Service             |
| ---------------- | ------------------- |
| `prmsc-postgres` | Database            |
| `prmsc-backend`  | NestJS API          |
| `prmsc-frontend` | React SPA           |
| `prmsc-nginx`    | Reverse proxy (:80) |

Detailed status:

```bash
docker compose --env-file .env.docker ps -a
docker stats --no-stream
```

---

## 4. Logs

### Backend (API)

Follow live logs:

```bash
docker compose --env-file .env.docker logs -f backend
```

Last 100 lines (no follow):

```bash
docker compose --env-file .env.docker logs --tail 100 backend
```

Logs since last 30 minutes:

```bash
docker compose --env-file .env.docker logs --since 30m backend
```

### Database (Postgres)

```bash
docker compose --env-file .env.docker logs -f postgres
```

Or:

```bash
docker compose --env-file .env.docker logs --tail 100 postgres
```

### Nginx (web / API proxy)

```bash
docker compose --env-file .env.docker logs -f nginx
```

### Frontend

```bash
docker compose --env-file .env.docker logs -f frontend
```

### All services

```bash
docker compose --env-file .env.docker logs -f
```

Press **Ctrl+C** to stop following logs.

---

## 5. Check database data

### Open an interactive SQL shell

```bash
docker compose --env-file .env.docker exec -it postgres \
  psql -U prmsc -d prmsc_mrv
```

Inside `psql`:

```sql
\dt                          -- list tables
\q                           -- quit
```

### One-off queries (no interactive shell)

Row counts (sanity check):

```bash
docker compose --env-file .env.docker exec -T postgres \
  psql -U prmsc -d prmsc_mrv -c "SELECT COUNT(*) AS users FROM users;"

docker compose --env-file .env.docker exec -T postgres \
  psql -U prmsc -d prmsc_mrv -c "SELECT COUNT(*) AS submissions FROM submissions;"
```

Recent users:

```bash
docker compose --env-file .env.docker exec -T postgres \
  psql -U prmsc -d prmsc_mrv -c \
  "SELECT id, email, created_at FROM users ORDER BY id DESC LIMIT 10;"
```

Recent submissions:

```bash
docker compose --env-file .env.docker exec -T postgres \
  psql -U prmsc -d prmsc_mrv -c \
  "SELECT id, status, created_at FROM submissions ORDER BY id DESC LIMIT 10;"
```

List all tables:

```bash
docker compose --env-file .env.docker exec -T postgres \
  psql -U prmsc -d prmsc_mrv -c \
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

Check migrations table:

```bash
docker compose --env-file .env.docker exec -T postgres \
  psql -U prmsc -d prmsc_mrv -c "SELECT * FROM migrations ORDER BY id;"
```

Database size:

```bash
docker compose --env-file .env.docker exec -T postgres \
  psql -U prmsc -d prmsc_mrv -c \
  "SELECT pg_size_pretty(pg_database_size('prmsc_mrv')) AS db_size;"
```

### Is Postgres healthy?

```bash
docker compose --env-file .env.docker exec -T postgres \
  pg_isready -U prmsc -d prmsc_mrv
```

---

## 6. Backups

Create a backup on the VM:

```bash
cd ~/PRMSC-ENS-MRV
./deploy/scripts/backup-postgres.sh
```

Output goes to `backups/prmsc_mrv_YYYYMMDD_HHMMSS.dump`.

List backups:

```bash
ls -lh backups/
```

Copy a backup to your laptop (run on **laptop**, not VM):

```bash
scp adminprms98@101.50.86.169:~/PRMSC-ENS-MRV/backups/prmsc_mrv_*.dump ./backups/
```

---

## 7. Restart / stop

Restart everything:

```bash
docker compose --env-file .env.docker restart
```

Restart one service:

```bash
docker compose --env-file .env.docker restart backend
```

Stop stack (data kept):

```bash
docker compose --env-file .env.docker down
```

Start again:

```bash
docker compose --env-file .env.docker up -d
```

> **Warning:** `docker compose down -v` deletes the database volume. Only use when intentionally wiping data.

---

## 8. Environment file

View non-secret settings:

```bash
grep -E '^(PUBLIC_ORIGIN|POSTGRES_USER|POSTGRES_DB|NGINX_HTTP_PORT|SUPABASE_URL)=' .env.docker
```

Edit env (then restart):

```bash
nano .env.docker
docker compose --env-file .env.docker up -d
```

| Variable                        | Notes                                |
| ------------------------------- | ------------------------------------ |
| `PUBLIC_ORIGIN`                 | Must match browser URL (drives CORS) |
| `POSTGRES_PASSWORD`             | Docker DB password                   |
| `SECRET_KEY` / `JWT_SECRET_KEY` | Changing JWT logs everyone out       |
| `SUPABASE_*`                    | File storage only (not the database) |

---

## 9. Health checks

```bash
# API via nginx
curl -s http://localhost/api/health

# From your laptop (if port 80 is open)
curl -s http://101.50.86.169/api/health
```

---

## 10. Common issues

| Symptom                  | What to run                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `502` on `/api`          | `docker compose --env-file .env.docker logs --tail 80 backend`                           |
| Postgres restart loop    | Usually PG version mismatch — see [README.md](./README.md); may need `down -v` + restore |
| Login fails after deploy | New `JWT_SECRET_KEY` — users must log in again                                           |
| CORS errors in browser   | Check `PUBLIC_ORIGIN=http://101.50.86.169` in `.env.docker`, rebuild backend             |
| Container not running    | `docker compose --env-file .env.docker ps -a` then `logs <service>`                      |
| Out of disk              | `df -h` and `docker system df`                                                           |

Free unused Docker images/build cache (safe on a tight VM):

```bash
docker system prune -f
```

---

## 11. Useful aliases (optional)

Add to `~/.bashrc` on the VM:

```bash
alias mrv='cd ~/PRMSC-ENS-MRV'
alias mrv-ps='docker compose --env-file ~/PRMSC-ENS-MRV/.env.docker ps'
alias mrv-logs='docker compose --env-file ~/PRMSC-ENS-MRV/.env.docker logs -f backend'
alias mrv-deploy='cd ~/PRMSC-ENS-MRV && git pull origin main && docker compose --env-file .env.docker up -d --build'
```

Reload:

```bash
source ~/.bashrc
```

Then:

```bash
mrv-deploy
mrv-ps
mrv-logs
```

---

## Related docs

- [README.md](./README.md) — first-time VM setup, Supabase migration, TLS
- [docs/DAILY-OPS.md](./docs/DAILY-OPS.md) — backup to Mac + daily deploy
- [../backend/docs/DOCKER.md](../backend/docs/DOCKER.md) — local Docker dev
