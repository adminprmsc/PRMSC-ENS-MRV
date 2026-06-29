import { UserService } from '../../application/services/user.service';
import { OnboardOperatorDto } from '../dto/auth.dto';
export declare class UsersController {
    private readonly userService;
    constructor(userService: UserService);
    listUsers(): Promise<{
        users: {
            id: string;
            name: string;
            email: string;
            role: string | null;
            tehsils: string[];
            water_system_ids: string[];
            created_at: string;
        }[];
    }>;
    onboardOperator(actorId: string, body: OnboardOperatorDto): Promise<{
        message: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: string | null;
            tehsils: string[];
            water_system_ids: string[];
        };
    }>;
}
