import { resolveCorsAllowlist } from './configuration';

describe('resolveCorsAllowlist', () => {
  it('merges dev fallbacks when CORS_ORIGINS is partial in development', () => {
    const prev = process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = 'http://localhost:5174';
    try {
      const origins = resolveCorsAllowlist('development');
      expect(origins).toContain('http://localhost:5173');
      expect(origins).toContain('http://127.0.0.1:5173');
      expect(origins).toContain('http://localhost:5174');
    } finally {
      if (prev === undefined) {
        delete process.env.CORS_ORIGINS;
      } else {
        process.env.CORS_ORIGINS = prev;
      }
    }
  });

  it('uses only explicit origins in production', () => {
    const prev = process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = 'https://app.example.com';
    try {
      const origins = resolveCorsAllowlist('production');
      expect(origins).toEqual(['https://app.example.com']);
      expect(origins).not.toContain('http://localhost:5173');
    } finally {
      if (prev === undefined) {
        delete process.env.CORS_ORIGINS;
      } else {
        process.env.CORS_ORIGINS = prev;
      }
    }
  });
});
