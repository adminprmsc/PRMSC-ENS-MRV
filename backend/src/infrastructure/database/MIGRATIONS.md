# Database migrations (NestJS / TypeORM)

## Docker / self-hosted PostgreSQL

See [DOCKER.md](./DOCKER.md) for running Postgres in Docker.

Fresh database:

```bash
cd backend
npm run migration:run
```

The backend Docker image runs migrations automatically on startup.

## Migrating from Supabase

1. `pg_dump` from Supabase and `pg_restore` into your Docker Postgres (see DOCKER.md).
2. If tables already exist from the dump, ensure the TypeORM `migrations` table records the baseline migration.

## Existing production databases (legacy Flask/Alembic)

If the database was created with the Flask backend, schema history is in the `alembic_version` table.

The TypeORM baseline migration `1730000000000-InitialSchema` is a **no-op** for databases that already have the schema.

## TypeORM commands

Configuration: `src/infrastructure/database/data-source.ts`

```bash
# Apply pending migrations
npm run migration:run

# Generate a migration after entity changes
npm run migration:generate -- src/infrastructure/database/migrations/DescriptiveName

# Revert last migration
npm run migration:revert
```

Set `DATABASE_URL` in `.env` before running commands.

Example local URL:

```
postgresql://prmsc:prmsc@127.0.0.1:5432/prmsc_mrv?sslmode=disable
```

## Schema source of truth

| What | Where |
|------|--------|
| Entities | `src/infrastructure/database/entities/` |
| Migrations | `src/infrastructure/database/migrations/` |
| Connection helper | `src/infrastructure/database/postgres-database.util.ts` |
