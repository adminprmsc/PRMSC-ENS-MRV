import { Submission } from './submission.entity';
import { User } from './user.entity';
export declare class Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    submissionId: string | null;
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
    user: User;
    submission: Submission | null;
}
