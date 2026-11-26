import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bulk meter start (Pakistan wall-clock date + time). From this moment on a
 * bulk-meter site's volume comes only from meter readings; earlier logs use
 * the hourly estimate. NULL = fall back to the earliest submitted meter log.
 * Stored like log_date + pump_start_time so comparisons are time-zone free.
 */
export class AddWaterBulkMeterSince1740000000014 implements MigrationInterface {
  name = 'AddWaterBulkMeterSince1740000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "water_systems" ADD COLUMN IF NOT EXISTS "bulk_meter_since_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "water_systems" ADD COLUMN IF NOT EXISTS "bulk_meter_since_time" time`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "water_systems" DROP COLUMN IF EXISTS "bulk_meter_since_time"`,
    );
    await queryRunner.query(
      `ALTER TABLE "water_systems" DROP COLUMN IF EXISTS "bulk_meter_since_date"`,
    );
  }
}
