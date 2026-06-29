import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** Headers browsers may send on API requests (wildcard * is invalid with credentials). */
export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'Origin',
  'X-Requested-With',
] as const;

export function buildCorsOptions(allowedOrigins: string[]): CorsOptions {
  const allowlist = new Set(allowedOrigins);

  return {
    origin: (origin, callback) => {
      // Non-browser clients (curl, health checks) have no Origin header.
      if (!origin || allowlist.has(origin)) {
        callback(null, origin ?? true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
}
