"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDER_LOW_TO_HIGH = exports.ROLE_RANK = exports.USER = exports.ADMIN = exports.SUPER_ADMIN = exports.SYSTEM_ADMIN = void 0;
exports.normalizeRoleCode = normalizeRoleCode;
exports.hierarchyRank = hierarchyRank;
exports.rankAtLeast = rankAtLeast;
exports.SYSTEM_ADMIN = 'SYSTEM_ADMIN';
exports.SUPER_ADMIN = 'SUPER_ADMIN';
exports.ADMIN = 'ADMIN';
exports.USER = 'USER';
exports.ROLE_RANK = {
    [exports.USER]: 1,
    [exports.ADMIN]: 2,
    [exports.SUPER_ADMIN]: 3,
    [exports.SYSTEM_ADMIN]: 4,
};
exports.ORDER_LOW_TO_HIGH = [
    exports.USER,
    exports.ADMIN,
    exports.SUPER_ADMIN,
    exports.SYSTEM_ADMIN,
];
function normalizeRoleCode(role) {
    if (!role) {
        return null;
    }
    const r = role.trim();
    if (r in exports.ROLE_RANK) {
        return r;
    }
    return null;
}
function hierarchyRank(roleCode) {
    const code = normalizeRoleCode(roleCode);
    if (!code) {
        return 0;
    }
    return exports.ROLE_RANK[code] ?? 0;
}
function rankAtLeast(roleCode, minCode) {
    return hierarchyRank(roleCode) >= exports.ROLE_RANK[minCode];
}
//# sourceMappingURL=roles.js.map