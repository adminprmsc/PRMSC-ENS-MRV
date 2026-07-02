import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ADMIN, SUPER_ADMIN, USER } from '../../domain/constants/roles';
import { canonicalTehsil } from '../../domain/constants/tehsils';
import { Role } from '../../infrastructure/database/entities/role.entity';
import { USER_RELATIONS } from '../../infrastructure/database/entities/user-relations';
import { User } from '../../infrastructure/database/entities/user.entity';
import { UserManagerOperation } from '../../infrastructure/database/entities/user-manager-operation.entity';
import { UserTehsil } from '../../infrastructure/database/entities/user-tehsil.entity';
import { UserWaterSystem } from '../../infrastructure/database/entities/user-water-system.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { RbacService } from './rbac.service';
import {
  TehsilAccessDenied,
  TehsilAccessService,
} from './tehsil-access.service';

export type OperatorWaterSystemAssignment = {
  id: string;
  unique_identifier: string;
  tehsil: string;
  village: string;
  settlement: string | null;
};

export type PortalUserAdminView = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  is_active: boolean;
  tehsils: string[];
  review_tehsils: string[];
  water_system_ids: string[];
  water_systems: OperatorWaterSystemAssignment[];
  created_at: string | null;
};

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserWaterSystem)
    private readonly userWaterSystemRepo: Repository<UserWaterSystem>,
    @InjectRepository(UserTehsil)
    private readonly userTehsilRepo: Repository<UserTehsil>,
    @InjectRepository(UserManagerOperation)
    private readonly managerOpRepo: Repository<UserManagerOperation>,
    @InjectRepository(WaterSystem)
    private readonly waterSystemRepo: Repository<WaterSystem>,
    private readonly rbac: RbacService,
    private readonly tehsilAccess: TehsilAccessService,
  ) {}

  async getUserById(userId: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id: userId },
      relations: USER_RELATIONS,
    });
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepo.find({
      relations: USER_RELATIONS,
      order: { createdAt: 'DESC' },
    });
  }

  async getAssignedTehsils(user: User): Promise<string[]> {
    const code = this.rbac.userRoleCode(user);
    if (code === USER) {
      const derived =
        await this.tehsilAccess.operatorTehsilsDerivedFromWaterSystems(user);
      return [...derived].sort();
    }
    if (code === SUPER_ADMIN) {
      return [...this.rbac.managerOperationTehsilSet(user)].sort();
    }
    return (user.tehsilLinks ?? []).map((link) => link.tehsil);
  }

  async listAssignableRoles(): Promise<
    Array<{ code: string; display_name: string; hierarchy_rank: number }>
  > {
    const rows = await this.roleRepo.find({
      order: { hierarchyRank: 'ASC' },
    });
    return rows.map((r) => ({
      code: r.code,
      display_name: r.displayName,
      hierarchy_rank: r.hierarchyRank,
    }));
  }

  async loadWaterSystemsForUser(user: User): Promise<OperatorWaterSystemAssignment[]> {
    const ids = user.assignedWaterSystemIds;
    if (!ids.length) {
      return [];
    }
    const systems = await this.waterSystemRepo.find({
      where: { id: In(ids) },
      order: { tehsil: 'ASC', village: 'ASC', uniqueIdentifier: 'ASC' },
    });
    return systems.map((ws) => ({
      id: String(ws.id),
      unique_identifier: ws.uniqueIdentifier,
      tehsil: ws.tehsil,
      village: ws.village,
      settlement: ws.settlement ?? null,
    }));
  }

  async serializeUserForAdmin(user: User): Promise<PortalUserAdminView> {
    const role = this.rbac.userRoleCode(user);
    const reviewTehsils =
      role === SUPER_ADMIN
        ? [...this.rbac.managerOperationTehsilSet(user)].sort()
        : [];
    const tehsils = await this.getAssignedTehsils(user);
    const water_systems = await this.loadWaterSystemsForUser(user);
    return {
      id: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.isActive !== false,
      tehsils,
      review_tehsils: reviewTehsils,
      water_system_ids: user.assignedWaterSystemIds,
      water_systems,
      created_at: user.createdAt?.toISOString() ?? null,
    };
  }

  private normalizeTehsilList(tehsils: string[] | undefined): string[] {
    const out = new Set<string>();
    for (const raw of tehsils ?? []) {
      const c = canonicalTehsil(raw);
      if (c) {
        out.add(c);
      }
    }
    return [...out].sort();
  }

  private async getRoleByCode(code: string): Promise<Role> {
    const roleRow = await this.roleRepo.findOne({ where: { code } });
    if (!roleRow) {
      throw new Error(`Unknown role: ${code}`);
    }
    return roleRow;
  }

  private async replaceAdminTehsils(
    userId: string,
    tehsils: string[],
  ): Promise<void> {
    await this.userTehsilRepo.delete({ userId });
    for (const tehsil of tehsils) {
      await this.userTehsilRepo.save(
        this.userTehsilRepo.create({ userId, tehsil }),
      );
    }
  }

  private async replaceManagerOperationTehsils(
    userId: string,
    tehsils: string[],
  ): Promise<void> {
    await this.managerOpRepo.delete({ userId });
    for (const tehsil of tehsils) {
      await this.managerOpRepo.save(
        this.managerOpRepo.create({ userId, tehsil }),
      );
    }
  }

  private async replaceWaterSystemLinks(
    userId: string,
    waterSystemIds: string[],
  ): Promise<void> {
    await this.userWaterSystemRepo.delete({ userId });
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
      await this.userWaterSystemRepo.save(
        this.userWaterSystemRepo.create({
          userId,
          waterSystemId: ws.id,
        }),
      );
    }
  }

  private validateRoleAssignments(
    roleCode: string,
    tehsils: string[],
    waterSystemIds: string[],
  ): void {
    if (roleCode === SUPER_ADMIN && tehsils.length < 1) {
      throw new Error(
        'Manager Operations users need at least one review tehsil',
      );
    }
    if (roleCode === ADMIN && tehsils.length < 1) {
      throw new Error('Tehsil managers need at least one tehsil assignment');
    }
    if (roleCode === USER && waterSystemIds.length < 1) {
      throw new Error('Tubewell operators need at least one water system');
    }
  }

  async createPortalUser(input: {
    name: string;
    email: string;
    password: string;
    roleCode: string;
    tehsils?: string[];
    waterSystemIds?: string[];
    isActive?: boolean;
  }): Promise<User> {
    const emailN = input.email.trim().toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email: emailN } });
    if (existing) {
      throw new Error('User already exists with this email');
    }

    const roleRow = await this.getRoleByCode(input.roleCode);
    const tehsils = this.normalizeTehsilList(input.tehsils);
    const waterSystemIds = (input.waterSystemIds ?? [])
      .map((id) => String(id).trim())
      .filter(Boolean);
    this.validateRoleAssignments(roleRow.code, tehsils, waterSystemIds);

    const u = this.userRepo.create({
      name: input.name.trim(),
      email: emailN,
      roleId: roleRow.id,
      isActive: input.isActive ?? true,
    });
    u.setPassword(input.password);
    const saved = await this.userRepo.save(u);

    if (roleRow.code === SUPER_ADMIN) {
      await this.replaceManagerOperationTehsils(saved.id, tehsils);
    } else if (roleRow.code === ADMIN) {
      await this.replaceAdminTehsils(saved.id, tehsils);
    } else if (roleRow.code === USER) {
      await this.replaceWaterSystemLinks(saved.id, waterSystemIds);
    }

    return (await this.getUserById(saved.id))!;
  }

  async updatePortalUser(
    userId: string,
    input: {
      name?: string;
      roleCode?: string;
      tehsils?: string[];
      waterSystemIds?: string[];
      isActive?: boolean;
    },
  ): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    let roleCode = this.rbac.userRoleCode(user);
    if (input.roleCode) {
      const roleRow = await this.getRoleByCode(input.roleCode);
      user.roleId = roleRow.id;
      roleCode = roleRow.code;
    }

    if (input.name?.trim()) {
      user.name = input.name.trim();
    }
    if (input.isActive !== undefined) {
      user.isActive = input.isActive;
    }
    await this.userRepo.save(user);

    const tehsils =
      input.tehsils !== undefined
        ? this.normalizeTehsilList(input.tehsils)
        : undefined;
    const waterSystemIds =
      input.waterSystemIds !== undefined
        ? input.waterSystemIds.map((id) => String(id).trim()).filter(Boolean)
        : undefined;

    if (tehsils !== undefined) {
      if (roleCode === SUPER_ADMIN) {
        if (tehsils.length < 1) {
          throw new Error(
            'Manager Operations users need at least one review tehsil',
          );
        }
        await this.replaceManagerOperationTehsils(userId, tehsils);
        await this.replaceAdminTehsils(userId, []);
      } else if (roleCode === ADMIN) {
        if (tehsils.length < 1) {
          throw new Error(
            'Tehsil managers need at least one tehsil assignment',
          );
        }
        await this.replaceAdminTehsils(userId, tehsils);
        await this.replaceManagerOperationTehsils(userId, []);
      } else {
        await this.replaceAdminTehsils(userId, []);
        await this.replaceManagerOperationTehsils(userId, []);
      }
    } else if (input.roleCode) {
      if (roleCode === SUPER_ADMIN) {
        const current = [...this.rbac.managerOperationTehsilSet(user)];
        if (current.length < 1) {
          throw new Error(
            'Manager Operations users need at least one review tehsil',
          );
        }
        await this.replaceAdminTehsils(userId, []);
      } else if (roleCode === ADMIN) {
        const current = (user.tehsilLinks ?? []).map((l) => l.tehsil);
        if (current.length < 1) {
          throw new Error(
            'Tehsil managers need at least one tehsil assignment',
          );
        }
        await this.replaceManagerOperationTehsils(userId, []);
      } else {
        await this.replaceAdminTehsils(userId, []);
        await this.replaceManagerOperationTehsils(userId, []);
      }
    }

    if (waterSystemIds !== undefined) {
      if (roleCode === USER && waterSystemIds.length < 1) {
        throw new Error('Tubewell operators need at least one water system');
      }
      if (roleCode === USER) {
        await this.replaceWaterSystemLinks(userId, waterSystemIds);
      } else {
        await this.userWaterSystemRepo.delete({ userId });
      }
    } else if (input.roleCode && roleCode !== USER) {
      await this.userWaterSystemRepo.delete({ userId });
    }

    return (await this.getUserById(userId))!;
  }

  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    user.setPassword(newPassword);
    await this.userRepo.save(user);
  }

  async listWaterSystemsCatalog() {
    const rows = await this.waterSystemRepo.find({
      order: { tehsil: 'ASC', village: 'ASC', uniqueIdentifier: 'ASC' },
    });
    return rows.map((ws) => ({
      id: String(ws.id),
      unique_identifier: ws.uniqueIdentifier,
      tehsil: ws.tehsil,
      village: ws.village,
    }));
  }

  async createTubewellOperator(
    name: string,
    email: string,
    password: string,
    waterSystemIds: string[],
    actor: User,
  ): Promise<User> {
    const systems =
      await this.tehsilAccess.assertActorMayAssignWaterSystemsToOperator(
        actor,
        waterSystemIds,
      );

    const emailN = email.trim().toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email: emailN } });
    if (existing) {
      throw new Error('User already exists with this email');
    }

    const roleRow = await this.roleRepo.findOne({ where: { code: USER } });
    if (!roleRow) {
      throw new Error(
        'System roles are not initialized; run database migrations',
      );
    }

    const u = this.userRepo.create({
      name: name.trim(),
      email: emailN,
      roleId: roleRow.id,
    });
    u.setPassword(password);
    const saved = await this.userRepo.save(u);

    for (const s of systems) {
      await this.userWaterSystemRepo.save(
        this.userWaterSystemRepo.create({
          userId: saved.id,
          waterSystemId: s.id,
        }),
      );
    }

    return (await this.getUserById(saved.id))!;
  }

  async listTubewellOperatorAssignments(actor: User) {
    const manageable =
      await this.tehsilAccess.manageableWaterSystemIdsForAssignment(actor);
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
      .getRawMany<{ userId: string }>();

    const uidList = operatorLinks.map((r) => r.userId);
    const operatorsOut: Array<Record<string, unknown>> = [];

    for (const uid of uidList) {
      const u = await this.userRepo.findOne({ where: { id: uid } });
      if (!u || this.rbac.userRoleCode(u) !== USER) {
        continue;
      }
      const wsRows = await this.waterSystemRepo
        .createQueryBuilder('ws')
        .innerJoin(UserWaterSystem, 'uws', 'uws.water_system_id = ws.id')
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
    operatorsOut.sort((a, b) =>
      String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()),
    );

    const byId = new Map(operatorsOut.map((row) => [row.id as string, row]));

    const allLinked = await this.userWaterSystemRepo
      .createQueryBuilder('uws')
      .select('DISTINCT uws.user_id', 'userId')
      .getRawMany<{ userId: string }>();
    const allUidsWithAnyLink = new Set(allLinked.map((r) => r.userId));
    const uidsExternalOnly = [...allUidsWithAnyLink].filter(
      (id) => !uidList.includes(id),
    );

    for (const uid of uidsExternalOnly) {
      const u = await this.userRepo.findOne({ where: { id: uid } });
      if (!u || this.rbac.userRoleCode(u) !== USER) {
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

    const roleUser = await this.roleRepo.findOne({ where: { code: USER } });
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

    const eligibleOperators = [...byId.values()].sort((a, b) =>
      String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()),
    );

    const catalog = await this.waterSystemRepo.find({
      where: { id: In([...manageable]) },
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

  async replaceTubewellOperatorWaterAssignments(
    actor: User,
    operatorId: string,
    waterSystemIds: string[],
  ): Promise<User> {
    const manageable =
      await this.tehsilAccess.manageableWaterSystemIdsForAssignment(actor);
    if (!manageable.size) {
      throw new TehsilAccessDenied(
        'No permission to manage water system assignments',
      );
    }

    const op = await this.getUserById(operatorId);
    if (!op || this.rbac.userRoleCode(op) !== USER) {
      throw new Error('User is not a tubewell operator');
    }

    const want = new Set<string>();
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
        throw new TehsilAccessDenied(
          'One or more water systems are outside your assignment scope',
        );
      }
      await this.tehsilAccess.assertUserMayAccessWaterSystem(actor, ws, {
        forWrite: true,
      });
      want.add(String(ws.id));
    }

    await this.userWaterSystemRepo.delete({
      userId: operatorId,
      waterSystemId: In([...manageable]),
    });

    for (const sid of [...want].sort()) {
      await this.userWaterSystemRepo.save(
        this.userWaterSystemRepo.create({
          userId: operatorId,
          waterSystemId: sid,
        }),
      );
    }

    return (await this.getUserById(operatorId))!;
  }
}
