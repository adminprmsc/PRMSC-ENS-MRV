import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Performance indexes for high-traffic query paths:
 *
 * submissions
 *   - (status, submission_type) — pending-submission list filter
 *   - (operator_id)             — per-operator lookup
 *   - (record_id)               — join to water_energy_logging_daily
 *
 * water_energy_logging_daily
 *   - (water_system_id)         — per-system log history
 *   - (log_date)                — date-range queries
 *   - (water_system_id, log_date) — combined daily compliance queries
 *
 * solar_systems
 *   - (tehsil)                  — tehsil-scoped listing
 *
 * solar_energy_logging_monthly
 *   - (solar_system_id)         — per-system monthly history
 *   - (solar_system_id, year, month) — unique-ish lookup & calendar queries
 *   - (year, month)             — programme-wide period queries
 */
export class AddPerformanceIndexes1740000000008 implements MigrationInterface {
  name = 'AddPerformanceIndexes1740000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // submissions
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_submissions_status_type"
       ON "submissions" ("status", "submission_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_submissions_operator_id"
       ON "submissions" ("operator_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_submissions_record_id"
       ON "submissions" ("record_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_submissions_submitted_at"
       ON "submissions" ("submitted_at")`,
    );

    // water_energy_logging_daily
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_water_daily_water_system_id"
       ON "water_energy_logging_daily" ("water_system_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_water_daily_log_date"
       ON "water_energy_logging_daily" ("log_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_water_daily_system_date"
       ON "water_energy_logging_daily" ("water_system_id", "log_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_water_daily_status"
       ON "water_energy_logging_daily" ("status")`,
    );

    // solar_systems
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_solar_systems_tehsil"
       ON "solar_systems" ("tehsil")`,
    );

    // solar_energy_logging_monthly
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_solar_monthly_solar_system_id"
       ON "solar_energy_logging_monthly" ("solar_system_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_solar_monthly_system_year_month"
       ON "solar_energy_logging_monthly" ("solar_system_id", "year", "month")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_solar_monthly_year_month"
       ON "solar_energy_logging_monthly" ("year", "month")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_submissions_status_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_submissions_operator_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_submissions_record_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_submissions_submitted_at"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_water_daily_water_system_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_water_daily_log_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_water_daily_system_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_water_daily_status"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_solar_systems_tehsil"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_solar_monthly_solar_system_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_solar_monthly_system_year_month"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_solar_monthly_year_month"`);
  }
}
