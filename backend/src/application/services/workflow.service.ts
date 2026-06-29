import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { canonicalTehsil } from '../../domain/constants/tehsils';
import { ADMIN, SUPER_ADMIN, SYSTEM_ADMIN } from '../../domain/constants/roles';
import { Notification } from '../../infrastructure/database/entities/notification.entity';
import { Role } from '../../infrastructure/database/entities/role.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { UserTehsil } from '../../infrastructure/database/entities/user-tehsil.entity';
import { VerificationLog } from '../../infrastructure/database/entities/verification-log.entity';
import { RbacService } from './rbac.service';

@Injectable()
export class WorkflowService {
  constructor(
    @InjectRepository(VerificationLog)
    private readonly verificationLogRepo: Repository<VerificationLog>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserTehsil)
    private readonly userTehsilRepo: Repository<UserTehsil>,
    private readonly rbac: RbacService,
  ) {}

  async logVerificationAction(
    submissionId: string,
    actionType: string,
    userId: string,
    role: string,
    comment?: string | null,
  ): Promise<VerificationLog> {
    const log = this.verificationLogRepo.create({
      submissionId,
      actionType,
      performedBy: userId,
      role,
      comment: comment ?? null,
    });
    return this.verificationLogRepo.save(log);
  }

  async createNotification(
    userId: string,
    title: string,
    message: string,
    submissionId?: string | null,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId,
      title,
      message,
      submissionId: submissionId ?? null,
    });
    return this.notificationRepo.save(notification);
  }

  async notifyAnalysts(
    title: string,
    message: string,
    submissionId?: string | null,
    tehsil?: string | null,
  ): Promise<void> {
    const recipients = new Map<string, User>();

    const globalAdmins = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin(Role, 'r', 'r.id = u.role_id')
      .where('r.code IN (:...codes)', { codes: [SYSTEM_ADMIN, SUPER_ADMIN] })
      .getMany();

    for (const u of globalAdmins) {
      recipients.set(String(u.id), u);
    }

    if (tehsil) {
      const c = canonicalTehsil(tehsil);
      if (c) {
        const links = await this.userTehsilRepo.find({ where: { tehsil: c } });
        for (const row of links) {
          const u = await this.userRepo.findOne({ where: { id: row.userId } });
          if (u && this.rbac.userRoleCode(u) === ADMIN) {
            recipients.set(String(u.id), u);
          }
        }
      }
    }

    for (const u of recipients.values()) {
      await this.createNotification(u.id, title, message, submissionId);
    }
  }

  async notifyOperator(
    operatorId: string,
    title: string,
    message: string,
    submissionId?: string | null,
  ): Promise<void> {
    await this.createNotification(operatorId, title, message, submissionId);
  }
}
