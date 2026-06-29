"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORS_ALLOWED_HEADERS = void 0;
exports.buildCorsOptions = buildCorsOptions;
exports.CORS_ALLOWED_HEADERS = [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
];
function buildCorsOptions(allowedOrigins) {
    const allowlist = new Set(allowedOrigins);
    return {
        origin: (origin, callback) => {
            if (!origin || allowlist.has(origin)) {
                callback(null, origin ?? true);
                return;
            }
            callback(new Error(`Origin ${origin} is not allowed by CORS`));
        },
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [...exports.CORS_ALLOWED_HEADERS],
        exposedHeaders: ['Content-Disposition'],
        credentials: true,
        preflightContinue: false,
        optionsSuccessStatus: 204,
    };
}
//# sourceMappingURL=cors-options.js.map