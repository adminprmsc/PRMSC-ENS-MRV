import { registerAs } from '@nestjs/config';

const DEV_FALLBACK_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
] as const;

export function normalizeOrigin(value: string): string {
  let o = value.trim();
  if (o.length > 1 && o.endsWith('/')) {
    o = o.replace(/\/+$/, '');
  }
  return o;
}

function originsFromCorsEnv(): string[] {
  const raw = (process.env.CORS_ORIGINS ?? '').trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
}

function dedupePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

/** Docker Compose injects unset optional vars as "" — treat those like missing. */
export function envOrFallback(
  value: string | undefined,
  fallback: string,
): string {
  const trimmed = (value ?? '').trim();
  return trimmed || fallback;
}

export function resolveCorsAllowlist(nodeEnv: string): string[] {
  const explicit = dedupePreserveOrder(originsFromCorsEnv());
  const isDev = (nodeEnv || '').trim().toLowerCase() === 'development';

  if (isDev) {
    // In development, always include local dev defaults so a partial CORS_ORIGINS
    // (e.g. only :5174) does not block :5173 or 127.0.0.1 vs localhost.
    return dedupePreserveOrder([...explicit, ...DEV_FALLBACK_ORIGINS]);
  }

  if (explicit.length > 0) {
    return explicit;
  }

  throw new Error(
    'CORS_ORIGINS is required when NODE_ENV is not development. ' +
      'Set a comma-separated list of exact origins (scheme + host + optional port), ' +
      'e.g. CORS_ORIGINS=https://your-app.onrender.com,http://localhost:5173',
  );
}

export default registerAs('app', () => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').trim().toLowerCase();
  const isProduction = nodeEnv === 'production';
  const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, ''); // storage public URLs only
  const passwordResetDevReturnToken = ['1', 'true', 'yes'].includes(
    (process.env.PASSWORD_RESET_DEV_RETURN_TOKEN ?? '').toLowerCase(),
  );

  return {
    nodeEnv,
    isProduction,
    debug: !isProduction,
    secretKey: process.env.SECRET_KEY ?? 'dev-key-123',
    jwtSecretKey: process.env.JWT_SECRET_KEY ?? 'jwt-dev-key',
    corsOrigins: resolveCorsAllowlist(nodeEnv),
    uploadFolder: process.env.UPLOAD_FOLDER ?? 'uploads',
    maxContentLength: 16 * 1024 * 1024,
    allowedExtensions: ['png', 'jpg', 'jpeg', 'gif', 'pdf'],
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH ?? '8', 10),
    passwordResetTokenTtlHours: parseInt(
      process.env.PASSWORD_RESET_TOKEN_TTL_HOURS ?? '1',
      10,
    ),
    passwordResetFrontendUrl: (
      process.env.PASSWORD_RESET_FRONTEND_URL ?? ''
    ).replace(/\/+$/, ''),
    passwordResetDevReturnToken: !isProduction && passwordResetDevReturnToken,
    mailServer: (process.env.MAIL_SERVER ?? '').trim(),
    mailPort: parseInt(process.env.MAIL_PORT ?? '587', 10),
    mailUseTls: ['1', 'true', 'yes'].includes(
      (process.env.MAIL_USE_TLS ?? 'true').toLowerCase(),
    ),
    mailUsername: process.env.MAIL_USERNAME ?? '',
    mailPassword: process.env.MAIL_PASSWORD ?? '',
    mailDefaultSender: process.env.MAIL_DEFAULT_SENDER ?? '',
    supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'mrv-public',
    supabaseS3Endpoint: process.env.SUPABASE_S3_ENDPOINT ?? '',
    supabaseS3Region: process.env.SUPABASE_S3_REGION ?? 'ap-northeast-1',
    supabaseS3AccessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID ?? '',
    supabaseS3SecretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY ?? '',
    supabaseUrl,
    supabaseStoragePublicBaseUrl: envOrFallback(
      process.env.SUPABASE_STORAGE_PUBLIC_BASE_URL,
      supabaseUrl ? `${supabaseUrl}/storage/v1/object/public` : '',
    ),
  };
});

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? '',
}));
