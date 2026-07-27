import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLocationCatalog1740000000006 implements MigrationInterface {
  name = 'AddLocationCatalog1740000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "location_villages" (
        "id" character varying(36) NOT NULL,
        "tehsil" character varying(100) NOT NULL,
        "name" character varying(150) NOT NULL,
        "is_custom" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" character varying(36),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_location_villages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_location_villages_created_by"
          FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_location_villages_tehsil_name"
        ON "location_villages" ("tehsil", "name")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_location_villages_tehsil"
        ON "location_villages" ("tehsil")
    `);

    await queryRunner.query(`
      CREATE TABLE "location_settlements" (
        "id" character varying(36) NOT NULL,
        "tehsil" character varying(100) NOT NULL,
        "village" character varying(150) NOT NULL,
        "name" character varying(150) NOT NULL,
        "is_custom" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" character varying(36),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_location_settlements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_location_settlements_created_by"
          FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_location_settlements_tehsil_village_name"
        ON "location_settlements" ("tehsil", "village", "name")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_location_settlements_tehsil_village"
        ON "location_settlements" ("tehsil", "village")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_location_settlements_tehsil_village"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_location_settlements_tehsil_village_name"`,
    );
    await queryRunner.query(`DROP TABLE "location_settlements"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_location_villages_tehsil"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_location_villages_tehsil_name"`,
    );
    await queryRunner.query(`DROP TABLE "location_villages"`);
  }
}
