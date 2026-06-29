# Database migrations (NestJS / TypeORM)

## Existing production databases

If the database was created with the Flask backend, schema history is in the `alembic_version` table. Alembic revision files are kept only in `backend-legacy/migrations/` for reference.

**Do not re-run Alembic** on an already-migrated database. The TypeORM baseline migration `1730000000000-InitialSchema` is a **no-op** for that case.

Fresh database from legacy Flask (optional):

```bash
cd backend-legacy
pip install -r requirements.txt
flask --app app:create_app db upgrade
```

## TypeORM (current backend)

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

## Schema source of truth

| What | Where |
|------|--------|
| Entities | `src/infrastructure/database/entities/` |
| New migrations | `src/infrastructure/database/migrations/` |
| Legacy Alembic history | `backend-legacy/migrations/` (reference only) |
