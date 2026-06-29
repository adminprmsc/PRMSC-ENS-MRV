/**
 * Permission strings stored in `roles.permissions` (JSON array).
 *
 * Primary API access is enforced via `hierarchy_rank`, role code, and tehsil /
 * water-system assignment. These strings document intent for auditing and admin tooling.
 */

/** Tubewell operator (USER). */
export const PERMISSIONS_USER: readonly string[] = [
  'submissions.submit',
  'submissions.read_own',
  'water_logs.write_assigned',
  'submissions.edit_draft_or_reverted',
  'notifications.read',
  'dashboard.operator',
] as const;

/** Tehsil manager (ADMIN): USER-relevant + tehsil oversight. */
export const PERMISSIONS_ADMIN: readonly string[] = [
  ...PERMISSIONS_USER,
  'water_systems.manage_tehsil',
  'solar_systems.manage_tehsil',
  'solar_monthly_logs.write_tehsil',
  'submissions.verify',
  'submissions.reject',
  'submissions.revert',
  'submissions.queue',
  'audit.read_scoped',
  'dashboard.staff',
] as const;

/** Program-wide read (Manager Operations) — no facility or verification writes. */
const PERMISSIONS_READ_GLOBAL: readonly string[] = [
  'data.read_all',
  'dashboard.program',
  'users.read',
  'submissions.read_all',
  'water_systems.read_all',
  'solar_systems.read_all',
  'water_logs.read_all',
  'solar_monthly_logs.read_all',
  'audit.read_all',
  'notifications.read',
] as const;

export const PERMISSIONS_SUPER_ADMIN: readonly string[] = [
  ...PERMISSIONS_READ_GLOBAL,
] as const;

/** MRV COO — same read scope as SUPER_ADMIN plus org-level read marker (no writes). */
export const PERMISSIONS_SYSTEM_ADMIN: readonly string[] = [
  ...PERMISSIONS_READ_GLOBAL,
  'org.read_all',
] as const;
