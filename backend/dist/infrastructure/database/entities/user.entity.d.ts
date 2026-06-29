import { Role } from './role.entity';
import { UserTehsil } from './user-tehsil.entity';
import { UserWaterSystem } from './user-water-system.entity';
export declare class User {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    phone: string | null;
    signatureSvg: string | null;
    roleId: string;
    createdAt: Date;
    updatedAt: Date;
    assignedRole: Role;
    tehsilLinks: UserTehsil[];
    waterSystemLinks: UserWaterSystem[];
    get role(): string | null;
    get assignedWaterSystemIds(): string[];
    setPassword(password: string): void;
    checkPassword(password: string): boolean;
}
