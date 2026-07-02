import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { canonicalTehsil } from '../../domain/constants/tehsils';
import {
  ADMIN,
  ROLE_RANK,
  SUPER_ADMIN,
  SYSTEM_ADMIN,
  USER,
  hierarchyRank,
  isUserAdminRole,
  normalizeRoleCode,
  rankAtLeast,
} from '../../domain/constants/roles';
import { Submission } from '../../infrastructure/database/entities/submission.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { SolarEnergyLoggingMonthly } from '../../infrastructure/database/entities/solar-energy-logging-monthly.entity';
import { SolarSystem } from '../../infrastructure/database/entities/solar-system.entity';
import { TehsilAccessService } from './tehsil-access.service';

@Injectable()
export class RbacService {
  readonly SYSTEM_ADMIN = SYSTEM_ADMIN;
  readonly SUPER_ADMIN = SUPER_ADMIN;
  readonly ADMIN = ADMIN;
  readonly USER = USER;
  readonly ROLE_RANK = ROLE_RANK;

  constructor(
    @Inject(forwardRef(() => TehsilAccessService))
    private readonly tehsilAccess: TehsilAccessService,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(WaterEnergyLoggingDaily)
    private readonly waterLogRepo: Repository<WaterEnergyLoggingDaily>,
    @InjectRepository(WaterSystem)
    private readonly waterSystemRepo: Repository<WaterSystem>,
    @InjectRepository(SolarEnergyLoggingMonthly)
    private readonly solarLogRepo: Repository<SolarEnergyLoggingMonthly>,
    @InjectRepository(SolarSystem)
    private readonly solarSystemRepo: Repository<SolarSystem>,
  ) {}

  normalizeRoleCode(role: string | null | undefined): string | null {
    return normalizeRoleCode(role);
  }

  hierarchyRank(roleCode: string | null | undefined): number {
    return hierarchyRank(roleCode);
  }

  rankAtLeast(roleCode: string | null | undefined, minCode: string): boolean {
    return rankAtLeast(roleCode, minCode);
  }

  effectivePermissions(permissionsJson: unknown): Set<string> {
    if (!permissionsJson) {
      return new Set();
    }
    if (Array.isArray(permissionsJson)) {
      return new Set(permissionsJson as string[]);
    }
    return new Set();
  }

  hasPermission(permissionsJson: unknown, permission: string): boolean {
    return this.effectivePermissions(permissionsJson).has(permission);
  }

  managerOperationTehsilSet(user: User): Set<string> {
    const out = new Set<string>();
    for (const link of user.managerOperationLinks ?? []) {
      const c = canonicalTehsil(link.tehsil);
      if (c) {
        out.add(c);
      }
    }
    return out;
  }

  async userAssignedTehsils(user: User): Promise<Set<string>> {
    const code = this.userRoleCode(user);
    if (code === USER) {
      return this.tehsilAccess.operatorTehsilsDerivedFromWaterSystems(user);
    }
    if (code === SUPER_ADMIN) {
      return this.managerOperationTehsilSet(user);
    }
    return new Set((user.tehsilLinks ?? []).map((link) => link.tehsil));
  }

  userRank(user: User): number {
    if (user.assignedRole) {
      return user.assignedRole.hierarchyRank || 1;
    }
    return hierarchyRank(user.role);
  }

  userRoleCode(user: User): string {
    if (user.assignedRole) {
      return user.assignedRole.code;
    }
    return normalizeRoleCode(user.role) ?? USER;
  }

  async canAccessTehsil(
    user: User,
    tehsil: string | null | undefined,
  ): Promise<boolean> {
    if (isUserAdminRole(this.userRoleCode(user))) {
      return false;
    }
    const code = this.userRoleCode(user);
    if (code !== USER && code !== ADMIN && code !== SUPER_ADMIN) {
      return false;
    }
    const c = canonicalTehsil(tehsil);
    if (!c) {
      return false;
    }
    return (await this.userAssignedTehsils(user)).has(c);
  }

  tehsilScopeDeniedMessage(): { error: string } {
    return { error: 'Access denied for this tehsil' };
  }

  async submissionTehsil(submission: Submission): Promise<string | null> {
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

  async userCanAccessSubmission(
    user: User,
    submission: Submission,
  ): Promise<boolean> {
    if (isUserAdminRole(this.userRoleCode(user))) {
      return false;
    }
    if (this.userRoleCode(user) === USER) {
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
    if (
      this.userRoleCode(user) === ADMIN ||
      this.userRoleCode(user) === SUPER_ADMIN
    ) {
      const t = await this.submissionTehsil(submission);
      return await this.canAccessTehsil(user, t);
    }
    return false;
  }

  async userCanViewSubmissionDetail(
    user: User,
    submission: Submission,
    currentUserId: string,
  ): Promise<boolean> {
    if (this.userRoleCode(user) === USER) {
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
    if (isUserAdminRole(this.userRoleCode(user))) {
      return false;
    }
    if (
      this.userRoleCode(user) === ADMIN ||
      this.userRoleCode(user) === SUPER_ADMIN
    ) {
      const t = await this.submissionTehsil(submission);
      return await this.canAccessTehsil(user, t);
    }
    return false;
  }

  async userCanVerifySubmission(
    user: User,
    submission: Submission,
  ): Promise<boolean> {
    if (this.userRoleCode(user) !== ADMIN) {
      return false;
    }
    const rk = this.userRank(user);
    if (rk < ROLE_RANK[ADMIN]) {
      return false;
    }
    const t = await this.submissionTehsil(submission);
    return await this.canAccessTehsil(user, t);
  }
}
