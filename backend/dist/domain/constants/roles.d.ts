export declare const SYSTEM_ADMIN = "SYSTEM_ADMIN";
export declare const SUPER_ADMIN = "SUPER_ADMIN";
export declare const ADMIN = "ADMIN";
export declare const USER = "USER";
export declare const ROLE_RANK: Record<string, number>;
export declare const ORDER_LOW_TO_HIGH: readonly string[];
export declare function normalizeRoleCode(role: string | null | undefined): string | null;
export declare function hierarchyRank(roleCode: string | null | undefined): number;
export declare function rankAtLeast(roleCode: string | null | undefined, minCode: string): boolean;
