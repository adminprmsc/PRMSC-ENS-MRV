import { ConfigService } from '@nestjs/config';
export declare class EmailService {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    sendPasswordResetEmail(toEmail: string, resetToken: string): Promise<boolean>;
}
