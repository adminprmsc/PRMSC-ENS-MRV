import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities';
import { buildTypeOrmPostgresConnection } from './postgres-database.util';

loadEnv();

const connection = buildTypeOrmPostgresConnection(
  process.env.DATABASE_URL ?? '',
);

export default new DataSource({
  type: 'postgres',
  url: connection.url,
  ssl: connection.ssl,
  extra: connection.extra,
  entities: ALL_ENTITIES,
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
