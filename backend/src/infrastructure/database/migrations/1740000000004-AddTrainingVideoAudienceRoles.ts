import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrainingVideoAudienceRoles1740000000004
  implements MigrationInterface
{
  name = 'AddTrainingVideoAudienceRoles1740000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "training_videos"
      ADD COLUMN "audience_roles" text NOT NULL DEFAULT 'ADMIN,SUPER_ADMIN'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "training_videos" DROP COLUMN "audience_roles"
    `);
  }
}
