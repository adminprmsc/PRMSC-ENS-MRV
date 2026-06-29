import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { canonicalTehsil } from '../../domain/constants/tehsils';
import {
  ADMIN,
  ROLE_RANK,
  SUPER_ADMIN,
  USER,
} from '../../domain/constants/roles';
import { SolarSystem } from '../../infrastructure/database/entities/solar-system.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { RbacService } from './rbac.service';

export class TehsilAccessDenied extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TehsilAccessDenied';
  }
}

@Injectable()
export class TehsilAccessService {
  constructor(
    @Inject(forwardRef(() => RbacService))
    private readonly rbac: RbacService,
    @InjectRepository(WaterSystem)
    private readonly waterSystemRepo: Repository<WaterSystem>,
    @InjectRepository(SolarSystem)
    private readonly solarSystemRepo: Repository<SolarSystem>,
  ) {}

  assignedTehsilSet(user: User): Set<string> {
    return new Set((user.tehsilLinks ?? []).map((link) => link.tehsil));
  }

  canonicalAssignedTehsilSet(user: User): Set<string> {
    if (this.rbac.userRoleCode(user) !== ADMIN) {
      return new Set();
    }
    const out = new Set<string>();
    for (const link of user.tehsilLinks ?? []) {
      const c = canonicalTehsil(link.tehsil);
      if (c) {
        out.add(c);
      }
    }
    return out;
  }

  hasFullTehsilAccess(user: User): boolean {
    return this.rbac.userRank(user) >= ROLE_RANK[SUPER_ADMIN];
  }

  async operatorTehsilsDerivedFromWaterSystems(
    user: User,
  ): Promise<Set<string>> {
    const ids = this.assignedWaterSystemIdSet(user);
    if (ids.size === 0) {
      return new Set();
    }
    const systems = await this.waterSystemRepo.find({
      where: { id: In([...ids]) },
    });
    const out = new Set<string>();
    for (const ws of systems) {
      const c = canonicalTehsil(ws.tehsil);
      if (c) {
        out.add(c);
      }
    }
    return out;
  }

  async userMayAccessTehsil(
    user: User,
    tehsil: string | null | undefined,
    options?: { forWrite?: boolean },
  ): Promise<boolean> {
    const forWrite = options?.forWrite ?? false;
    if (!tehsil) {
      return false;
    }
    const c = canonicalTehsil(tehsil);
    if (!c) {
      return false;
    }
    if (forWrite) {
      if (this.rbac.userRank(user) >= ROLE_RANK[SUPER_ADMIN]) {
        return false;
      }
      const code = this.rbac.userRoleCode(user);
      if (code === USER) {
        const derived = await this.operatorTehsilsDerivedFromWaterSystems(user);
        return derived.has(c);
      }
      if (code === ADMIN) {
        return this.canonicalAssignedTehsilSet(user).has(c);
      }
      return false;
    }
    if (this.hasFullTehsilAccess(user)) {
      return true;
    }
    const code = this.rbac.userRoleCode(user);
    if (code !== USER && code !== ADMIN) {
      return false;
    }
    if (code === USER) {
      const derived = await this.operatorTehsilsDerivedFromWaterSystems(user);
      return derived.has(c);
    }
    return this.canonicalAssignedTehsilSet(user).has(c);
  }

  async assertUserMayAccessTehsil(
    user: User,
    tehsil: string | null | undefined,
    options?: { forWrite?: boolean },
  ): Promise<void> {
    if (await this.userMayAccessTehsil(user, tehsil, options)) {
      return;
    }
    throw new TehsilAccessDenied(
      options?.forWrite
        ? 'Read-only role — cannot modify data for this tehsil'
        : 'Not allowed for this tehsil',
    );
  }

  assignedWaterSystemIdSet(user: User): Set<string> {
    return new Set(
      (user.waterSystemLinks ?? []).map((link) => String(link.waterSystemId)),
    );
  }

  async assertUserMayAccessWaterSystem(
    user: User,
    system: WaterSystem | null | undefined,
    options?: { forWrite?: boolean },
  ): Promise<void> {
    if (!system) {
      throw new TehsilAccessDenied('System not found');
    }
    await this.assertUserMayAccessTehsil(user, system.tehsil, options);
  }

  async assertUserMayLogWaterSystem(
    user: User,
    system: WaterSystem | null | undefined,
  ): Promise<void> {
    if (!system) {
      throw new TehsilAccessDenied('System not found');
    }
    if (this.rbac.userRoleCode(user) !== USER) {
      throw new TehsilAccessDenied(
        'Only tubewell operators may log water system data',
      );
    }
    if (!this.assignedWaterSystemIdSet(user).has(String(system.id))) {
      throw new TehsilAccessDenied(
        'This water system is not assigned to your account — contact your tehsil manager',
      );
    }
  }

  async assertUserMayViewOrLogWaterSystem(
    user: User,
    system: WaterSystem | null | undefined,
  ): Promise<void> {
    if (!system) {
      throw new TehsilAccessDenied('System not found');
    }
    if (this.rbac.userRoleCode(user) === USER) {
      await this.assertUserMayLogWaterSystem(user, system);
      return;
    }
    await this.assertUserMayAccessWaterSystem(user, system);
  }

  async assertUserMayAccessSolarSystem(
    user: User,
    system: SolarSystem | null | undefined,
    options?: { forWrite?: boolean },
  ): Promise<void> {
    if (!system) {
      throw new TehsilAccessDenied('System not found');
    }
    await this.assertUserMayAccessTehsil(user, system.tehsil, options);
  }

  async assertActorMayAssignWaterSystemsToOperator(
    actor: User,
    waterSystemIds: string[],
  ): Promise<WaterSystem[]> {
    if (!waterSystemIds.length) {
      throw new Error('At least one water_system_id is required');
    }

    const systems: WaterSystem[] = [];
    const seen = new Set<string>();
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

    if (this.rbac.userRoleCode(actor) !== ADMIN) {
      throw new TehsilAccessDenied(
        'Only tehsil managers can assign water systems to operators',
      );
    }

    const actorTs = this.canonicalAssignedTehsilSet(actor);
    for (const ws of systems) {
      const ct = canonicalTehsil(ws.tehsil);
      if (!ct || !actorTs.has(ct)) {
        throw new TehsilAccessDenied(
          `Water system ${ws.id} is outside your tehsil scope — you cannot assign it`,
        );
      }
    }
    return systems;
  }

  async manageableWaterSystemIdsForAssignment(
    actor: User,
  ): Promise<Set<string>> {
    const ids = new Set<string>();
    if (this.rbac.userRoleCode(actor) !== ADMIN) {
      return ids;
    }
    const actorTs = this.canonicalAssignedTehsilSet(actor);
    if (!actorTs.size) {
      return ids;
    }
    const all = await this.waterSystemRepo.find();
    for (const ws of all) {
      const c = canonicalTehsil(ws.tehsil);
      if (c && actorTs.has(c)) {
        ids.add(String(ws.id));
      }
    }
    return ids;
  }
}
