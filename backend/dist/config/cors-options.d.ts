import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
export declare const CORS_ALLOWED_HEADERS: readonly ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"];
export declare function buildCorsOptions(allowedOrigins: string[]): CorsOptions;
