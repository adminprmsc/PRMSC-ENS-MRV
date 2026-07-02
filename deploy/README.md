# PRMSC-MRV deployment

> **Regular server use** (SSH, deploy, logs, DB checks): see **[VM-OPS.md](./VM-OPS.md)**.

Single Docker stack: **PostgreSQL + NestJS + React + Nginx**. Database is self-hosted in Docker; **Supabase is used only for file storage** (S3-compatible API). One env file (`.env.docker`), one compose file (`docker-compose.yml`).

```
Internet → Nginx (:80)
            ├─ /      → frontend (SPA)
            └─ /api/* → backend → postgres (Docker, internal)
                              └→ Supabase Storage (uploads/images only)
```

## VM setup (one command)

```bash
git clone <repo-url> ~/prmsc-mrv   # or /opt/prmsc-mrv
cd ~/prmsc-mrv

chmod +x deploy/setup.sh deploy/scripts/*.sh

# Migrate from Supabase (one-time only — if moving off Supabase Postgres):
export SUPABASE_DATABASE_URL='postgresql://postgres.[ref]:[password]@...pooler.supabase.com:5432/postgres'
PUBLIC_ORIGIN=http://101.50.86.169 ./deploy/setup.sh

# Or without migration (empty DB, migrations on first boot):
PUBLIC_ORIGIN=http://101.50.86.169 ./deploy/setup.sh
```

`setup.sh` will:

1. Check Docker is installed
2. Create `.env.docker` from `.env.docker.example` (auto-fill `PUBLIC_ORIGIN`, passwords, secrets)
3. One-time import from legacy Supabase Postgres if `SUPABASE_DATABASE_URL` is set (or restore `prmsc_backup.dump` if present)
4. Build and start all containers
5. Print the URL to open in the browser

Smoke test:

```bash
curl -s http://localhost/api/health
```

Open `http://<vm-ip>/` in the browser (ensure port **80** is open in Nayatel firewall).

### Install Docker (if needed)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

## Environment

Copy once (setup does this automatically):

```bash
cp .env.docker.example .env.docker
```

| Variable                        | Purpose                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `PUBLIC_ORIGIN`                 | URL users open (e.g. `http://101.50.86.169`) — drives CORS |
| `POSTGRES_PASSWORD`             | Database password                                          |
| `SECRET_KEY` / `JWT_SECRET_KEY` | App crypto — changing JWT forces re-login                  |
| `NGINX_HTTP_PORT`               | Usually `80`                                               |
| `SUPABASE_*`                    | **Storage only** — S3 keys for uploads (not the database)  |

Optional: SMTP for password reset — see comments in `.env.docker.example`.

## One-time: import data from legacy Supabase Postgres

Use this only when cutting over from an old Supabase-hosted database. Ongoing production uses Docker Postgres; Supabase remains for **file storage** only.

### On the VM (recommended)

Get the connection string from **Supabase Dashboard → Project Settings → Database → URI** (use the pooler or direct connection).

```bash
cd ~/prmsc-mrv
export SUPABASE_DATABASE_URL='postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
./deploy/scripts/migrate-from-supabase.sh
```

Or combine with full setup:

```bash
SUPABASE_DATABASE_URL='postgresql://...' PUBLIC_ORIGIN=http://101.50.86.169 ./deploy/setup.sh
```

The script dumps from Supabase, saves `prmsc_backup.dump` locally as a backup, and restores into Docker Postgres. A few `pg_restore` extension warnings are normal.

### Optional: dump on laptop only

```bash
./deploy/scripts/dump-from-supabase.sh
# then on VM: place prmsc_backup.dump in repo root and ./deploy/setup.sh
```

## Local laptop dev

Database + API in Docker; frontend via Vite on the host:

```bash
cp .env.docker.dev.example .env.docker

docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker up -d postgres backend

cd frontend && npm run dev
```

### Load Supabase data locally (`prmsc_backup.dump`)

Place `prmsc_backup.dump` in the repo root (same file used on the VM), then:

```bash
COMPOSE_OVERRIDE=docker-compose.dev.yml ./deploy/scripts/restore-from-supabase.sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker up -d backend
```

Verify:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker exec -T postgres \
  psql -U prmsc -d prmsc_mrv -c "SELECT COUNT(*) AS users FROM users;"
```

A few `supabase_vault` extension warnings during restore are normal and can be ignored.

## Updates

```bash
cd ~/prmsc-mrv
git pull
docker compose --env-file .env.docker up -d --build
```

## Backups

```bash
./deploy/scripts/backup-postgres.sh
```

Writes `backups/prmsc_mrv_YYYYMMDD_HHMMSS.dump` — copy off the VM regularly.

## TLS (HTTPS)

1. Point DNS to the VM.
2. Obtain certs (e.g. Let's Encrypt).
3. Place `fullchain.pem` and `privkey.pem` in `deploy/certs/`.
4. Uncomment HTTPS in `deploy/nginx/default.conf` and port `443` in `docker-compose.yml`.
5. Set `PUBLIC_ORIGIN=https://your-domain.pk` in `.env.docker`.
6. `docker compose --env-file .env.docker up -d --build`

## Troubleshooting

| Issue                      | Fix                                                 |
| -------------------------- | --------------------------------------------------- |
| `CORS_ORIGINS is required` | Set `PUBLIC_ORIGIN` in `.env.docker`                |
| Empty data / 401           | Re-login after new `JWT_SECRET_KEY`                 |
| `502` on `/api`            | `docker compose logs backend` — wait for migrations |
| Restore fails              | `ls -lh prmsc_backup.dump` — must be non-zero       |

## Files

| File                                      | Purpose                                   |
| ----------------------------------------- | ----------------------------------------- |
| `.env.docker.example`                     | Single env template                       |
| `docker-compose.yml`                      | Full stack (VM)                           |
| `docker-compose.dev.yml`                  | Local dev ports + skip nginx/frontend     |
| `deploy/setup.sh`                         | VM bootstrap                              |
| `deploy/VM-OPS.md`                        | **Day-to-day VM ops** (SSH, deploy, logs) |
| `deploy/scripts/migrate-from-supabase.sh` | Dump from Supabase + restore locally (VM) |
| `deploy/scripts/dump-from-supabase.sh`    | Dump only (optional laptop backup)        |
| `deploy/scripts/restore-from-supabase.sh` | Restore existing `.dump` file             |
| `deploy/scripts/backup-postgres.sh`       | Postgres backup                           |
