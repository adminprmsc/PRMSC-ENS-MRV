import { Repository } from 'typeorm';
import { Notification } from '../../infrastructure/database/entities/notification.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { UserTehsil } from '../../infrastructure/database/entities/user-tehsil.entity';
import { VerificationLog } from '../../infrastructure/database/entities/verification-log.entity';
import { RbacService } from './rbac.service';
export declare class WorkflowService {
    private readonly verificationLogRepo;
    private readonly notificationRepo;
    private readonly userRepo;
    private readonly userTehsilRepo;
    private readonly rbac;
    constructor(verificationLogRepo: Repository<VerificationLog>, notificationRepo: Repository<Notification>, userRepo: Repository<User>, userTehsilRepo: Repository<UserTehsil>, rbac: RbacService);
    logVerificationAction(submissionId: string, actionType: string, userId: string, role: string, comment?: string | null): Promise<VerificationLog>;
    createNotification(userId: string, title: string, message: string, submissionId?: string | null): Promise<Notification>;
    notifyAnalysts(title: string, message: string, submissionId?: string | null, tehsil?: string | null): Promise<void>;
    notifyOperator(operatorId: string, title: string, message: string, submissionId?: string | null): Promise<void>;
}
