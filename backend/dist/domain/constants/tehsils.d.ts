export declare const PREDEFINED_TAHSILS: readonly string[];
export declare function canonicalTehsil(name: string | null | undefined): string | null;
export declare function isValidTehsil(name: string | null | undefined): boolean;
export declare function validateTehsilAssignments(tehsils: unknown): string[];
