import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline migration for databases already provisioned via Flask/Alembic.
 *
 * The production schema was originally created and evolved by Alembic migrations
 * in the Python backend. This TypeORM migration intentionally performs no DDL
 * so existing databases remain unchanged. synchronize is disabled globally.
 *
 * For a brand-new database, run Alembic migrations from `backend-legacy/`, or
 * generate a fresh TypeORM migration from entities.
 */
export class InitialSchema1730000000000 implements MigrationInterface {
  name = 'InitialSchema1730000000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // No-op: schema already exists from Alembic.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op baseline.
  }
}
