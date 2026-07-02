/**
 * Role hierarchy (highest rank first):
 *
 *   SYSTEM_ADMIN (4) — Platform administrator — user accounts, role assignment,
 *                      tehsil scope for Manager Operations users; no MRV data access
 *   SUPER_ADMIN  (3) — Manager Operations — HQ dashboard, read/review for assigned tehsils only
 *   ADMIN        (2) — Tehsil Manager — tehsil-scoped facility ops + verification writes
 *   USER         (1) — Tubewell Operator — daily water logging only
 *
 * SUPER_ADMIN tehsil scope is stored in `user_manageroperation` (assigned by SYSTEM_ADMIN).
 * ADMIN tehsil scope is stored in `user_tehsils`.
 *
 * Only canonical JWT/DB codes are accepted (no legacy aliases).
 */

export const SYSTEM_ADMIN = 'SYSTEM_ADMIN';
export const SUPER_ADMIN = 'SUPER_ADMIN';
export const ADMIN = 'ADMIN';
export const USER = 'USER';

export const ROLE_RANK: Record<string, number> = {
  [USER]: 1,
  [ADMIN]: 2,
  [SUPER_ADMIN]: 3,
  [SYSTEM_ADMIN]: 4,
};

/** Platform administrator — user management only, no MRV data access. */
export const USER_ADMIN_ROLES: readonly string[] = [SYSTEM_ADMIN] as const;

export const ORDER_LOW_TO_HIGH: readonly string[] = [
  USER,
  ADMIN,
  SUPER_ADMIN,
  SYSTEM_ADMIN,
] as const;

export function normalizeRoleCode(
  role: string | null | undefined,
): string | null {
  if (!role) {
    return null;
  }
  const r = role.trim();
  if (r in ROLE_RANK) {
    return r;
  }
  return null;
}

export function hierarchyRank(roleCode: string | null | undefined): number {
  const code = normalizeRoleCode(roleCode);
  if (!code) {
    return 0;
  }
  return ROLE_RANK[code] ?? 0;
}

export function isUserAdminRole(roleCode: string | null | undefined): boolean {
  return normalizeRoleCode(roleCode) === SYSTEM_ADMIN;
}

export function isExecutiveReviewerRole(
  roleCode: string | null | undefined,
): boolean {
  return normalizeRoleCode(roleCode) === SUPER_ADMIN;
}

/** Rank check for MRV / tehsil data endpoints — SYSTEM_ADMIN is always denied. */
export function rankAtLeast(
  roleCode: string | null | undefined,
  minCode: string,
): boolean {
  if (isUserAdminRole(roleCode)) {
    return false;
  }
  return hierarchyRank(roleCode) >= ROLE_RANK[minCode];
}

/** Rank check for user-admin endpoints — only SYSTEM_ADMIN (or higher rank) passes. */
export function rankAtLeastForAdmin(
  roleCode: string | null | undefined,
  minCode: string,
): boolean {
  return hierarchyRank(roleCode) >= ROLE_RANK[minCode];
}
