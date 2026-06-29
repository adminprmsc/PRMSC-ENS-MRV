function normalizeScheme(uri: string): string {
  if (uri.startsWith('postgres://')) {
    return uri.replace('postgres://', 'postgresql://');
  }
  return uri;
}

function isLocalDatabaseHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === 'postgres' ||
    h === 'db' ||
    h.endsWith('.local')
  );
}

/** Normalize connection URI for node-postgres / TypeORM. */
export function buildDatabaseUri(rawUri: string): string {
  let uri = (rawUri ?? '').trim();
  if (!uri) {
    throw new Error('DATABASE_URL is required for PostgreSQL connection.');
  }

  uri = normalizeScheme(uri);
  const parsed = new URL(uri);
  if (!parsed.protocol.startsWith('postgresql')) {
    throw new Error('Only PostgreSQL DATABASE_URL is supported.');
  }

  const host = parsed.hostname;
  const sslmode = (parsed.searchParams.get('sslmode') ?? '').toLowerCase();

  if (isLocalDatabaseHost(host) && !parsed.searchParams.has('sslmode')) {
    parsed.searchParams.set('sslmode', 'disable');
  } else if (
    sslmode &&
    sslmode !== 'disable' &&
    sslmode !== 'false' &&
    !parsed.searchParams.has('uselibpqcompat')
  ) {
    parsed.searchParams.set('uselibpqcompat', 'true');
  }

  return parsed.toString();
}

/** Returns a safe, masked URI for logs/debugging. */
export function maskDatabaseUri(uri: string): string {
  const parsed = new URL(uri);
  if (!parsed.password) {
    return uri;
  }
  parsed.password = '***';
  return parsed.toString();
}

export function getDatabaseUriFromEnv(): string {
  return buildDatabaseUri(process.env.DATABASE_URL ?? '');
}

/** SSL options for node-postgres. Disabled when sslmode=disable. */
export function getPgSslOptions(): { rejectUnauthorized: boolean } | false {
  const raw = (process.env.DATABASE_URL ?? '').trim();
  if (!raw) {
    return false;
  }
  const parsed = new URL(normalizeScheme(raw));
  if (!parsed.protocol.startsWith('postgresql')) {
    return false;
  }

  const sslmode = (parsed.searchParams.get('sslmode') ?? '').toLowerCase();
  if (
    sslmode === 'disable' ||
    sslmode === 'false' ||
    isLocalDatabaseHost(parsed.hostname)
  ) {
    return false;
  }

  const strict = ['1', 'true', 'yes'].includes(
    (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? 'false')
      .trim()
      .toLowerCase(),
  );
  return { rejectUnauthorized: strict };
}

export interface TypeOrmPostgresConnectionOptions {
  url: string;
  ssl: { rejectUnauthorized: boolean } | false;
  extra: Record<string, unknown>;
}

/** Shared TypeORM / DataSource PostgreSQL connection settings. */
export function buildTypeOrmPostgresConnection(
  rawUri: string,
): TypeOrmPostgresConnectionOptions {
  const url = buildDatabaseUri(rawUri);
  const isVercel = ['1', 'true', 'yes'].includes(
    (process.env.VERCEL ?? '').trim().toLowerCase(),
  );
  const extra: Record<string, unknown> = isVercel
    ? { max: 1, idleTimeoutMillis: 1 }
    : { max: 10 };

  return {
    url,
    ssl: getPgSslOptions(),
    extra,
  };
}
