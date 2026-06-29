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
exports.AuthService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const password_reset_token_entity_1 = require("../../infrastructure/database/entities/password-reset-token.entity");
const user_relations_1 = require("../../infrastructure/database/entities/user-relations");
const user_entity_1 = require("../../infrastructure/database/entities/user.entity");
function hashResetToken(raw) {
    return (0, node_crypto_1.createHash)('sha256').update(raw, 'utf8').digest('hex');
}
let AuthService = class AuthService {
    userRepo;
    resetTokenRepo;
    config;
    constructor(userRepo, resetTokenRepo, config) {
        this.userRepo = userRepo;
        this.resetTokenRepo = resetTokenRepo;
        this.config = config;
    }
    async authenticate(email, password) {
        const user = await this.userRepo.findOne({
            where: { email: email.trim().toLowerCase() },
            relations: user_relations_1.USER_RELATIONS,
        });
        if (!user || !user.checkPassword(password)) {
            return null;
        }
        return user;
    }
    async changePassword(user, currentPassword, newPassword) {
        const minLen = this.config.get('app.passwordMinLength', 8);
        if (!user.checkPassword(currentPassword)) {
            throw new Error('Current password is incorrect');
        }
        if (newPassword.length < minLen) {
            throw new Error(`New password must be at least ${minLen} characters`);
        }
        if (newPassword === currentPassword) {
            throw new Error('New password must be different from the current password');
        }
        user.setPassword(newPassword);
        await this.resetTokenRepo.delete({ userId: user.id });
        await this.userRepo.save(user);
    }
    async requestPasswordReset(email) {
        const user = await this.userRepo.findOne({
            where: { email: email.trim().toLowerCase() },
        });
        if (!user) {
            return { user: null, rawToken: null };
        }
        await this.resetTokenRepo.delete({
            userId: user.id,
            usedAt: (0, typeorm_2.IsNull)(),
        });
        const raw = (0, node_crypto_1.randomBytes)(48).toString('base64url');
        const ttlH = this.config.get('app.passwordResetTokenTtlHours', 1);
        const expires = new Date(Date.now() + ttlH * 60 * 60 * 1000);
        const row = this.resetTokenRepo.create({
            userId: user.id,
            tokenHash: hashResetToken(raw),
            expiresAt: expires,
        });
        await this.resetTokenRepo.save(row);
        return { user, rawToken: raw };
    }
    async resetPasswordWithToken(rawToken, newPassword) {
        const minLen = this.config.get('app.passwordMinLength', 8);
        if (newPassword.length < minLen) {
            throw new Error(`Password must be at least ${minLen} characters`);
        }
        if (!rawToken?.trim()) {
            throw new Error('token is required');
        }
        const th = hashResetToken(rawToken.trim());
        const now = new Date();
        const row = await this.resetTokenRepo.findOne({
            where: {
                tokenHash: th,
                usedAt: (0, typeorm_2.IsNull)(),
                expiresAt: (0, typeorm_2.MoreThan)(now),
            },
        });
        if (!row) {
            throw new Error('Invalid or expired reset token');
        }
        const user = await this.userRepo.findOne({ where: { id: row.userId } });
        if (!user) {
            throw new Error('Invalid or expired reset token');
        }
        user.setPassword(newPassword);
        row.usedAt = now;
        await this.userRepo.save(user);
        await this.resetTokenRepo.save(row);
        await this.resetTokenRepo
            .createQueryBuilder()
            .delete()
            .where('user_id = :userId AND id != :id', { userId: user.id, id: row.id })
            .execute();
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(password_reset_token_entity_1.PasswordResetToken)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map