import {
  randomBytes,
  scryptSync,
  pbkdf2Sync,
  timingSafeEqual,
} from 'node:crypto';

const DEFAULT_SCRYPT_N = 2 ** 15;
const DEFAULT_SCRYPT_R = 8;
const DEFAULT_SCRYPT_P = 1;
const DEFAULT_PBKDF2_ITERATIONS = 1_000_000;
const DEFAULT_SALT_LENGTH = 16;

function parseHash(storedHash: string): {
  method: string;
  args: string[];
  salt: string;
  hashHex: string;
} {
  const parts = storedHash.split('$');
  if (parts.length !== 3) {
    throw new Error('Invalid hash format');
  }
  const [methodPart, salt, hashHex] = parts;
  const colonIdx = methodPart.indexOf(':');
  const method = colonIdx >= 0 ? methodPart.slice(0, colonIdx) : methodPart;
  const args =
    colonIdx >= 0
      ? methodPart
          .slice(colonIdx + 1)
          .split(':')
          .filter(Boolean)
      : [];
  return { method, args, salt, hashHex };
}

function hashScrypt(
  password: string,
  salt: string,
  n: number,
  r: number,
  p: number,
): string {
  const maxmem = 132 * n * r * p;
  const keylen = 64;
  return scryptSync(password, salt, keylen, { N: n, r, p, maxmem }).toString(
    'hex',
  );
}

function hashPbkdf2(
  password: string,
  salt: string,
  digest: string,
  iterations: number,
): string {
  const keylen = 32;
  return pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
}

/** Verify a password against a werkzeug `generate_password_hash` stored value. */
export function checkPasswordHash(
  storedHash: string,
  password: string,
): boolean {
  try {
    const { method, args, salt, hashHex } = parseHash(storedHash);
    let derived: string;
    let methodLabel: string;

    if (method === 'scrypt') {
      let n = DEFAULT_SCRYPT_N;
      let r = DEFAULT_SCRYPT_R;
      let p = DEFAULT_SCRYPT_P;
      if (args.length === 3) {
        n = parseInt(args[0], 10);
        r = parseInt(args[1], 10);
        p = parseInt(args[2], 10);
      }
      derived = hashScrypt(password, salt, n, r, p);
      methodLabel = `scrypt:${n}:${r}:${p}`;
    } else if (method === 'pbkdf2') {
      let digest = 'sha256';
      let iterations = DEFAULT_PBKDF2_ITERATIONS;
      if (args.length >= 1) {
        digest = args[0];
      }
      if (args.length >= 2) {
        iterations = parseInt(args[1], 10);
      }
      derived = hashPbkdf2(password, salt, digest, iterations);
      methodLabel = `pbkdf2:${digest}:${iterations}`;
    } else {
      return false;
    }

    const expected = Buffer.from(hashHex, 'hex');
    const actual = Buffer.from(derived, 'hex');
    if (expected.length !== actual.length) {
      return false;
    }
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** Generate a werkzeug-compatible password hash (default: scrypt). */
export function generatePasswordHash(
  password: string,
  method = `scrypt:${DEFAULT_SCRYPT_N}:${DEFAULT_SCRYPT_R}:${DEFAULT_SCRYPT_P}`,
  saltLength = DEFAULT_SALT_LENGTH,
): string {
  const salt = randomBytes(saltLength).toString('hex');
  const [algo, ...args] = method.split(':');

  if (algo === 'scrypt') {
    const n = args[0] ? parseInt(args[0], 10) : DEFAULT_SCRYPT_N;
    const r = args[1] ? parseInt(args[1], 10) : DEFAULT_SCRYPT_R;
    const p = args[2] ? parseInt(args[2], 10) : DEFAULT_SCRYPT_P;
    const hashHex = hashScrypt(password, salt, n, r, p);
    return `scrypt:${n}:${r}:${p}$${salt}$${hashHex}`;
  }

  if (algo === 'pbkdf2') {
    const digest = args[0] ?? 'sha256';
    const iterations = args[1]
      ? parseInt(args[1], 10)
      : DEFAULT_PBKDF2_ITERATIONS;
    const hashHex = hashPbkdf2(password, salt, digest, iterations);
    return `pbkdf2:${digest}:${iterations}$${salt}$${hashHex}`;
  }

  throw new Error(`Invalid hash method '${algo}'.`);
}
