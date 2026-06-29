import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AuthService } from '../../application/services/auth.service';
import { EmailService } from '../../application/services/email.service';
import { UserService } from '../../application/services/user.service';
import { UserManagerOperation } from '../../infrastructure/database/entities/user-manager-operation.entity';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, ResetPasswordDto } from '../dto/auth.dto';
export declare class AuthController {
    private readonly authService;
    private readonly userService;
    private readonly emailService;
    private readonly jwtService;
    private readonly config;
    private readonly managerOpRepo;
    private readonly logger;
    constructor(authService: AuthService, userService: UserService, emailService: EmailService, jwtService: JwtService, config: ConfigService, managerOpRepo: Repository<UserManagerOperation>);
    login(body: LoginDto): Promise<{
        token: string;
        user: {
            id: string;
            name: string;
            role: string | null;
            tehsils: string[];
            manager_operation_tehsils: string[];
            water_system_ids: string[];
        };
    }>;
    changePassword(userId: string, body: ChangePasswordDto): Promise<{
        message: string;
    }>;
    forgotPassword(body: ForgotPasswordDto): Promise<Record<string, string>>;
    resetPassword(body: ResetPasswordDto): Promise<{
        message: string;
    }>;
    profile(userId: string): Promise<{
        id: string;
        name: string;
        email: string;
        role: string | null;
        tehsils: string[];
        water_system_ids: string[];
        created_at: string;
    }>;
}
