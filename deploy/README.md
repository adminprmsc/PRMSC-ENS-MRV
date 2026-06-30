# PRMSC-MRV deployment

Single Docker stack: **PostgreSQL + NestJS + React + Nginx**. One env file (`.env.docker`), one compose file (`docker-compose.yml`).

```
Internet → Nginx (:80)
            ├─ /      → frontend (SPA)
            └─ /api/* → backend → postgres (internal)
```

## VM setup (one command)

```bash
git clone <repo-url> ~/prmsc-mrv   # or /opt/prmsc-mrv
cd ~/prmsc-mrv

# Copy Supabase dump here if you have it (optional but recommended):
# scp prmsc_backup.dump adminprms98@101.50.86.169:~/prmsc-mrv/

chmod +x deploy/setup.sh deploy/scripts/*.sh
./deploy/setup.sh
```

`setup.sh` will:

1. Check Docker is installed
2. Create `.env.docker` from `.env.docker.example` (auto-fill `PUBLIC_ORIGIN`, passwords, secrets)
3. Restore `prmsc_backup.dump` if present
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

| Variable | Purpose |
|----------|---------|
| `PUBLIC_ORIGIN` | URL users open (e.g. `http://101.50.86.169`) — drives CORS |
| `POSTGRES_PASSWORD` | Database password |
| `SECRET_KEY` / `JWT_SECRET_KEY` | App crypto — changing JWT forces re-login |
| `NGINX_HTTP_PORT` | Usually `80` |

Optional: Supabase S3 vars for existing uploaded images, SMTP for password reset — see comments in `.env.docker.example`.

## Migrate data from Supabase

### On your laptop

```bash
export SUPABASE_DATABASE_URL='postgresql://postgres.[ref]:[password]@...pooler.supabase.com:5432/postgres'
./deploy/scripts/dump-from-supabase.sh
scp prmsc_backup.dump adminprms98@<vm-ip>:~/prmsc-mrv/
```

### On the VM

```bash
cd ~/prmsc-mrv
./deploy/setup.sh
```

A few `pg_restore` extension warnings are normal.

## Local laptop dev

Database + API in Docker; frontend via Vite on the host:

```bash
cp .env.docker.example .env.docker
# edit secrets or leave CHANGE_ME for local-only

docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker up -d postgres backend

cd backend && npm run start:dev    # or use Docker backend on :5001
cd frontend && npm run dev
```

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

| Issue | Fix |
|-------|-----|
| `CORS_ORIGINS is required` | Set `PUBLIC_ORIGIN` in `.env.docker` |
| Empty data / 401 | Re-login after new `JWT_SECRET_KEY` |
| `502` on `/api` | `docker compose logs backend` — wait for migrations |
| Restore fails | `ls -lh prmsc_backup.dump` — must be non-zero |

## Files

| File | Purpose |
|------|---------|
| `.env.docker.example` | Single env template |
| `docker-compose.yml` | Full stack (VM) |
| `docker-compose.dev.yml` | Local dev ports + skip nginx/frontend |
| `deploy/setup.sh` | VM bootstrap |
| `deploy/scripts/dump-from-supabase.sh` | Dump from Supabase (laptop) |
| `deploy/scripts/restore-from-supabase.sh` | Restore on VM |
| `deploy/scripts/backup-postgres.sh` | Postgres backup |
