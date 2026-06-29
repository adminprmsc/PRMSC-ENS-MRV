import { User } from './user.entity';
export declare class Role {
    id: string;
    code: string;
    displayName: string;
    hierarchyRank: number;
    permissions: string[];
    createdAt: Date;
    updatedAt: Date;
    users: User[];
}
