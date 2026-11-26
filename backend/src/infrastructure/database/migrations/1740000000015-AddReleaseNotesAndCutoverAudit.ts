import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - release_note_receipts: per-user delivery / read / dismiss state for the
 *   "What's new" catalog (domain/constants/release-notes.ts).
 * - water_bulk_cutover_logs: append-only audit of every change to a water
 *   system's bulk-meter start, with its impact on existing logs.
 * Additive only — no existing rows are touched.
 */
export class AddReleaseNotesAndCutoverAudit1740000000015 implements MigrationInterface {
  name = 'AddReleaseNotesAndCutoverAudit1740000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "release_note_receipts" (
        "id" character varying(36) NOT NULL,
        "user_id" character varying(36) NOT NULL,
        "release_id" character varying(100) NOT NULL,
        "notified_at" TIMESTAMP NOT NULL DEFAULT now(),
        "read_at" TIMESTAMP,
        "dismissed_at" TIMESTAMP,
        CONSTRAINT "PK_release_note_receipts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_release_note_receipts_user_release" UNIQUE ("user_id", "release_id"),
        CONSTRAINT "FK_release_note_receipts_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "water_bulk_cutover_logs" (
        "id" character varying(36) NOT NULL,
        "water_system_id" character varying(36) NOT NULL,
        "previous_since" character varying(19),
        "new_since" character varying(19),
        "newly_unmetered_logs" integer NOT NULL DEFAULT 0,
        "performed_by" character varying(36),
        "performed_by_name" character varying(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_water_bulk_cutover_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_water_bulk_cutover_logs_system"
          FOREIGN KEY ("water_system_id") REFERENCES "water_systems"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_water_bulk_cutover_logs_user"
          FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_water_bulk_cutover_logs_system"
        ON "water_bulk_cutover_logs" ("water_system_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_water_bulk_cutover_logs_system"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "water_bulk_cutover_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "release_note_receipts"`);
  }
}
