"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSIONS_SYSTEM_ADMIN = exports.PERMISSIONS_SUPER_ADMIN = exports.PERMISSIONS_ADMIN = exports.PERMISSIONS_USER = void 0;
exports.PERMISSIONS_USER = [
    'submissions.submit',
    'submissions.read_own',
    'water_logs.write_assigned',
    'submissions.edit_draft_or_reverted',
    'notifications.read',
    'dashboard.operator',
];
exports.PERMISSIONS_ADMIN = [
    ...exports.PERMISSIONS_USER,
    'water_systems.manage_tehsil',
    'solar_systems.manage_tehsil',
    'solar_monthly_logs.write_tehsil',
    'submissions.verify',
    'submissions.reject',
    'submissions.revert',
    'submissions.queue',
    'audit.read_scoped',
    'dashboard.staff',
];
const PERMISSIONS_READ_GLOBAL = [
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
];
exports.PERMISSIONS_SUPER_ADMIN = [
    ...PERMISSIONS_READ_GLOBAL,
];
exports.PERMISSIONS_SYSTEM_ADMIN = [
    ...PERMISSIONS_READ_GLOBAL,
    'org.read_all',
];
//# sourceMappingURL=permissions.js.map