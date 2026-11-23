import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets the web portal render notifications as links: `notification_type`
 * identifies what happened, `entity_id` the record to open (e.g. an
 * entry_change_logs row). Both nullable — legacy rows keep working.
 */
export class AddNotificationLinkFields1740000000010 implements MigrationInterface {
  name = 'AddNotificationLinkFields1740000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN IF NOT EXISTS "notification_type" character varying(40),
        ADD COLUMN IF NOT EXISTS "entity_id" character varying(36)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_unread"
        ON "notifications" ("user_id", "is_read")
    `);
    // Tag Manager Operations override notices created before this column existed.
    await queryRunner.query(`
      UPDATE "notifications"
         SET "notification_type" = 'entry_change'
       WHERE "notification_type" IS NULL
         AND "title" LIKE '% by Manager Operations'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_user_unread"`,
    );
    await queryRunner.query(`
      ALTER TABLE "notifications"
        DROP COLUMN IF EXISTS "entity_id",
        DROP COLUMN IF EXISTS "notification_type"
    `);
  }
}
