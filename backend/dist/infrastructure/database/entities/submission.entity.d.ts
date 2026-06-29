import { User } from './user.entity';
import { Notification } from './notification.entity';
import { VerificationLog } from './verification-log.entity';
export declare class Submission {
    id: string;
    operatorId: string;
    submissionType: string;
    recordId: string;
    status: string;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    approvedAt: Date | null;
    reviewedBy: string | null;
    approvedBy: string | null;
    remarks: string | null;
    createdAt: Date;
    updatedAt: Date;
    operator: User;
    reviewer: User | null;
    approver: User | null;
    logs: VerificationLog[];
    notifications: Notification[];
}
