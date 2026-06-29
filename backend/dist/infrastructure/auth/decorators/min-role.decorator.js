"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinRole = exports.MIN_ROLE_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.MIN_ROLE_KEY = 'min_role';
const MinRole = (roleCode) => (0, common_1.SetMetadata)(exports.MIN_ROLE_KEY, roleCode);
exports.MinRole = MinRole;
//# sourceMappingURL=min-role.decorator.js.map