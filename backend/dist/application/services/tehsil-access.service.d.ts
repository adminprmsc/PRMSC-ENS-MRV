import { Repository } from 'typeorm';
import { SolarSystem } from '../../infrastructure/database/entities/solar-system.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { RbacService } from './rbac.service';
export declare class TehsilAccessDenied extends Error {
    constructor(message: string);
}
export declare class TehsilAccessService {
    private readonly rbac;
    private readonly waterSystemRepo;
    private readonly solarSystemRepo;
    constructor(rbac: RbacService, waterSystemRepo: Repository<WaterSystem>, solarSystemRepo: Repository<SolarSystem>);
    assignedTehsilSet(user: User): Set<string>;
    canonicalAssignedTehsilSet(user: User): Set<string>;
    hasFullTehsilAccess(user: User): boolean;
    operatorTehsilsDerivedFromWaterSystems(user: User): Promise<Set<string>>;
    userMayAccessTehsil(user: User, tehsil: string | null | undefined, options?: {
        forWrite?: boolean;
    }): Promise<boolean>;
    assertUserMayAccessTehsil(user: User, tehsil: string | null | undefined, options?: {
        forWrite?: boolean;
    }): Promise<void>;
    assignedWaterSystemIdSet(user: User): Set<string>;
    assertUserMayAccessWaterSystem(user: User, system: WaterSystem | null | undefined, options?: {
        forWrite?: boolean;
    }): Promise<void>;
    assertUserMayLogWaterSystem(user: User, system: WaterSystem | null | undefined): Promise<void>;
    assertUserMayViewOrLogWaterSystem(user: User, system: WaterSystem | null | undefined): Promise<void>;
    assertUserMayAccessSolarSystem(user: User, system: SolarSystem | null | undefined, options?: {
        forWrite?: boolean;
    }): Promise<void>;
    assertActorMayAssignWaterSystemsToOperator(actor: User, waterSystemIds: string[]): Promise<WaterSystem[]>;
    manageableWaterSystemIdsForAssignment(actor: User): Promise<Set<string>>;
}
