export declare function buildDatabaseUri(rawUri: string): string;
export declare function maskDatabaseUri(uri: string): string;
export declare function getDatabaseUriFromEnv(): string;
export declare function getPgSslOptions(): {
    rejectUnauthorized: boolean;
} | false;
export interface TypeOrmPostgresConnectionOptions {
    url: string;
    ssl: {
        rejectUnauthorized: boolean;
    } | false;
    extra: Record<string, unknown>;
}
export declare function buildTypeOrmPostgresConnection(rawUri: string): TypeOrmPostgresConnectionOptions;
export declare function hostnameResolvesAsync(hostname: string): Promise<boolean>;
