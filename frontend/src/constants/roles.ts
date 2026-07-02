/**
 * Canonical codes — must match backend `roles.code`, JWT claims, and
 * `backend/app/constants/roles.py` / `app.rbac`.
 */

export const ROLE = {
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type UserRole = (typeof ROLE)[keyof typeof ROLE];

/** Roles allowed to use this web portal (tubewell operators use other channels). */
export const PORTAL_ROLES: readonly UserRole[] = [
  ROLE.ADMIN,
  ROLE.SUPER_ADMIN,
  ROLE.SYSTEM_ADMIN,
];

/** Tehsil Manager Operator — tehsil-scoped operations. */
export const TEHSIL_MANAGER_ROLES: readonly UserRole[] = [ROLE.ADMIN];

/** Manager Operations — HQ dashboard (tehsil scope from assigned tehsils in JWT). */
export const EXECUTIVE_ROLES: readonly UserRole[] = [ROLE.SUPER_ADMIN];

/** Platform administrator — user accounts and access only. */
export const USER_ADMIN_ROLES: readonly UserRole[] = [ROLE.SYSTEM_ADMIN];

/** Roles that can open the tehsil submissions / verification queue UI. */
export const STAFF_ROLES: readonly UserRole[] = [ROLE.ADMIN];

/** Only Tehsil Manager may onboard operators and register tehsil facilities. */
export const TEHSIL_FACILITY_ROLES: readonly UserRole[] = [ROLE.ADMIN];

/** Read-only review on HQ / submissions — no verify/reject mutations. */
export const READ_ONLY_REVIEW_ROLES: readonly UserRole[] = [ROLE.SUPER_ADMIN];

/** Manager Operations — final approval when implemented. */
export const APPROVER_ROLES: readonly UserRole[] = [ROLE.SUPER_ADMIN];

export const ROLE_LABEL: Record<UserRole, string> = {
  [ROLE.SYSTEM_ADMIN]: "Platform Administrator",
  [ROLE.SUPER_ADMIN]: "Manager Operations",
  [ROLE.ADMIN]: "Tehsil Manager Operator",
  [ROLE.USER]: "Tubewell operator",
};

export function normalizeRole(role: string | undefined | null): UserRole | undefined {
  if (!role) return undefined;
  const r = role.trim();
  return Object.values(ROLE).includes(r as UserRole) ? (r as UserRole) : undefined;
}

export function roleDisplayLabel(role: string | undefined | null): string {
  const n = normalizeRole(role);
  return n ? ROLE_LABEL[n] : "User";
}

export function isPortalRole(role: string | undefined | null): boolean {
  const n = normalizeRole(role);
  return n !== undefined && PORTAL_ROLES.includes(n);
}

export function isTehsilManager(role: string | undefined | null): boolean {
  return normalizeRole(role) === ROLE.ADMIN;
}

export function isExecutiveRole(role: string | undefined | null): boolean {
  const n = normalizeRole(role);
  return n !== undefined && EXECUTIVE_ROLES.includes(n);
}

export function isUserAdminRole(role: string | undefined | null): boolean {
  const n = normalizeRole(role);
  return n !== undefined && USER_ADMIN_ROLES.includes(n);
}

export function isStaffRole(role: string | undefined | null): boolean {
  const n = normalizeRole(role);
  return n !== undefined && STAFF_ROLES.includes(n);
}

export function isReadOnlyReviewer(role: string | undefined | null): boolean {
  const n = normalizeRole(role);
  return n !== undefined && READ_ONLY_REVIEW_ROLES.includes(n);
}

/** Legacy field role (not used in this portal login flow). */
export function isTubewellOperator(role: string | undefined | null): boolean {
  return normalizeRole(role) === ROLE.USER;
}

export function canOnboardOperators(role: string | undefined | null): boolean {
  const n = normalizeRole(role);
  return n !== undefined && TEHSIL_FACILITY_ROLES.includes(n);
}

export function canRegisterTehsilFacilities(role: string | undefined | null): boolean {
  const n = normalizeRole(role);
  return n !== undefined && TEHSIL_FACILITY_ROLES.includes(n);
}

export function canApproveSubmissions(role: string | undefined | null): boolean {
  const n = normalizeRole(role);
  return n !== undefined && APPROVER_ROLES.includes(n);
}

/** @deprecated Use isPortalRole / isTehsilManager / isExecutiveRole */
export function canAccessOperatorPortal(role: string | undefined | null): boolean {
  return isPortalRole(role);
}

/** @deprecated Use canRegisterTehsilFacilities */
export function canRegisterFacilities(role: string | undefined | null): boolean {
  return canRegisterTehsilFacilities(role);
}

/** Default landing route after login. */
export function defaultPathForRole(role: string | undefined | null): string {
  if (isTehsilManager(role)) return "/tehsil";
  if (isExecutiveRole(role)) return "/hq";
  if (isUserAdminRole(role)) return "/admin/users";
  return "/login";
}
