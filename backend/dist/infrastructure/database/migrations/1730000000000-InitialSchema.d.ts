import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class InitialSchema1730000000000 implements MigrationInterface {
    name: string;
    up(_queryRunner: QueryRunner): Promise<void>;
    down(_queryRunner: QueryRunner): Promise<void>;
}
