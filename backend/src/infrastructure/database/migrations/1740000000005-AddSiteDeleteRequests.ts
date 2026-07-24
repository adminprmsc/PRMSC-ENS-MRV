import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSiteDeleteRequests1740000000005 implements MigrationInterface {
  name = 'AddSiteDeleteRequests1740000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "site_delete_requests" (
        "id" character varying(36) NOT NULL,
        "resource_type" character varying(20) NOT NULL,
        "resource_id" character varying(36) NOT NULL,
        "tehsil" character varying(100) NOT NULL,
        "village" character varying(150),
        "settlement" character varying(150),
        "unique_identifier" character varying(100) NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'pending',
        "requested_by" character varying(36) NOT NULL,
        "requested_at" TIMESTAMP NOT NULL DEFAULT now(),
        "request_reason" text,
        "reviewed_by" character varying(36),
        "reviewed_at" TIMESTAMP,
        "review_remarks" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_site_delete_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_site_delete_requests_requested_by"
          FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_site_delete_requests_reviewed_by"
          FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_site_delete_requests_status_tehsil"
        ON "site_delete_requests" ("status", "tehsil")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_site_delete_requests_pending_resource"
        ON "site_delete_requests" ("resource_type", "resource_id")
        WHERE "status" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_site_delete_requests_pending_resource"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_site_delete_requests_status_tehsil"`,
    );
    await queryRunner.query(`DROP TABLE "site_delete_requests"`);
  }
}
