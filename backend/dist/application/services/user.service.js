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
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const roles_1 = require("../../domain/constants/roles");
const role_entity_1 = require("../../infrastructure/database/entities/role.entity");
const user_relations_1 = require("../../infrastructure/database/entities/user-relations");
const user_entity_1 = require("../../infrastructure/database/entities/user.entity");
const user_water_system_entity_1 = require("../../infrastructure/database/entities/user-water-system.entity");
const water_system_entity_1 = require("../../infrastructure/database/entities/water-system.entity");
const rbac_service_1 = require("./rbac.service");
const tehsil_access_service_1 = require("./tehsil-access.service");
let UserService = class UserService {
    userRepo;
    roleRepo;
    userWaterSystemRepo;
    waterSystemRepo;
    rbac;
    tehsilAccess;
    constructor(userRepo, roleRepo, userWaterSystemRepo, waterSystemRepo, rbac, tehsilAccess) {
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
        this.userWaterSystemRepo = userWaterSystemRepo;
        this.waterSystemRepo = waterSystemRepo;
        this.rbac = rbac;
        this.tehsilAccess = tehsilAccess;
    }
    async getUserById(userId) {
        return this.userRepo.findOne({
            where: { id: userId },
            relations: user_relations_1.USER_RELATIONS,
        });
    }
    async getAllUsers() {
        return this.userRepo.find({
            relations: user_relations_1.USER_RELATIONS,
            order: { createdAt: 'DESC' },
        });
    }
    async getAssignedTehsils(user) {
        if (this.rbac.userRoleCode(user) === roles_1.USER) {
            const derived = await this.tehsilAccess.operatorTehsilsDerivedFromWaterSystems(user);
            return [...derived].sort();
        }
        return (user.tehsilLinks ?? []).map((link) => link.tehsil);
    }
    async createTubewellOperator(name, email, password, waterSystemIds, actor) {
        const systems = await this.tehsilAccess.assertActorMayAssignWaterSystemsToOperator(actor, waterSystemIds);
        const emailN = email.trim().toLowerCase();
        const existing = await this.userRepo.findOne({ where: { email: emailN } });
        if (existing) {
            throw new Error('User already exists with this email');
        }
        const roleRow = await this.roleRepo.findOne({ where: { code: roles_1.USER } });
        if (!roleRow) {
            throw new Error('System roles are not initialized; run database migrations');
        }
        const u = this.userRepo.create({
            name: name.trim(),
            email: emailN,
            roleId: roleRow.id,
        });
        u.setPassword(password);
        const saved = await this.userRepo.save(u);
        for (const s of systems) {
            await this.userWaterSystemRepo.save(this.userWaterSystemRepo.create({
                userId: saved.id,
                waterSystemId: s.id,
            }));
        }
        return (await this.getUserById(saved.id));
    }
    async listTubewellOperatorAssignments(actor) {
        const manageable = await this.tehsilAccess.manageableWaterSystemIdsForAssignment(actor);
        if (!manageable.size) {
            return {
                operators: [],
                eligible_operators: [],
                water_systems_catalog: [],
            };
        }
        const operatorLinks = await this.userWaterSystemRepo
            .createQueryBuilder('uws')
            .select('DISTINCT uws.user_id', 'userId')
            .where('uws.water_system_id IN (:...ids)', { ids: [...manageable] })
            .getRawMany();
        const uidList = operatorLinks.map((r) => r.userId);
        const operatorsOut = [];
        for (const uid of uidList) {
            const u = await this.userRepo.findOne({ where: { id: uid } });
            if (!u || this.rbac.userRoleCode(u) !== roles_1.USER) {
                continue;
            }
            const wsRows = await this.waterSystemRepo
                .createQueryBuilder('ws')
                .innerJoin(user_water_system_entity_1.UserWaterSystem, 'uws', 'uws.water_system_id = ws.id')
                .where('uws.user_id = :uid', { uid })
                .andWhere('ws.id IN (:...ids)', { ids: [...manageable] })
                .orderBy('ws.tehsil')
                .addOrderBy('ws.village')
                .addOrderBy('ws.unique_identifier')
                .getMany();
            operatorsOut.push({
                id: String(u.id),
                name: u.name,
                email: u.email,
                phone: u.phone ?? null,
                water_systems: wsRows.map((ws) => ({
                    id: String(ws.id),
                    unique_identifier: ws.uniqueIdentifier,
                    village: ws.village,
                    tehsil: ws.tehsil,
                    settlement: ws.settlement,
                })),
            });
        }
        operatorsOut.sort((a, b) => String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()));
        const byId = new Map(operatorsOut.map((row) => [row.id, row]));
        const allLinked = await this.userWaterSystemRepo
            .createQueryBuilder('uws')
            .select('DISTINCT uws.user_id', 'userId')
            .getRawMany();
        const allUidsWithAnyLink = new Set(allLinked.map((r) => r.userId));
        const uidsExternalOnly = [...allUidsWithAnyLink].filter((id) => !uidList.includes(id));
        for (const uid of uidsExternalOnly) {
            const u = await this.userRepo.findOne({ where: { id: uid } });
            if (!u || this.rbac.userRoleCode(u) !== roles_1.USER) {
                continue;
            }
            const sid = String(u.id);
            if (byId.has(sid)) {
                continue;
            }
            byId.set(sid, {
                id: sid,
                name: u.name,
                email: u.email,
                phone: u.phone ?? null,
                water_systems: [],
            });
        }
        const roleUser = await this.roleRepo.findOne({ where: { code: roles_1.USER } });
        if (roleUser) {
            const linkedSubq = this.userWaterSystemRepo
                .createQueryBuilder('uws')
                .select('uws.user_id');
            const unassigned = await this.userRepo
                .createQueryBuilder('u')
                .where('u.role_id = :roleId', { roleId: roleUser.id })
                .andWhere(`u.id NOT IN (${linkedSubq.getQuery()})`)
                .orderBy('u.created_at', 'DESC')
                .limit(200)
                .getMany();
            for (const u of unassigned) {
                const sid = String(u.id);
                if (byId.has(sid)) {
                    continue;
                }
                byId.set(sid, {
                    id: sid,
                    name: u.name,
                    email: u.email,
                    phone: u.phone ?? null,
                    water_systems: [],
                });
            }
        }
        const eligibleOperators = [...byId.values()].sort((a, b) => String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()));
        const catalog = await this.waterSystemRepo.find({
            where: { id: (0, typeorm_2.In)([...manageable]) },
            order: { tehsil: 'ASC', village: 'ASC', uniqueIdentifier: 'ASC' },
        });
        return {
            operators: operatorsOut,
            eligible_operators: eligibleOperators,
            water_systems_catalog: catalog.map((ws) => ({
                id: String(ws.id),
                unique_identifier: ws.uniqueIdentifier,
                village: ws.village,
                tehsil: ws.tehsil,
                settlement: ws.settlement,
            })),
        };
    }
    async replaceTubewellOperatorWaterAssignments(actor, operatorId, waterSystemIds) {
        const manageable = await this.tehsilAccess.manageableWaterSystemIdsForAssignment(actor);
        if (!manageable.size) {
            throw new tehsil_access_service_1.TehsilAccessDenied('No permission to manage water system assignments');
        }
        const op = await this.getUserById(operatorId);
        if (!op || this.rbac.userRoleCode(op) !== roles_1.USER) {
            throw new Error('User is not a tubewell operator');
        }
        const want = new Set();
        for (const raw of waterSystemIds ?? []) {
            if (raw == null) {
                continue;
            }
            const sid = String(raw).trim();
            if (!sid) {
                continue;
            }
            const ws = await this.waterSystemRepo.findOne({ where: { id: sid } });
            if (!ws) {
                throw new Error(`Water system not found: ${sid}`);
            }
            if (!manageable.has(String(ws.id))) {
                throw new tehsil_access_service_1.TehsilAccessDenied('One or more water systems are outside your assignment scope');
            }
            await this.tehsilAccess.assertUserMayAccessWaterSystem(actor, ws, {
                forWrite: true,
            });
            want.add(String(ws.id));
        }
        await this.userWaterSystemRepo.delete({
            userId: operatorId,
            waterSystemId: (0, typeorm_2.In)([...manageable]),
        });
        for (const sid of [...want].sort()) {
            await this.userWaterSystemRepo.save(this.userWaterSystemRepo.create({
                userId: operatorId,
                waterSystemId: sid,
            }));
        }
        return (await this.getUserById(operatorId));
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(role_entity_1.Role)),
    __param(2, (0, typeorm_1.InjectRepository)(user_water_system_entity_1.UserWaterSystem)),
    __param(3, (0, typeorm_1.InjectRepository)(water_system_entity_1.WaterSystem)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        rbac_service_1.RbacService,
        tehsil_access_service_1.TehsilAccessService])
], UserService);
//# sourceMappingURL=user.service.js.map