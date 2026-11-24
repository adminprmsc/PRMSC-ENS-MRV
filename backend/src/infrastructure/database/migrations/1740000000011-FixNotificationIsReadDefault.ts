import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Databases created by the legacy Flask app have `notifications.is_read`
 * nullable with no default, so rows inserted by TypeORM landed as NULL and
 * were never counted as unread. Backfill and enforce `NOT NULL DEFAULT false`.
 */
export class FixNotificationIsReadDefault1740000000011 implements MigrationInterface {
  name = 'FixNotificationIsReadDefault1740000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "notifications" SET "is_read" = false WHERE "is_read" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "is_read" SET DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "is_read" SET NOT NULL`,
    );
  }

  public async down(): Promise<void> {
    // Intentionally irreversible: re-allowing NULL would reintroduce the bug.
  }
}
