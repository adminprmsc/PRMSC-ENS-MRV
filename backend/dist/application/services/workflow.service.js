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
exports.WorkflowService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const tehsils_1 = require("../../domain/constants/tehsils");
const roles_1 = require("../../domain/constants/roles");
const notification_entity_1 = require("../../infrastructure/database/entities/notification.entity");
const role_entity_1 = require("../../infrastructure/database/entities/role.entity");
const user_entity_1 = require("../../infrastructure/database/entities/user.entity");
const user_tehsil_entity_1 = require("../../infrastructure/database/entities/user-tehsil.entity");
const verification_log_entity_1 = require("../../infrastructure/database/entities/verification-log.entity");
const rbac_service_1 = require("./rbac.service");
let WorkflowService = class WorkflowService {
    verificationLogRepo;
    notificationRepo;
    userRepo;
    userTehsilRepo;
    rbac;
    constructor(verificationLogRepo, notificationRepo, userRepo, userTehsilRepo, rbac) {
        this.verificationLogRepo = verificationLogRepo;
        this.notificationRepo = notificationRepo;
        this.userRepo = userRepo;
        this.userTehsilRepo = userTehsilRepo;
        this.rbac = rbac;
    }
    async logVerificationAction(submissionId, actionType, userId, role, comment) {
        const log = this.verificationLogRepo.create({
            submissionId,
            actionType,
            performedBy: userId,
            role,
            comment: comment ?? null,
        });
        return this.verificationLogRepo.save(log);
    }
    async createNotification(userId, title, message, submissionId) {
        const notification = this.notificationRepo.create({
            userId,
            title,
            message,
            submissionId: submissionId ?? null,
        });
        return this.notificationRepo.save(notification);
    }
    async notifyAnalysts(title, message, submissionId, tehsil) {
        const recipients = new Map();
        const globalAdmins = await this.userRepo
            .createQueryBuilder('u')
            .innerJoin(role_entity_1.Role, 'r', 'r.id = u.role_id')
            .where('r.code IN (:...codes)', { codes: [roles_1.SYSTEM_ADMIN, roles_1.SUPER_ADMIN] })
            .getMany();
        for (const u of globalAdmins) {
            recipients.set(String(u.id), u);
        }
        if (tehsil) {
            const c = (0, tehsils_1.canonicalTehsil)(tehsil);
            if (c) {
                const links = await this.userTehsilRepo.find({ where: { tehsil: c } });
                for (const row of links) {
                    const u = await this.userRepo.findOne({ where: { id: row.userId } });
                    if (u && this.rbac.userRoleCode(u) === roles_1.ADMIN) {
                        recipients.set(String(u.id), u);
                    }
                }
            }
        }
        for (const u of recipients.values()) {
            await this.createNotification(u.id, title, message, submissionId);
        }
    }
    async notifyOperator(operatorId, title, message, submissionId) {
        await this.createNotification(operatorId, title, message, submissionId);
    }
};
exports.WorkflowService = WorkflowService;
exports.WorkflowService = WorkflowService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(verification_log_entity_1.VerificationLog)),
    __param(1, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(user_tehsil_entity_1.UserTehsil)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        rbac_service_1.RbacService])
], WorkflowService);
//# sourceMappingURL=workflow.service.js.map