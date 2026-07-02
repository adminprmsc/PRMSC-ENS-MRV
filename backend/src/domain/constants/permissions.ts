/**
 * Permission strings stored in `roles.permissions` (JSON array).
 *
 * Primary API access is enforced via role code, hierarchy_rank, and tehsil /
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

/** Manager Operations — HQ dashboard read/review for assigned tehsils only. */
export const PERMISSIONS_SUPER_ADMIN: readonly string[] = [
  'data.read_scoped',
  'dashboard.program',
  'submissions.read_scoped',
  'water_systems.read_scoped',
  'solar_systems.read_scoped',
  'water_logs.read_scoped',
  'solar_monthly_logs.read_scoped',
  'audit.read_scoped',
  'notifications.read',
] as const;

/** Platform administrator — user accounts, roles, tehsil scope assignment, passwords. */
export const PERMISSIONS_SYSTEM_ADMIN: readonly string[] = [
  'users.create',
  'users.read',
  'users.update',
  'users.update_role',
  'users.assign_tehsils',
  'users.reset_password',
  'dashboard.admin',
  'notifications.read',
] as const;
