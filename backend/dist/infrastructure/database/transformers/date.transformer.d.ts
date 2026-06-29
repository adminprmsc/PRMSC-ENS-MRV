import type { ValueTransformer } from 'typeorm';
export declare function parsePgDate(value: unknown): Date | null;
export declare const dateColumnTransformer: ValueTransformer;
export declare function parsePgTimestamp(value: unknown): Date | null;
export declare const timestampColumnTransformer: ValueTransformer;
