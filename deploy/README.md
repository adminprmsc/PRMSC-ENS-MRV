# Nayatel VM production deployment

Full Docker stack: **PostgreSQL + NestJS API + React SPA + Nginx**.

Users hit a single origin; Nginx routes `/` → frontend and `/api` → backend (**no CORS issues**).

## Architecture

```
Internet → Nginx (:80/:443)
            ├─ /      → frontend (static SPA)
            └─ /api/* → backend (NestJS :5001)
                         └─ postgres (internal only)
```

## Quick start on the VM

```bash
# 1. Clone
sudo mkdir -p /opt/prmsc-mrv && sudo chown "$USER" /opt/prmsc-mrv
git clone <repo-url> /opt/prmsc-mrv
cd /opt/prmsc-mrv

# 2. Configure secrets
cp .env.docker.production.example .env.docker
nano .env.docker   # set PUBLIC_ORIGIN, POSTGRES_PASSWORD, SECRET_KEY, JWT_SECRET_KEY

# 3. Migrate data from Supabase (see below), then start everything
chmod +x deploy/scripts/*.sh
./deploy/scripts/restore-from-supabase.sh   # if prmsc_backup.dump is present

docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build

# 4. Smoke test
curl -s http://localhost/api/health
curl -s http://localhost/ | head
```

Set `PUBLIC_ORIGIN` to the exact URL users open in the browser, e.g. `http://203.0.113.10` or `https://mrv.your-domain.pk` (no trailing slash).

## Files

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production stack (postgres, backend, frontend, nginx) |
| `.env.docker.production.example` | Production env template |
| `frontend/Dockerfile` | Vite build + nginx static server |
| `deploy/nginx/default.conf` | Edge reverse proxy |
| `deploy/scripts/dump-from-supabase.sh` | Create dump from Supabase (laptop) |
| `deploy/scripts/restore-from-supabase.sh` | Restore dump on VM |
| `deploy/scripts/backup-postgres.sh` | Daily backup helper |

Local dev (Postgres + backend only) still uses `docker-compose.yml` — see `backend/docs/DOCKER.md`.

## Data migration from Supabase

### On your laptop

```bash
export SUPABASE_DATABASE_URL='postgresql://postgres.[ref]:[password]@...pooler.supabase.com:5432/postgres'
./deploy/scripts/dump-from-supabase.sh
scp prmsc_backup.dump user@<vm-ip>:/opt/prmsc-mrv/
```

Supabase runs PostgreSQL **17** — the script uses `postgres:17-alpine` for `pg_dump`.

### On the VM

```bash
cd /opt/prmsc-mrv
cp .env.docker.production.example .env.docker
# edit .env.docker

./deploy/scripts/restore-from-supabase.sh
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build
```

A few extension warnings during `pg_restore` are normal and can be ignored.

## CORS / API URL

- Frontend is built with `VITE_API_URL=/api` (relative, same origin).
- Backend `CORS_ORIGINS` must equal `PUBLIC_ORIGIN` from `.env.docker`.
- Do **not** expose backend port `5001` publicly — only Nginx.

After cutover, users must **log in again** (new `JWT_SECRET_KEY` invalidates old tokens).

## TLS (HTTPS)

1. Point DNS `A` record to the VM IP.
2. Obtain certificates (Let's Encrypt example):

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d mrv.your-domain.pk
sudo cp /etc/letsencrypt/live/mrv.your-domain.pk/fullchain.pem deploy/certs/
sudo cp /etc/letsencrypt/live/mrv.your-domain.pk/privkey.pem deploy/certs/
```

3. Uncomment the HTTPS `server` block in `deploy/nginx/default.conf`.
4. Uncomment port `443` in `docker-compose.prod.yml`.
5. Set `PUBLIC_ORIGIN=https://mrv.your-domain.pk` in `.env.docker`.
6. `docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build`

## File uploads (storage)

Database is self-hosted; **images** may still live on Supabase Storage URLs in existing rows.

Phase 1: keep Supabase S3 env vars in `.env.docker` (see `.env.docker.production.example`).

Phase 2 (optional): add MinIO on the VM and migrate objects.

## Backups

```bash
./deploy/scripts/backup-postgres.sh
# writes backups/prmsc_mrv_YYYYMMDD_HHMMSS.dump
```

Copy backups off the VM regularly.

## Updates

```bash
cd /opt/prmsc-mrv
git pull
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build
```

## Mobile operator app

Update the mobile API base URL to the same public origin (`https://mrv.your-domain.pk/api` or VM IP) before decommissioning Vercel.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `CORS_ORIGINS is required` | Set `PUBLIC_ORIGIN` in `.env.docker`; ensure `NODE_ENV=production` |
| Empty submissions / 401 | Re-login; JWT secret changed |
| `502` on `/api` | `docker compose logs backend`; wait for migrations |
| Frontend 404 on refresh | Edge nginx proxies to frontend container (SPA `try_files` is in `frontend/nginx.conf`) |
| Restore fails | Confirm dump is non-zero: `ls -lh prmsc_backup.dump` |

## Cutover checklist

- [ ] VM provisioned with Docker
- [ ] `.env.docker` secrets set
- [ ] Final Supabase dump + restore
- [ ] Full stack up, smoke tests pass
- [ ] DNS + TLS
- [ ] Mobile app API URL updated
- [ ] Users notified (re-login)
- [ ] Supabase/Vercel decommissioned after monitoring period
