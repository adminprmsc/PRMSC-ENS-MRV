import { Submission } from './submission.entity';
import { User } from './user.entity';
export declare class VerificationLog {
    id: string;
    submissionId: string;
    actionType: string;
    performedBy: string;
    role: string;
    comment: string | null;
    createdAt: Date;
    updatedAt: Date;
    submission: Submission;
    user: User;
}
