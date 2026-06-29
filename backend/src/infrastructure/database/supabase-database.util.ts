import { execSync } from 'node:child_process';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';

function normalizeScheme(uri: string): string {
  if (uri.startsWith('postgres://')) {
    return uri.replace('postgres://', 'postgresql://');
  }
  return uri;
}

function ensureSslmode(uri: string): string {
  const parsed = new URL(uri);
  if (!parsed.protocol.startsWith('postgresql')) {
    return uri;
  }
  // pg v8+ treats sslmode=require as verify-full; libpq compat matches Supabase pooler.
  parsed.searchParams.set('uselibpqcompat', 'true');
  if (!parsed.searchParams.has('sslmode')) {
    parsed.searchParams.set('sslmode', 'require');
  }
  return parsed.toString();
}

function isIpv4(host: string): boolean {
  return net.isIP(host) === 4;
}

async function hostnameResolves(hostname: string): Promise<boolean> {
  try {
    await dns.lookup(hostname);
    return true;
  } catch {
    return false;
  }
}

function firstIpv4FromDigOutput(stdout: string): string | null {
  for (const line of stdout.split('\n')) {
    const candidate = line.trim().replace(/\.$/, '');
    if (isIpv4(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveViaPublicDns(hostname: string): string | null {
  for (const resolver of ['8.8.8.8', '1.1.1.1']) {
    try {
      const stdout = execSync(`dig +short ${hostname} A @${resolver}`, {
        encoding: 'utf8',
        timeout: 8000,
      });
      const ip = firstIpv4FromDigOutput(stdout);
      if (ip) {
        return ip;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function replaceHostnameInUri(uri: string, ip: string): string {
  const parsed = new URL(uri);
  const port = parsed.port || '5432';
  parsed.hostname = ip;
  if (!parsed.port) {
    parsed.port = port;
  }
  return parsed.toString();
}

function applyDnsFallbackIfNeeded(uri: string): string {
  const flag = (process.env.DATABASE_DNS_FALLBACK ?? '1').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'no') {
    return uri;
  }

  const parsed = new URL(uri);
  const host = parsed.hostname;
  if (!host || isIpv4(host)) {
    return uri;
  }

  // Synchronous DNS check for startup path
  let resolves = false;
  try {
    execSync(`node -e "require('dns').lookupSync('${host}')"`, {
      stdio: 'ignore',
    });
    resolves = true;
  } catch {
    resolves = false;
  }
  if (resolves) {
    return uri;
  }

  const overrideIp = (process.env.DATABASE_HOST_IP ?? '').trim();
  if (overrideIp && isIpv4(overrideIp)) {
    console.warn(
      `Using DATABASE_HOST_IP=${overrideIp} for database host ${host}`,
    );
    return replaceHostnameInUri(uri, overrideIp);
  }

  const ip = resolveViaPublicDns(host);
  if (!ip) {
    return uri;
  }

  console.warn(
    `System DNS could not resolve database host ${host}; connecting via ${ip} ` +
      `(public DNS fallback). Fix local DNS or set DATABASE_HOST_IP=${ip} in .env.`,
  );
  return replaceHostnameInUri(uri, ip);
}

/** Build a TypeORM-compatible Supabase/PostgreSQL URI. */
export function buildDatabaseUri(rawUri: string): string {
  let uri = (rawUri ?? '').trim();
  if (!uri) {
    throw new Error(
      'DATABASE_URL is required for PostgreSQL/Supabase connection.',
    );
  }

  uri = normalizeScheme(uri);
  const parsed = new URL(uri);
  if (!parsed.protocol.startsWith('postgresql')) {
    throw new Error('Only PostgreSQL DATABASE_URL is supported.');
  }
  uri = ensureSslmode(uri);
  uri = applyDnsFallbackIfNeeded(uri);
  return uri;
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

/** SSL options for node-postgres when connecting to Supabase (encrypted, no custom CA bundle). */
export function getPgSslOptions(): { rejectUnauthorized: boolean } | false {
  const raw = (process.env.DATABASE_URL ?? '').trim();
  if (!raw) {
    return false;
  }
  const parsed = new URL(normalizeScheme(raw));
  if (!parsed.protocol.startsWith('postgresql')) {
    return false;
  }
  const sslmode = (
    parsed.searchParams.get('sslmode') ?? 'require'
  ).toLowerCase();
  if (sslmode === 'disable' || sslmode === 'false') {
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

export async function hostnameResolvesAsync(
  hostname: string,
): Promise<boolean> {
  return hostnameResolves(hostname);
}
