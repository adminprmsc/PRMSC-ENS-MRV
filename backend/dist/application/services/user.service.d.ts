import { Repository } from 'typeorm';
import { Role } from '../../infrastructure/database/entities/role.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { UserWaterSystem } from '../../infrastructure/database/entities/user-water-system.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { RbacService } from './rbac.service';
import { TehsilAccessService } from './tehsil-access.service';
export declare class UserService {
    private readonly userRepo;
    private readonly roleRepo;
    private readonly userWaterSystemRepo;
    private readonly waterSystemRepo;
    private readonly rbac;
    private readonly tehsilAccess;
    constructor(userRepo: Repository<User>, roleRepo: Repository<Role>, userWaterSystemRepo: Repository<UserWaterSystem>, waterSystemRepo: Repository<WaterSystem>, rbac: RbacService, tehsilAccess: TehsilAccessService);
    getUserById(userId: string): Promise<User | null>;
    getAllUsers(): Promise<User[]>;
    getAssignedTehsils(user: User): Promise<string[]>;
    createTubewellOperator(name: string, email: string, password: string, waterSystemIds: string[], actor: User): Promise<User>;
    listTubewellOperatorAssignments(actor: User): Promise<{
        operators: Record<string, unknown>[];
        eligible_operators: Record<string, unknown>[];
        water_systems_catalog: {
            id: string;
            unique_identifier: string;
            village: string;
            tehsil: string;
            settlement: string | null;
        }[];
    }>;
    replaceTubewellOperatorWaterAssignments(actor: User, operatorId: string, waterSystemIds: string[]): Promise<User>;
}
