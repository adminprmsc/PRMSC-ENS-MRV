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
exports.TehsilManagerGuard = void 0;
const common_1 = require("@nestjs/common");
const roles_1 = require("../../domain/constants/roles");
const user_service_1 = require("../../application/services/user.service");
let TehsilManagerGuard = class TehsilManagerGuard {
    userService;
    constructor(userService) {
        this.userService = userService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const claims = request.user;
        if (!claims?.sub) {
            throw new common_1.ForbiddenException({ message: 'Access Forbidden' });
        }
        if ((0, roles_1.normalizeRoleCode)(claims.role) !== roles_1.ADMIN) {
            throw new common_1.ForbiddenException({
                message: 'Access Forbidden: tehsil manager role required',
                your_role: claims.role,
            });
        }
        const user = await this.userService.getUserById(claims.sub);
        if (!user) {
            throw new common_1.NotFoundException({ message: 'User not found' });
        }
        const tehsils = await this.userService.getAssignedTehsils(user);
        if (!tehsils.length) {
            throw new common_1.ForbiddenException({
                message: 'No tehsil assignments — contact operations',
            });
        }
        return true;
    }
};
exports.TehsilManagerGuard = TehsilManagerGuard;
exports.TehsilManagerGuard = TehsilManagerGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_service_1.UserService])
], TehsilManagerGuard);
//# sourceMappingURL=tehsil-manager.guard.js.map