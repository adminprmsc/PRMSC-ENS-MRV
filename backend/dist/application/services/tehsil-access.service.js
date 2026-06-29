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
exports.TehsilAccessService = exports.TehsilAccessDenied = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const tehsils_1 = require("../../domain/constants/tehsils");
const roles_1 = require("../../domain/constants/roles");
const solar_system_entity_1 = require("../../infrastructure/database/entities/solar-system.entity");
const water_system_entity_1 = require("../../infrastructure/database/entities/water-system.entity");
const rbac_service_1 = require("./rbac.service");
class TehsilAccessDenied extends Error {
    constructor(message) {
        super(message);
        this.name = 'TehsilAccessDenied';
    }
}
exports.TehsilAccessDenied = TehsilAccessDenied;
let TehsilAccessService = class TehsilAccessService {
    rbac;
    waterSystemRepo;
    solarSystemRepo;
    constructor(rbac, waterSystemRepo, solarSystemRepo) {
        this.rbac = rbac;
        this.waterSystemRepo = waterSystemRepo;
        this.solarSystemRepo = solarSystemRepo;
    }
    assignedTehsilSet(user) {
        return new Set((user.tehsilLinks ?? []).map((link) => link.tehsil));
    }
    canonicalAssignedTehsilSet(user) {
        if (this.rbac.userRoleCode(user) !== roles_1.ADMIN) {
            return new Set();
        }
        const out = new Set();
        for (const link of user.tehsilLinks ?? []) {
            const c = (0, tehsils_1.canonicalTehsil)(link.tehsil);
            if (c) {
                out.add(c);
            }
        }
        return out;
    }
    hasFullTehsilAccess(user) {
        return this.rbac.userRank(user) >= roles_1.ROLE_RANK[roles_1.SUPER_ADMIN];
    }
    async operatorTehsilsDerivedFromWaterSystems(user) {
        const ids = this.assignedWaterSystemIdSet(user);
        if (ids.size === 0) {
            return new Set();
        }
        const systems = await this.waterSystemRepo.find({
            where: { id: (0, typeorm_2.In)([...ids]) },
        });
        const out = new Set();
        for (const ws of systems) {
            const c = (0, tehsils_1.canonicalTehsil)(ws.tehsil);
            if (c) {
                out.add(c);
            }
        }
        return out;
    }
    async userMayAccessTehsil(user, tehsil, options) {
        const forWrite = options?.forWrite ?? false;
        if (!tehsil) {
            return false;
        }
        const c = (0, tehsils_1.canonicalTehsil)(tehsil);
        if (!c) {
            return false;
        }
        if (forWrite) {
            if (this.rbac.userRank(user) >= roles_1.ROLE_RANK[roles_1.SUPER_ADMIN]) {
                return false;
            }
            const code = this.rbac.userRoleCode(user);
            if (code === roles_1.USER) {
                const derived = await this.operatorTehsilsDerivedFromWaterSystems(user);
                return derived.has(c);
            }
            if (code === roles_1.ADMIN) {
                return this.canonicalAssignedTehsilSet(user).has(c);
            }
            return false;
        }
        if (this.hasFullTehsilAccess(user)) {
            return true;
        }
        const code = this.rbac.userRoleCode(user);
        if (code !== roles_1.USER && code !== roles_1.ADMIN) {
            return false;
        }
        if (code === roles_1.USER) {
            const derived = await this.operatorTehsilsDerivedFromWaterSystems(user);
            return derived.has(c);
        }
        return this.canonicalAssignedTehsilSet(user).has(c);
    }
    async assertUserMayAccessTehsil(user, tehsil, options) {
        if (await this.userMayAccessTehsil(user, tehsil, options)) {
            return;
        }
        throw new TehsilAccessDenied(options?.forWrite
            ? 'Read-only role — cannot modify data for this tehsil'
            : 'Not allowed for this tehsil');
    }
    assignedWaterSystemIdSet(user) {
        return new Set((user.waterSystemLinks ?? []).map((link) => String(link.waterSystemId)));
    }
    async assertUserMayAccessWaterSystem(user, system, options) {
        if (!system) {
            throw new TehsilAccessDenied('System not found');
        }
        await this.assertUserMayAccessTehsil(user, system.tehsil, options);
    }
    async assertUserMayLogWaterSystem(user, system) {
        if (!system) {
            throw new TehsilAccessDenied('System not found');
        }
        if (this.rbac.userRoleCode(user) !== roles_1.USER) {
            throw new TehsilAccessDenied('Only tubewell operators may log water system data');
        }
        if (!this.assignedWaterSystemIdSet(user).has(String(system.id))) {
            throw new TehsilAccessDenied('This water system is not assigned to your account — contact your tehsil manager');
        }
    }
    async assertUserMayViewOrLogWaterSystem(user, system) {
        if (!system) {
            throw new TehsilAccessDenied('System not found');
        }
        if (this.rbac.userRoleCode(user) === roles_1.USER) {
            await this.assertUserMayLogWaterSystem(user, system);
            return;
        }
        await this.assertUserMayAccessWaterSystem(user, system);
    }
    async assertUserMayAccessSolarSystem(user, system, options) {
        if (!system) {
            throw new TehsilAccessDenied('System not found');
        }
        await this.assertUserMayAccessTehsil(user, system.tehsil, options);
    }
    async assertActorMayAssignWaterSystemsToOperator(actor, waterSystemIds) {
        if (!waterSystemIds.length) {
            throw new Error('At least one water_system_id is required');
        }
        const systems = [];
        const seen = new Set();
        for (const raw of waterSystemIds) {
            const sid = String(raw).trim();
            if (!sid || seen.has(sid)) {
                continue;
            }
            seen.add(sid);
            const ws = await this.waterSystemRepo.findOne({ where: { id: sid } });
            if (!ws) {
                throw new Error(`Water system not found: ${sid}`);
            }
            systems.push(ws);
        }
        if (!systems.length) {
            throw new Error('At least one valid water_system_id is required');
        }
        if (this.rbac.userRoleCode(actor) !== roles_1.ADMIN) {
            throw new TehsilAccessDenied('Only tehsil managers can assign water systems to operators');
        }
        const actorTs = this.canonicalAssignedTehsilSet(actor);
        for (const ws of systems) {
            const ct = (0, tehsils_1.canonicalTehsil)(ws.tehsil);
            if (!ct || !actorTs.has(ct)) {
                throw new TehsilAccessDenied(`Water system ${ws.id} is outside your tehsil scope — you cannot assign it`);
            }
        }
        return systems;
    }
    async manageableWaterSystemIdsForAssignment(actor) {
        const ids = new Set();
        if (this.rbac.userRoleCode(actor) !== roles_1.ADMIN) {
            return ids;
        }
        const actorTs = this.canonicalAssignedTehsilSet(actor);
        if (!actorTs.size) {
            return ids;
        }
        const all = await this.waterSystemRepo.find();
        for (const ws of all) {
            const c = (0, tehsils_1.canonicalTehsil)(ws.tehsil);
            if (c && actorTs.has(c)) {
                ids.add(String(ws.id));
            }
        }
        return ids;
    }
};
exports.TehsilAccessService = TehsilAccessService;
exports.TehsilAccessService = TehsilAccessService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => rbac_service_1.RbacService))),
    __param(1, (0, typeorm_1.InjectRepository)(water_system_entity_1.WaterSystem)),
    __param(2, (0, typeorm_1.InjectRepository)(solar_system_entity_1.SolarSystem)),
    __metadata("design:paramtypes", [rbac_service_1.RbacService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], TehsilAccessService);
//# sourceMappingURL=tehsil-access.service.js.map