/**
 * Role hierarchy (highest rank first):
 *
 *   SYSTEM_ADMIN  (4) — MRV COO — program-wide read-only
 *   SUPER_ADMIN   (3) — Manager Operations — program-wide read-only
 *   ADMIN         (2) — Tehsil Manager — water/solar registry + solar logging + review
 *   USER          (1) — Tubewell Operator — daily water logging only
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

export function rankAtLeast(
  roleCode: string | null | undefined,
  minCode: string,
): boolean {
  return hierarchyRank(roleCode) >= ROLE_RANK[minCode];
}
