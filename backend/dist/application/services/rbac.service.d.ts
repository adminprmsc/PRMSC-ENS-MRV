import { Repository } from 'typeorm';
import { Submission } from '../../infrastructure/database/entities/submission.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { SolarEnergyLoggingMonthly } from '../../infrastructure/database/entities/solar-energy-logging-monthly.entity';
import { SolarSystem } from '../../infrastructure/database/entities/solar-system.entity';
import { TehsilAccessService } from './tehsil-access.service';
export declare class RbacService {
    private readonly tehsilAccess;
    private readonly submissionRepo;
    private readonly waterLogRepo;
    private readonly waterSystemRepo;
    private readonly solarLogRepo;
    private readonly solarSystemRepo;
    readonly SYSTEM_ADMIN = "SYSTEM_ADMIN";
    readonly SUPER_ADMIN = "SUPER_ADMIN";
    readonly ADMIN = "ADMIN";
    readonly USER = "USER";
    readonly ROLE_RANK: Record<string, number>;
    constructor(tehsilAccess: TehsilAccessService, submissionRepo: Repository<Submission>, waterLogRepo: Repository<WaterEnergyLoggingDaily>, waterSystemRepo: Repository<WaterSystem>, solarLogRepo: Repository<SolarEnergyLoggingMonthly>, solarSystemRepo: Repository<SolarSystem>);
    normalizeRoleCode(role: string | null | undefined): string | null;
    hierarchyRank(roleCode: string | null | undefined): number;
    rankAtLeast(roleCode: string | null | undefined, minCode: string): boolean;
    effectivePermissions(permissionsJson: unknown): Set<string>;
    hasPermission(permissionsJson: unknown, permission: string): boolean;
    userAssignedTehsils(user: User): Promise<Set<string>>;
    userRank(user: User): number;
    userRoleCode(user: User): string;
    canAccessTehsil(user: User, tehsil: string | null | undefined): Promise<boolean>;
    tehsilScopeDeniedMessage(): {
        error: string;
    };
    submissionTehsil(submission: Submission): Promise<string | null>;
    userCanAccessSubmission(user: User, submission: Submission): Promise<boolean>;
    userCanViewSubmissionDetail(user: User, submission: Submission, currentUserId: string): Promise<boolean>;
    userCanVerifySubmission(user: User, submission: Submission): Promise<boolean>;
}
