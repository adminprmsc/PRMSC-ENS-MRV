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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const roles_1 = require("../../domain/constants/roles");
const user_service_1 = require("../../application/services/user.service");
const tehsil_access_service_1 = require("../../application/services/tehsil-access.service");
const jwt_auth_guard_1 = require("../../infrastructure/auth/jwt-auth.guard");
const min_role_guard_1 = require("../../infrastructure/auth/min-role.guard");
const min_role_decorator_1 = require("../../infrastructure/auth/decorators/min-role.decorator");
const current_user_decorator_1 = require("../../infrastructure/auth/decorators/current-user.decorator");
const auth_dto_1 = require("../dto/auth.dto");
const roles_2 = require("../../domain/constants/roles");
let UsersController = class UsersController {
    userService;
    constructor(userService) {
        this.userService = userService;
    }
    async listUsers() {
        const users = await this.userService.getAllUsers();
        return {
            users: await Promise.all(users.map(async (user) => ({
                id: String(user.id),
                name: user.name,
                email: user.email,
                role: user.role,
                tehsils: await this.userService.getAssignedTehsils(user),
                water_system_ids: user.assignedWaterSystemIds,
                created_at: user.createdAt?.toISOString() ?? null,
            }))),
        };
    }
    async onboardOperator(actorId, body) {
        const actor = await this.userService.getUserById(actorId);
        if (!actor) {
            throw new common_1.NotFoundException({ message: 'User not found' });
        }
        try {
            const user = await this.userService.createTubewellOperator(body.name, body.email, body.password, body.water_system_ids, actor);
            return {
                message: 'Tubewell operator created',
                user: {
                    id: String(user.id),
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    tehsils: await this.userService.getAssignedTehsils(user),
                    water_system_ids: user.assignedWaterSystemIds,
                },
            };
        }
        catch (err) {
            if (err instanceof tehsil_access_service_1.TehsilAccessDenied) {
                throw new common_1.ForbiddenException({ message: err.message });
            }
            throw new common_1.BadRequestException({
                message: err instanceof Error ? err.message : 'Onboarding failed',
            });
        }
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.SUPER_ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Post)('onboard-operator'),
    (0, common_1.UseGuards)(min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_2.ADMIN),
    (0, common_1.HttpCode)(201),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, auth_dto_1.OnboardOperatorDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "onboardOperator", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.Controller)('api/users'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [user_service_1.UserService])
], UsersController);
//# sourceMappingURL=users.controller.js.map