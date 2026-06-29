import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from './entities';
import {
  buildTypeOrmPostgresConnection,
  maskDatabaseUri,
} from './postgres-database.util';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const rawUrl = config.get<string>('database.url', '');
        const connection = buildTypeOrmPostgresConnection(rawUrl);
        console.info(`Database configured: ${maskDatabaseUri(connection.url)}`);
        return {
          type: 'postgres' as const,
          url: connection.url,
          ssl: connection.ssl,
          entities: ALL_ENTITIES,
          synchronize: false,
          migrations: [__dirname + '/migrations/*.{ts,js}'],
          migrationsRun: false,
          logging: config.get<string>('nodeEnv') === 'development',
          extra: connection.extra,
        };
      },
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
