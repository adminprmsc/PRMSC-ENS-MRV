import { User } from './user.entity';
import { WaterSystem } from './water-system.entity';
export declare class UserWaterSystem {
    userId: string;
    waterSystemId: string;
    createdAt: Date;
    updatedAt: Date;
    user: User;
    waterSystem: WaterSystem;
}
