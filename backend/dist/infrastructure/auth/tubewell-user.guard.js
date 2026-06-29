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
exports.TubewellUserGuard = void 0;
const common_1 = require("@nestjs/common");
const roles_1 = require("../../domain/constants/roles");
const user_service_1 = require("../../application/services/user.service");
let TubewellUserGuard = class TubewellUserGuard {
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
        if ((0, roles_1.normalizeRoleCode)(claims.role) !== roles_1.USER) {
            throw new common_1.ForbiddenException({
                message: 'Access Forbidden: tubewell operator role required',
                your_role: claims.role,
            });
        }
        const user = await this.userService.getUserById(claims.sub);
        if (!user) {
            throw new common_1.NotFoundException({ message: 'User not found' });
        }
        if (!user.assignedWaterSystemIds.length) {
            throw new common_1.ForbiddenException({
                message: 'No water systems assigned — contact your tehsil manager',
            });
        }
        return true;
    }
};
exports.TubewellUserGuard = TubewellUserGuard;
exports.TubewellUserGuard = TubewellUserGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_service_1.UserService])
], TubewellUserGuard);
//# sourceMappingURL=tubewell-user.guard.js.map