import Config from 'react-native-config';

function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

const ENV = String((Config as unknown as { ENV?: unknown }).ENV ?? '')
  .trim()
  .toUpperCase();

const isProdEnv = ENV === 'PROD' || ENV === 'PRODUCTION';
const isDevEnv = ENV === 'DEV' || ENV === 'DEVELOPMENT' || ENV === 'LOCAL';

const PROD_API_URL = 'http://101.50.86.169/api';
const DEV_API_URL = 'http://127.0.0.1:5001/api';

/**
 * Priority order:
 * 1) Explicit `API_URL` from env file (release: `.env.production`)
 * 2) `ENV=PROD|DEV` defaults below
 * 3) Dev fallback
 */
const EXPLICIT = normalizeApiUrl(
  String((Config as unknown as { API_URL?: unknown }).API_URL ?? ''),
);

export const API_URL = EXPLICIT
  ? EXPLICIT
  : isProdEnv
  ? PROD_API_URL
  : isDevEnv
  ? DEV_API_URL
  : DEV_API_URL;
