import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { PasswordResetToken } from '../../infrastructure/database/entities/password-reset-token.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
export declare class AuthService {
    private readonly userRepo;
    private readonly resetTokenRepo;
    private readonly config;
    constructor(userRepo: Repository<User>, resetTokenRepo: Repository<PasswordResetToken>, config: ConfigService);
    authenticate(email: string, password: string): Promise<User | null>;
    changePassword(user: User, currentPassword: string, newPassword: string): Promise<void>;
    requestPasswordReset(email: string): Promise<{
        user: User | null;
        rawToken: string | null;
    }>;
    resetPasswordWithToken(rawToken: string, newPassword: string): Promise<void>;
}
