"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_entity_1 = require("../../infrastructure/database/entities/notification.entity");
let NotificationsService = class NotificationsService {
    notificationRepo;
    constructor(notificationRepo) {
        this.notificationRepo = notificationRepo;
    }
    async getNotificationsResponse(userId) {
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
    async markNotificationReadResponse(userId, notificationId) {
        const notification = await this.notificationRepo.findOne({
            where: { id: notificationId },
        });
        if (!notification) {
            throw new common_1.NotFoundException({ error: 'Notification not found' });
        }
        if (notification.userId !== userId) {
            throw new common_1.ForbiddenException({ error: 'Access denied' });
        }
        notification.isRead = true;
        notification.updatedAt = new Date();
        await this.notificationRepo.save(notification);
        return { message: 'Notification marked as read' };
    }
    async markAllNotificationsReadResponse(userId) {
        await this.notificationRepo.update({ userId, isRead: false }, { isRead: true, updatedAt: new Date() });
        return { message: 'All notifications marked as read' };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map