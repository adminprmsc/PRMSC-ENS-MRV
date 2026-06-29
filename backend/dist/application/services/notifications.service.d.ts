import { Repository } from 'typeorm';
import { Notification } from '../../infrastructure/database/entities/notification.entity';
export declare class NotificationsService {
    private readonly notificationRepo;
    constructor(notificationRepo: Repository<Notification>);
    getNotificationsResponse(userId: string): Promise<{
        notifications: {
            id: string;
            title: string;
            message: string;
            is_read: boolean;
            submission_id: string | null;
            created_at: string;
        }[];
        unread_count: number;
    }>;
    markNotificationReadResponse(userId: string, notificationId: string): Promise<{
        message: string;
    }>;
    markAllNotificationsReadResponse(userId: string): Promise<{
        message: string;
    }>;
}
