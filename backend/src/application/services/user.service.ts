import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { USER } from '../../domain/constants/roles';
import { Role } from '../../infrastructure/database/entities/role.entity';
import { USER_RELATIONS } from '../../infrastructure/database/entities/user-relations';
import { User } from '../../infrastructure/database/entities/user.entity';
import { UserWaterSystem } from '../../infrastructure/database/entities/user-water-system.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { RbacService } from './rbac.service';
import {
  TehsilAccessDenied,
  TehsilAccessService,
} from './tehsil-access.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserWaterSystem)
    private readonly userWaterSystemRepo: Repository<UserWaterSystem>,
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
    if (this.rbac.userRoleCode(user) === USER) {
      const derived =
        await this.tehsilAccess.operatorTehsilsDerivedFromWaterSystems(user);
      return [...derived].sort();
    }
    return (user.tehsilLinks ?? []).map((link) => link.tehsil);
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
