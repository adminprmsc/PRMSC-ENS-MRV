import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrainingVideos1740000000003 implements MigrationInterface {
  name = 'AddTrainingVideos1740000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "training_videos" (
        "id" character varying(36) NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text,
        "youtube_url" text NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_published" boolean NOT NULL DEFAULT false,
        "created_by_id" character varying(36),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_training_videos" PRIMARY KEY ("id"),
        CONSTRAINT "FK_training_videos_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_training_videos_published_sort" ON "training_videos" ("is_published", "sort_order")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "training_videos"`);
  }
}
