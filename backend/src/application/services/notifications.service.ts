import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../infrastructure/database/entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async getNotificationsResponse(userId: string) {
    const notifications = await this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    const result = notifications.map((notif) => ({
      id: notif.id,
      title: notif.title,
      message: notif.message,
      is_read: notif.isRead,
      submission_id: notif.submissionId,
      created_at: notif.createdAt?.toISOString(),
    }));

    const unreadCount = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });

    return { notifications: result, unread_count: unreadCount };
  }

  async markNotificationReadResponse(userId: string, notificationId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });
    if (!notification) {
      throw new NotFoundException({ error: 'Notification not found' });
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException({ error: 'Access denied' });
    }
    notification.isRead = true;
    notification.updatedAt = new Date();
    await this.notificationRepo.save(notification);
    return { message: 'Notification marked as read' };
  }

  async markAllNotificationsReadResponse(userId: string) {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true, updatedAt: new Date() },
    );
    return { message: 'All notifications marked as read' };
  }
}
