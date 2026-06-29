"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseUri = buildDatabaseUri;
exports.maskDatabaseUri = maskDatabaseUri;
exports.getDatabaseUriFromEnv = getDatabaseUriFromEnv;
exports.getPgSslOptions = getPgSslOptions;
exports.buildTypeOrmPostgresConnection = buildTypeOrmPostgresConnection;
exports.hostnameResolvesAsync = hostnameResolvesAsync;
const node_child_process_1 = require("node:child_process");
const dns = __importStar(require("node:dns/promises"));
const net = __importStar(require("node:net"));
function normalizeScheme(uri) {
    if (uri.startsWith('postgres://')) {
        return uri.replace('postgres://', 'postgresql://');
    }
    return uri;
}
function ensureSslmode(uri) {
    const parsed = new URL(uri);
    if (!parsed.protocol.startsWith('postgresql')) {
        return uri;
    }
    parsed.searchParams.set('uselibpqcompat', 'true');
    if (!parsed.searchParams.has('sslmode')) {
        parsed.searchParams.set('sslmode', 'require');
    }
    return parsed.toString();
}
function isIpv4(host) {
    return net.isIP(host) === 4;
}
async function hostnameResolves(hostname) {
    try {
        await dns.lookup(hostname);
        return true;
    }
    catch {
        return false;
    }
}
function firstIpv4FromDigOutput(stdout) {
    for (const line of stdout.split('\n')) {
        const candidate = line.trim().replace(/\.$/, '');
        if (isIpv4(candidate)) {
            return candidate;
        }
    }
    return null;
}
function resolveViaPublicDns(hostname) {
    for (const resolver of ['8.8.8.8', '1.1.1.1']) {
        try {
            const stdout = (0, node_child_process_1.execSync)(`dig +short ${hostname} A @${resolver}`, {
                encoding: 'utf8',
                timeout: 8000,
            });
            const ip = firstIpv4FromDigOutput(stdout);
            if (ip) {
                return ip;
            }
        }
        catch {
            continue;
        }
    }
    return null;
}
function replaceHostnameInUri(uri, ip) {
    const parsed = new URL(uri);
    const port = parsed.port || '5432';
    parsed.hostname = ip;
    if (!parsed.port) {
        parsed.port = port;
    }
    return parsed.toString();
}
function applyDnsFallbackIfNeeded(uri) {
    const flag = (process.env.DATABASE_DNS_FALLBACK ?? '1').trim().toLowerCase();
    if (flag === '0' || flag === 'false' || flag === 'no') {
        return uri;
    }
    const parsed = new URL(uri);
    const host = parsed.hostname;
    if (!host || isIpv4(host)) {
        return uri;
    }
    let resolves = false;
    try {
        (0, node_child_process_1.execSync)(`node -e "require('dns').lookupSync('${host}')"`, {
            stdio: 'ignore',
        });
        resolves = true;
    }
    catch {
        resolves = false;
    }
    if (resolves) {
        return uri;
    }
    const overrideIp = (process.env.DATABASE_HOST_IP ?? '').trim();
    if (overrideIp && isIpv4(overrideIp)) {
        console.warn(`Using DATABASE_HOST_IP=${overrideIp} for database host ${host}`);
        return replaceHostnameInUri(uri, overrideIp);
    }
    const ip = resolveViaPublicDns(host);
    if (!ip) {
        return uri;
    }
    console.warn(`System DNS could not resolve database host ${host}; connecting via ${ip} ` +
        `(public DNS fallback). Fix local DNS or set DATABASE_HOST_IP=${ip} in .env.`);
    return replaceHostnameInUri(uri, ip);
}
function buildDatabaseUri(rawUri) {
    let uri = (rawUri ?? '').trim();
    if (!uri) {
        throw new Error('DATABASE_URL is required for PostgreSQL/Supabase connection.');
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
function maskDatabaseUri(uri) {
    const parsed = new URL(uri);
    if (!parsed.password) {
        return uri;
    }
    parsed.password = '***';
    return parsed.toString();
}
function getDatabaseUriFromEnv() {
    return buildDatabaseUri(process.env.DATABASE_URL ?? '');
}
function getPgSslOptions() {
    const raw = (process.env.DATABASE_URL ?? '').trim();
    if (!raw) {
        return false;
    }
    const parsed = new URL(normalizeScheme(raw));
    if (!parsed.protocol.startsWith('postgresql')) {
        return false;
    }
    const sslmode = (parsed.searchParams.get('sslmode') ?? 'require').toLowerCase();
    if (sslmode === 'disable' || sslmode === 'false') {
        return false;
    }
    const strict = ['1', 'true', 'yes'].includes((process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? 'false')
        .trim()
        .toLowerCase());
    return { rejectUnauthorized: strict };
}
function buildTypeOrmPostgresConnection(rawUri) {
    const url = buildDatabaseUri(rawUri);
    const isVercel = ['1', 'true', 'yes'].includes((process.env.VERCEL ?? '').trim().toLowerCase());
    const extra = isVercel
        ? { max: 1, idleTimeoutMillis: 1 }
        : { max: 10 };
    return {
        url,
        ssl: getPgSslOptions(),
        extra,
    };
}
async function hostnameResolvesAsync(hostname) {
    return hostnameResolves(hostname);
}
//# sourceMappingURL=supabase-database.util.js.map