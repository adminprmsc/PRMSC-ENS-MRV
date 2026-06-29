"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPasswordHash = checkPasswordHash;
exports.generatePasswordHash = generatePasswordHash;
const node_crypto_1 = require("node:crypto");
const DEFAULT_SCRYPT_N = 2 ** 15;
const DEFAULT_SCRYPT_R = 8;
const DEFAULT_SCRYPT_P = 1;
const DEFAULT_PBKDF2_ITERATIONS = 1_000_000;
const DEFAULT_SALT_LENGTH = 16;
function parseHash(storedHash) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) {
        throw new Error('Invalid hash format');
    }
    const [methodPart, salt, hashHex] = parts;
    const colonIdx = methodPart.indexOf(':');
    const method = colonIdx >= 0 ? methodPart.slice(0, colonIdx) : methodPart;
    const args = colonIdx >= 0
        ? methodPart
            .slice(colonIdx + 1)
            .split(':')
            .filter(Boolean)
        : [];
    return { method, args, salt, hashHex };
}
function hashScrypt(password, salt, n, r, p) {
    const maxmem = 132 * n * r * p;
    const keylen = 64;
    return (0, node_crypto_1.scryptSync)(password, salt, keylen, { N: n, r, p, maxmem }).toString('hex');
}
function hashPbkdf2(password, salt, digest, iterations) {
    const keylen = 32;
    return (0, node_crypto_1.pbkdf2Sync)(password, salt, iterations, keylen, digest).toString('hex');
}
function checkPasswordHash(storedHash, password) {
    try {
        const { method, args, salt, hashHex } = parseHash(storedHash);
        let derived;
        let methodLabel;
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
        }
        else if (method === 'pbkdf2') {
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
        }
        else {
            return false;
        }
        const expected = Buffer.from(hashHex, 'hex');
        const actual = Buffer.from(derived, 'hex');
        if (expected.length !== actual.length) {
            return false;
        }
        return (0, node_crypto_1.timingSafeEqual)(expected, actual);
    }
    catch {
        return false;
    }
}
function generatePasswordHash(password, method = `scrypt:${DEFAULT_SCRYPT_N}:${DEFAULT_SCRYPT_R}:${DEFAULT_SCRYPT_P}`, saltLength = DEFAULT_SALT_LENGTH) {
    const salt = (0, node_crypto_1.randomBytes)(saltLength).toString('hex');
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
//# sourceMappingURL=werkzeug-password.js.map