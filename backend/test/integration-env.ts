import * as dotenv from 'dotenv';
import { join } from 'path';
import { Client } from 'pg';

dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../.env.docker') });

/** Default local Docker Postgres (docker-compose.dev.yml maps 5433). */
export const defaultIntegrationDatabaseUrl =
  'postgresql://prmsc:prmsc_local_dev@127.0.0.1:5433/prmsc_mrv?sslmode=disable';

export function integrationDatabaseUrl(): string {
  const url = (process.env.DATABASE_URL ?? '').trim();
  return url || defaultIntegrationDatabaseUrl;
}

export async function isPostgresReachable(
  url = integrationDatabaseUrl(),
): Promise<boolean> {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}
