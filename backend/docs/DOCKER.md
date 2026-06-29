# Docker deployment (PostgreSQL + NestJS backend)

Run the API and database on your own server with Docker Compose.

## Quick start

```bash
# From repo root
cp .env.docker.example .env.docker
# Edit secrets in .env.docker (SECRET_KEY, JWT_SECRET_KEY, POSTGRES_PASSWORD)

docker compose --env-file .env.docker up -d --build
```

API: `http://localhost:5001`  
Health: `http://localhost:5001/api/health`

The backend container waits for PostgreSQL, runs TypeORM migrations on startup, then starts the API.

## Services

| Service | Image | Port |
|---------|-------|------|
| `postgres` | `postgres:16-alpine` | `5432` |
| `backend` | Built from `backend/Dockerfile` | `5001` |

Data is persisted in the `postgres_data` Docker volume.

## Local development (Postgres in Docker, API on host)

```bash
# Start only Postgres
docker compose --env-file .env.docker up -d postgres

# In backend/
cp .env.example .env
# DATABASE_URL=postgresql://prmsc:prmsc@127.0.0.1:5432/prmsc_mrv?sslmode=disable

npm install
npm run migration:run
npm run start:dev
```

## Migrating data from Supabase

Supabase runs **PostgreSQL 17**. Your local `pg_dump` must be v17+ (use Docker if Homebrew is older).

1. Set the Supabase connection string (from Supabase Dashboard → Settings → Database, or `backend/.env.production`):

```bash
export SUPABASE_DATABASE_URL='postgresql://postgres.[project-ref]:[password]@...pooler.supabase.com:5432/postgres'
```

2. Dump (via Docker — avoids version mismatch):

```bash
docker run --rm -v "$(pwd):/backup" postgres:17-alpine \
  pg_dump "$SUPABASE_DATABASE_URL" --no-owner --no-acl -Fc -f /backup/prmsc_backup.dump

ls -lh prmsc_backup.dump   # must NOT be 0 bytes
```

3. Start Docker Postgres:

```bash
docker compose --env-file .env.docker up -d postgres
```

4. Wipe target DB and restore (Supabase dump includes schema + data):

```bash
docker exec prmsc-postgres psql -U prmsc -d postgres -c "DROP DATABASE IF EXISTS prmsc_mrv;"
docker exec prmsc-postgres psql -U prmsc -d postgres -c "CREATE DATABASE prmsc_mrv;"

docker run --rm -v "$(pwd):/backup" --network host postgres:17-alpine \
  pg_restore -d "postgresql://prmsc:prmsc@127.0.0.1:5433/prmsc_mrv?sslmode=disable" \
  --no-owner --no-acl /backup/prmsc_backup.dump
```

A few Supabase-internal extension warnings on restore are normal and can be ignored.

5. Mark the TypeORM baseline migration as applied (schema came from the dump):

```bash
docker exec prmsc-postgres psql -U prmsc -d prmsc_mrv -c "
CREATE TABLE IF NOT EXISTS migrations (id SERIAL PRIMARY KEY, timestamp bigint NOT NULL, name character varying NOT NULL);
INSERT INTO migrations (timestamp, name) VALUES (1730000000000, 'InitialSchema1730000000000');
"
```

6. Verify data:

```bash
docker exec prmsc-postgres psql -U prmsc -d prmsc_mrv -c "SELECT COUNT(*) FROM users;"
```

7. Start the backend:

```bash
docker compose --env-file .env.docker up -d backend
# or: cd backend && npm run start:dev
```

## File uploads (storage)

The database no longer uses Supabase. **File uploads** still use an S3-compatible API via `StorageService`. Configure any S3-compatible provider (MinIO, AWS S3, etc.) with:

- `SUPABASE_STORAGE_BUCKET`
- `SUPABASE_S3_ENDPOINT`
- `SUPABASE_S3_REGION`
- `SUPABASE_S3_ACCESS_KEY_ID`
- `SUPABASE_S3_SECRET_ACCESS_KEY`
- `SUPABASE_STORAGE_PUBLIC_BASE_URL`

Env var names are legacy; they work with any S3-compatible endpoint.

## Production notes

- Set strong `SECRET_KEY`, `JWT_SECRET_KEY`, and `POSTGRES_PASSWORD` in `.env.docker`
- Put a reverse proxy (nginx, Caddy) in front of the backend for TLS
- Set `CORS_ORIGINS` to your production frontend URL(s)
- Back up the `postgres_data` volume regularly
