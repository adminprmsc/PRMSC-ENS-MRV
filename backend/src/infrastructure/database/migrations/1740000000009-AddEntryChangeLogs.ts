import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audit trail for Manager Operations reject/delete overrides on approved
 * water daily logs and solar monthly logs. `performed_by` is SET NULL on user
 * removal; the denormalised name keeps the history readable.
 */
export class AddEntryChangeLogs1740000000009 implements MigrationInterface {
  name = 'AddEntryChangeLogs1740000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "entry_change_logs" (
        "id" character varying(36) NOT NULL,
        "entry_type" character varying(20) NOT NULL,
        "entry_id" character varying(36) NOT NULL,
        "action" character varying(20) NOT NULL,
        "reason" text NOT NULL,
        "previous_status" character varying(30),
        "new_status" character varying(30),
        "performed_by" character varying(36),
        "performed_by_name" character varying(255),
        "performed_by_role" character varying(50) NOT NULL,
        "system_id" character varying(36),
        "system_uid" character varying(100),
        "tehsil" character varying(100) NOT NULL,
        "village" character varying(150),
        "settlement" character varying(150),
        "entry_period" character varying(10),
        "submission_id" character varying(36),
        "snapshot" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_entry_change_logs" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_entry_change_logs_entry_type"
          CHECK ("entry_type" IN ('water_log', 'solar_log')),
        CONSTRAINT "CHK_entry_change_logs_action"
          CHECK ("action" IN ('reject', 'delete')),
        CONSTRAINT "FK_entry_change_logs_performed_by"
          FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_entry_change_logs_tehsil_created"
        ON "entry_change_logs" ("tehsil", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_entry_change_logs_entry"
        ON "entry_change_logs" ("entry_type", "entry_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_entry_change_logs_entry"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_entry_change_logs_tehsil_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "entry_change_logs"`);
  }
}
