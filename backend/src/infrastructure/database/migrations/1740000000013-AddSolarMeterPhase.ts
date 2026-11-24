import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Solar monthly logs: `meter_phase` distinguishes normal green-meter logs from
 * back-dated "before green meter" logs (units consumed only, nothing exported).
 * Existing rows are all green-meter logs.
 */
export class AddSolarMeterPhase1740000000013 implements MigrationInterface {
  name = 'AddSolarMeterPhase1740000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "solar_energy_logging_monthly" ADD COLUMN IF NOT EXISTS "meter_phase" character varying(20) NOT NULL DEFAULT 'green'`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "solar_energy_logging_monthly"
          ADD CONSTRAINT "CHK_solar_monthly_meter_phase"
          CHECK ("meter_phase" IN ('green', 'pre_green'));
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    // A pre-green log never carries export or net values.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "solar_energy_logging_monthly"
          ADD CONSTRAINT "CHK_solar_monthly_pre_green_no_export"
          CHECK (
            "meter_phase" <> 'pre_green' OR (
              "export_peak" IS NULL AND "export_off_peak" IS NULL
              AND "net_peak" IS NULL AND "net_off_peak" IS NULL
            )
          );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "solar_energy_logging_monthly" DROP CONSTRAINT IF EXISTS "CHK_solar_monthly_pre_green_no_export"`,
    );
    await queryRunner.query(
      `ALTER TABLE "solar_energy_logging_monthly" DROP CONSTRAINT IF EXISTS "CHK_solar_monthly_meter_phase"`,
    );
    // Pre-green rows have no export/net; drop them would lose data, so keep
    // them as green rows with NULL export (the pre-feature representation).
    await queryRunner.query(
      `ALTER TABLE "solar_energy_logging_monthly" DROP COLUMN IF EXISTS "meter_phase"`,
    );
  }
}
