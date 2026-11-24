import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
      type: notif.notificationType,
      entity_id: notif.entityId,
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

  /**
   * Mark specific notifications read (e.g. the ones the user just saw).
   * Ids belonging to other users are ignored, never touched.
   */
  async markNotificationsReadByIdsResponse(userId: string, rawIds: unknown) {
    if (!Array.isArray(rawIds)) {
      throw new BadRequestException({ error: 'ids must be an array' });
    }
    if (rawIds.length > 100) {
      throw new BadRequestException({ error: 'At most 100 ids per request' });
    }
    const ids = [
      ...new Set(
        rawIds
          .filter((v): v is string => typeof v === 'string')
          .map((v) => v.trim())
          .filter((v) => v.length > 0 && v.length <= 36),
      ),
    ];
    if (!ids.length) {
      return { message: 'Nothing to mark', updated: 0 };
    }
    const result = await this.notificationRepo.update(
      { userId, isRead: false, id: In(ids) },
      { isRead: true, updatedAt: new Date() },
    );
    return {
      message: 'Notifications marked as read',
      updated: result.affected ?? 0,
    };
  }

  /** Marks the user's unread notifications read; `type` narrows it to one kind. */
  async markAllNotificationsReadResponse(userId: string, type?: string) {
    const t = typeof type === 'string' ? type.trim() : '';
    if (t.length > 40) {
      throw new BadRequestException({ error: 'Invalid notification type' });
    }
    const result = await this.notificationRepo.update(
      t
        ? { userId, isRead: false, notificationType: t }
        : { userId, isRead: false },
      { isRead: true, updatedAt: new Date() },
    );
    return {
      message: 'All notifications marked as read',
      updated: result.affected ?? 0,
    };
  }
}
