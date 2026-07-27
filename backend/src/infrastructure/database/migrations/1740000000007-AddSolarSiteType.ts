import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSolarSiteType1740000000007 implements MigrationInterface {
  name = 'AddSolarSiteType1740000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "solar_systems"
      ADD COLUMN "site_type" character varying(30)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_solar_systems_site_type"
        ON "solar_systems" ("site_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_solar_systems_site_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "solar_systems" DROP COLUMN IF EXISTS "site_type"`,
    );
  }
}
