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
exports.RbacService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const tehsils_1 = require("../../domain/constants/tehsils");
const roles_1 = require("../../domain/constants/roles");
const submission_entity_1 = require("../../infrastructure/database/entities/submission.entity");
const water_energy_logging_daily_entity_1 = require("../../infrastructure/database/entities/water-energy-logging-daily.entity");
const water_system_entity_1 = require("../../infrastructure/database/entities/water-system.entity");
const solar_energy_logging_monthly_entity_1 = require("../../infrastructure/database/entities/solar-energy-logging-monthly.entity");
const solar_system_entity_1 = require("../../infrastructure/database/entities/solar-system.entity");
const tehsil_access_service_1 = require("./tehsil-access.service");
let RbacService = class RbacService {
    tehsilAccess;
    submissionRepo;
    waterLogRepo;
    waterSystemRepo;
    solarLogRepo;
    solarSystemRepo;
    SYSTEM_ADMIN = roles_1.SYSTEM_ADMIN;
    SUPER_ADMIN = roles_1.SUPER_ADMIN;
    ADMIN = roles_1.ADMIN;
    USER = roles_1.USER;
    ROLE_RANK = roles_1.ROLE_RANK;
    constructor(tehsilAccess, submissionRepo, waterLogRepo, waterSystemRepo, solarLogRepo, solarSystemRepo) {
        this.tehsilAccess = tehsilAccess;
        this.submissionRepo = submissionRepo;
        this.waterLogRepo = waterLogRepo;
        this.waterSystemRepo = waterSystemRepo;
        this.solarLogRepo = solarLogRepo;
        this.solarSystemRepo = solarSystemRepo;
    }
    normalizeRoleCode(role) {
        return (0, roles_1.normalizeRoleCode)(role);
    }
    hierarchyRank(roleCode) {
        return (0, roles_1.hierarchyRank)(roleCode);
    }
    rankAtLeast(roleCode, minCode) {
        return (0, roles_1.hierarchyRank)(roleCode) >= roles_1.ROLE_RANK[minCode];
    }
    effectivePermissions(permissionsJson) {
        if (!permissionsJson) {
            return new Set();
        }
        if (Array.isArray(permissionsJson)) {
            return new Set(permissionsJson);
        }
        return new Set();
    }
    hasPermission(permissionsJson, permission) {
        return this.effectivePermissions(permissionsJson).has(permission);
    }
    async userAssignedTehsils(user) {
        if (this.userRoleCode(user) === roles_1.USER) {
            return this.tehsilAccess.operatorTehsilsDerivedFromWaterSystems(user);
        }
        return new Set((user.tehsilLinks ?? []).map((link) => link.tehsil));
    }
    userRank(user) {
        if (user.assignedRole) {
            return user.assignedRole.hierarchyRank || 1;
        }
        return (0, roles_1.hierarchyRank)(user.role);
    }
    userRoleCode(user) {
        if (user.assignedRole) {
            return user.assignedRole.code;
        }
        return (0, roles_1.normalizeRoleCode)(user.role) ?? roles_1.USER;
    }
    async canAccessTehsil(user, tehsil) {
        if (this.userRank(user) >= roles_1.ROLE_RANK[roles_1.SUPER_ADMIN]) {
            return true;
        }
        const code = this.userRoleCode(user);
        if (code !== roles_1.USER && code !== roles_1.ADMIN) {
            return false;
        }
        const c = (0, tehsils_1.canonicalTehsil)(tehsil);
        if (!c) {
            return false;
        }
        return (await this.userAssignedTehsils(user)).has(c);
    }
    tehsilScopeDeniedMessage() {
        return { error: 'Access denied for this tehsil' };
    }
    async submissionTehsil(submission) {
        if (submission.submissionType === 'water_system') {
            const record = await this.waterLogRepo.findOne({
                where: { id: submission.recordId },
            });
            if (!record) {
                return null;
            }
            const system = await this.waterSystemRepo.findOne({
                where: { id: record.waterSystemId },
            });
            return system?.tehsil ?? null;
        }
        if (submission.submissionType === 'solar_system') {
            const record = await this.solarLogRepo.findOne({
                where: { id: submission.recordId },
            });
            if (!record) {
                return null;
            }
            const system = await this.solarSystemRepo.findOne({
                where: { id: record.solarSystemId },
            });
            return system?.tehsil ?? null;
        }
        return null;
    }
    async userCanAccessSubmission(user, submission) {
        if (this.userRank(user) >= roles_1.ROLE_RANK[roles_1.SUPER_ADMIN]) {
            return true;
        }
        if (this.userRoleCode(user) === roles_1.USER) {
            if (String(submission.operatorId) !== String(user.id)) {
                return false;
            }
            if (submission.submissionType === 'water_system') {
                const record = await this.waterLogRepo.findOne({
                    where: { id: submission.recordId },
                });
                if (!record) {
                    return false;
                }
                return this.tehsilAccess
                    .assignedWaterSystemIdSet(user)
                    .has(String(record.waterSystemId));
            }
            const t = await this.submissionTehsil(submission);
            return t !== null && (await this.canAccessTehsil(user, t));
        }
        if (this.userRoleCode(user) === roles_1.ADMIN) {
            const t = await this.submissionTehsil(submission);
            return await this.canAccessTehsil(user, t);
        }
        return false;
    }
    async userCanViewSubmissionDetail(user, submission, currentUserId) {
        if (this.userRoleCode(user) === roles_1.USER) {
            if (String(submission.operatorId) !== String(currentUserId)) {
                return false;
            }
            if (submission.submissionType === 'water_system') {
                const record = await this.waterLogRepo.findOne({
                    where: { id: submission.recordId },
                });
                if (!record) {
                    return false;
                }
                return this.tehsilAccess
                    .assignedWaterSystemIdSet(user)
                    .has(String(record.waterSystemId));
            }
            const t = await this.submissionTehsil(submission);
            return await this.canAccessTehsil(user, t);
        }
        if (this.userRank(user) >= roles_1.ROLE_RANK[roles_1.SUPER_ADMIN]) {
            return true;
        }
        if (this.userRoleCode(user) === roles_1.ADMIN) {
            const t = await this.submissionTehsil(submission);
            return await this.canAccessTehsil(user, t);
        }
        return false;
    }
    async userCanVerifySubmission(user, submission) {
        const rk = this.userRank(user);
        if (rk < roles_1.ROLE_RANK[roles_1.ADMIN]) {
            return false;
        }
        if (rk >= roles_1.ROLE_RANK[roles_1.SUPER_ADMIN]) {
            return false;
        }
        const t = await this.submissionTehsil(submission);
        return await this.canAccessTehsil(user, t);
    }
};
exports.RbacService = RbacService;
exports.RbacService = RbacService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => tehsil_access_service_1.TehsilAccessService))),
    __param(1, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __param(2, (0, typeorm_1.InjectRepository)(water_energy_logging_daily_entity_1.WaterEnergyLoggingDaily)),
    __param(3, (0, typeorm_1.InjectRepository)(water_system_entity_1.WaterSystem)),
    __param(4, (0, typeorm_1.InjectRepository)(solar_energy_logging_monthly_entity_1.SolarEnergyLoggingMonthly)),
    __param(5, (0, typeorm_1.InjectRepository)(solar_system_entity_1.SolarSystem)),
    __metadata("design:paramtypes", [tehsil_access_service_1.TehsilAccessService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], RbacService);
//# sourceMappingURL=rbac.service.js.map