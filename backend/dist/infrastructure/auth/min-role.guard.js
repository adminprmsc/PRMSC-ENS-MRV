"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinRoleGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const roles_1 = require("../../domain/constants/roles");
const min_role_decorator_1 = require("./decorators/min-role.decorator");
let MinRoleGuard = class MinRoleGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const minCode = this.reflector.getAllAndOverride(min_role_decorator_1.MIN_ROLE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!minCode) {
            return true;
        }
        const mc = (0, roles_1.normalizeRoleCode)(minCode) ?? minCode;
        const need = roles_1.ROLE_RANK[mc];
        if (need == null) {
            throw new Error(`MinRoleGuard: invalid role ${minCode}`);
        }
        const request = context.switchToHttp().getRequest();
        const claims = request.user;
        if (!claims) {
            throw new common_1.ForbiddenException({
                message: 'Access Forbidden: insufficient role level',
                min_role: minCode,
            });
        }
        const rank = claims.hierarchy_rank != null
            ? Number(claims.hierarchy_rank)
            : (0, roles_1.hierarchyRank)(claims.role);
        if (rank < need) {
            throw new common_1.ForbiddenException({
                message: 'Access Forbidden: insufficient role level',
                min_role: minCode,
                your_role: claims.role,
            });
        }
        return true;
    }
};
exports.MinRoleGuard = MinRoleGuard;
exports.MinRoleGuard = MinRoleGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], MinRoleGuard);
//# sourceMappingURL=min-role.guard.js.map