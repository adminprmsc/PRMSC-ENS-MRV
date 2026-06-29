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
var AuthController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const auth_service_1 = require("../../application/services/auth.service");
const email_service_1 = require("../../application/services/email.service");
const user_service_1 = require("../../application/services/user.service");
const user_manager_operation_entity_1 = require("../../infrastructure/database/entities/user-manager-operation.entity");
const jwt_auth_guard_1 = require("../../infrastructure/auth/jwt-auth.guard");
const current_user_decorator_1 = require("../../infrastructure/auth/decorators/current-user.decorator");
const auth_dto_1 = require("../dto/auth.dto");
let AuthController = AuthController_1 = class AuthController {
    authService;
    userService;
    emailService;
    jwtService;
    config;
    managerOpRepo;
    logger = new common_1.Logger(AuthController_1.name);
    constructor(authService, userService, emailService, jwtService, config, managerOpRepo) {
        this.authService = authService;
        this.userService = userService;
        this.emailService = emailService;
        this.jwtService = jwtService;
        this.config = config;
        this.managerOpRepo = managerOpRepo;
    }
    async login(body) {
        const user = await this.authService.authenticate(body.email, body.password);
        if (!user) {
            throw new common_1.UnauthorizedException({ message: 'Invalid email or password' });
        }
        const fullUser = (await this.userService.getUserById(String(user.id))) ?? user;
        const rank = fullUser.assignedRole?.hierarchyRank ?? 1;
        const moRows = await this.managerOpRepo.find({
            where: { userId: String(fullUser.id) },
        });
        const moTehsils = moRows
            .map((r) => String(r.tehsil).trim())
            .filter(Boolean);
        const tehsils = moTehsils.length
            ? moTehsils
            : await this.userService.getAssignedTehsils(fullUser);
        const waterSystemIds = fullUser.assignedWaterSystemIds;
        const token = this.jwtService.sign({
            sub: String(fullUser.id),
            role: fullUser.role,
            name: fullUser.name,
            tehsils,
            water_system_ids: waterSystemIds,
            hierarchy_rank: rank,
        });
        return {
            token,
            user: {
                id: String(fullUser.id),
                name: fullUser.name,
                role: fullUser.role,
                tehsils,
                manager_operation_tehsils: moTehsils,
                water_system_ids: waterSystemIds,
            },
        };
    }
    async changePassword(userId, body) {
        const user = await this.userService.getUserById(userId);
        if (!user) {
            throw new common_1.NotFoundException({ message: 'User not found' });
        }
        try {
            await this.authService.changePassword(user, body.current_password, body.new_password);
        }
        catch (err) {
            throw new common_1.UnauthorizedException({
                message: err instanceof Error ? err.message : 'Password change failed',
            });
        }
        return { message: 'Password updated successfully' };
    }
    async forgotPassword(body) {
        const { user, rawToken } = await this.authService.requestPasswordReset(body.email);
        if (user && rawToken) {
            try {
                const sent = await this.emailService.sendPasswordResetEmail(user.email, rawToken);
                if (sent) {
                    this.logger.log(`Password reset email sent to ${user.email}`);
                }
            }
            catch (err) {
                this.logger.error(`Failed to send password reset email: ${String(err)}`);
            }
        }
        const msg = 'If an account exists for that email, you will receive password reset instructions shortly.';
        const response = { message: msg };
        if (this.config.get('app.debug') &&
            this.config.get('app.passwordResetDevReturnToken') &&
            user &&
            rawToken) {
            response.reset_token = rawToken;
        }
        return response;
    }
    async resetPassword(body) {
        try {
            await this.authService.resetPasswordWithToken(body.token, body.new_password);
        }
        catch (err) {
            throw new common_1.UnauthorizedException({
                message: err instanceof Error ? err.message : 'Reset failed',
            });
        }
        return { message: 'Password has been reset. You can sign in now.' };
    }
    async profile(userId) {
        const user = await this.userService.getUserById(userId);
        if (!user) {
            throw new common_1.NotFoundException({ message: 'User not found' });
        }
        return {
            id: String(user.id),
            name: user.name,
            email: user.email,
            role: user.role,
            tehsils: await this.userService.getAssignedTehsils(user),
            water_system_ids: user.assignedWaterSystemIds,
            created_at: user.createdAt?.toISOString() ?? null,
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('change-password'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(200),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, auth_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.ForgotPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Get)('profile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "profile", null);
exports.AuthController = AuthController = AuthController_1 = __decorate([
    (0, common_1.Controller)('api/auth'),
    __param(5, (0, typeorm_1.InjectRepository)(user_manager_operation_entity_1.UserManagerOperation)),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        user_service_1.UserService,
        email_service_1.EmailService,
        jwt_1.JwtService,
        config_1.ConfigService,
        typeorm_2.Repository])
], AuthController);
//# sourceMappingURL=auth.controller.js.map