import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { PasswordResetToken } from '../../infrastructure/database/entities/password-reset-token.entity';
import { USER_RELATIONS } from '../../infrastructure/database/entities/user-relations';
import { User } from '../../infrastructure/database/entities/user.entity';

function hashResetToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepo: Repository<PasswordResetToken>,
    private readonly config: ConfigService,
  ) {}

  async authenticate(email: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { email: email.trim().toLowerCase() },
      relations: USER_RELATIONS,
    });
    if (!user || !user.checkPassword(password)) {
      return null;
    }
    return user;
  }

  async changePassword(
    user: User,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const minLen = this.config.get<number>('app.passwordMinLength', 8);
    if (!user.checkPassword(currentPassword)) {
      throw new Error('Current password is incorrect');
    }
    if (newPassword.length < minLen) {
      throw new Error(`New password must be at least ${minLen} characters`);
    }
    if (newPassword === currentPassword) {
      throw new Error(
        'New password must be different from the current password',
      );
    }
    user.setPassword(newPassword);
    await this.resetTokenRepo.delete({ userId: user.id });
    await this.userRepo.save(user);
  }

  async requestPasswordReset(
    email: string,
  ): Promise<{ user: User | null; rawToken: string | null }> {
    const user = await this.userRepo.findOne({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) {
      return { user: null, rawToken: null };
    }

    await this.resetTokenRepo.delete({
      userId: user.id,
      usedAt: IsNull(),
    });

    const raw = randomBytes(48).toString('base64url');
    const ttlH = this.config.get<number>('app.passwordResetTokenTtlHours', 1);
    const expires = new Date(Date.now() + ttlH * 60 * 60 * 1000);

    const row = this.resetTokenRepo.create({
      userId: user.id,
      tokenHash: hashResetToken(raw),
      expiresAt: expires,
    });
    await this.resetTokenRepo.save(row);
    return { user, rawToken: raw };
  }

  async resetPasswordWithToken(
    rawToken: string,
    newPassword: string,
  ): Promise<void> {
    const minLen = this.config.get<number>('app.passwordMinLength', 8);
    if (newPassword.length < minLen) {
      throw new Error(`Password must be at least ${minLen} characters`);
    }
    if (!rawToken?.trim()) {
      throw new Error('token is required');
    }

    const th = hashResetToken(rawToken.trim());
    const now = new Date();
    const row = await this.resetTokenRepo.findOne({
      where: {
        tokenHash: th,
        usedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
    });
    if (!row) {
      throw new Error('Invalid or expired reset token');
    }

    const user = await this.userRepo.findOne({ where: { id: row.userId } });
    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    user.setPassword(newPassword);
    row.usedAt = now;
    await this.userRepo.save(user);
    await this.resetTokenRepo.save(row);
    await this.resetTokenRepo
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId AND id != :id', { userId: user.id, id: row.id })
      .execute();
  }
}
