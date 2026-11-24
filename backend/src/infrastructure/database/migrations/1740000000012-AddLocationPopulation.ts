import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Geography / population:
 * - `population` on villages (main village abadi, excluding its settlements)
 *   and on settlements. Village total = own + settlements; tehsil total = sum.
 * - `location_population_logs` — append-only audit of every population change.
 */
export class AddLocationPopulation1740000000012 implements MigrationInterface {
  name = 'AddLocationPopulation1740000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['location_villages', 'location_settlements']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "population" integer NOT NULL DEFAULT 0`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "population_updated_at" TIMESTAMP`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "population_updated_by" character varying(36)`,
      );
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "${table}" ADD CONSTRAINT "CHK_${table}_population_nonneg" CHECK ("population" >= 0);
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "location_population_logs" (
        "id" character varying(36) NOT NULL,
        "location_type" character varying(20) NOT NULL,
        "location_id" character varying(36) NOT NULL,
        "tehsil" character varying(100) NOT NULL,
        "village" character varying(150) NOT NULL,
        "settlement" character varying(150),
        "previous_population" integer NOT NULL,
        "new_population" integer NOT NULL,
        "performed_by" character varying(36),
        "performed_by_name" character varying(255),
        "performed_by_role" character varying(50) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_location_population_logs" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_location_population_logs_type"
          CHECK ("location_type" IN ('village', 'settlement')),
        CONSTRAINT "FK_location_population_logs_performed_by"
          FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_location_population_logs_tehsil_created"
        ON "location_population_logs" ("tehsil", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_location_population_logs_tehsil_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "location_population_logs"`);
    for (const table of ['location_villages', 'location_settlements']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "CHK_${table}_population_nonneg"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "population_updated_by"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "population_updated_at"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "population"`,
      );
    }
  }
}
