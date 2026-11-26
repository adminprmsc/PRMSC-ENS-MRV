import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  RELEASE_NOTES,
  announceUntilMs,
  isAnnounced,
  notesForRole,
  type ReleaseNote,
} from '../../domain/constants/release-notes';
import { ReleaseNoteReceipt } from '../../infrastructure/database/entities/release-note-receipt.entity';
import { RbacService } from './rbac.service';
import { UserService } from './user.service';
import { WorkflowService } from './workflow.service';

export const NOTIFICATION_TYPE_RELEASE = 'release_note';

/**
 * "What's new": serves the release-note catalog for the caller's role and
 * tracks per-user delivery / read / dismiss. The first time an announced
 * note is fetched for a user, one bell notification is created (idempotent
 * via the unique (user, release) receipt).
 */
@Injectable()
export class ReleaseNotesService {
  private readonly logger = new Logger(ReleaseNotesService.name);

  constructor(
    @InjectRepository(ReleaseNoteReceipt)
    private readonly receiptRepo: Repository<ReleaseNoteReceipt>,
    private readonly userService: UserService,
    private readonly rbac: RbacService,
    private readonly workflow: WorkflowService,
  ) {}

  private async actor(userId: string | undefined) {
    const user = userId ? await this.userService.getUserById(userId) : null;
    if (!user) throw new UnauthorizedException({ message: 'User not found' });
    if (user.isActive === false) {
      throw new ForbiddenException({ message: 'Account is deactivated' });
    }
    return { user, role: this.rbac.userRoleCode(user) };
  }

  private serialize(
    n: ReleaseNote,
    role: string,
    r: ReleaseNoteReceipt | undefined,
    now: Date,
  ) {
    return {
      id: n.id,
      version: n.version,
      date: n.date,
      title: n.title,
      category: n.category,
      summary: n.summary,
      highlights: n.highlights,
      training: n.training,
      numbers_change: n.numbersChange ?? [],
      link: n.links?.[role] ?? null,
      announced: isAnnounced(n, now),
      announce_until: new Date(announceUntilMs(n)).toISOString(),
      read_at: r?.readAt?.toISOString?.() ?? null,
      dismissed_at: r?.dismissedAt?.toISOString?.() ?? null,
    };
  }

  private async receipts(userId: string, ids: string[]) {
    if (!ids.length) return new Map<string, ReleaseNoteReceipt>();
    const rows = await this.receiptRepo.find({
      where: { userId, releaseId: In(ids) },
    });
    return new Map(rows.map((r) => [r.releaseId, r]));
  }

  async list(userId: string | undefined) {
    const { user, role } = await this.actor(userId);
    const notes = notesForRole(role);
    const map = await this.receipts(
      user.id,
      notes.map((n) => n.id),
    );
    const now = new Date();
    const items = notes.map((n) => this.serialize(n, role, map.get(n.id), now));
    return {
      items,
      unread: items.filter((i) => i.announced && !i.read_at).length,
    };
  }

  /** Active, not-dismissed notes; delivers the bell notification once. */
  async announcements(userId: string | undefined) {
    const { user, role } = await this.actor(userId);
    const now = new Date();
    const active = notesForRole(role).filter((n) => isAnnounced(n, now));
    const map = await this.receipts(
      user.id,
      active.map((n) => n.id),
    );
    for (const n of active) {
      if (map.has(n.id)) continue;
      // Unique (user, release) makes this safe under concurrent requests.
      const inserted = await this.receiptRepo
        .createQueryBuilder()
        .insert()
        .into(ReleaseNoteReceipt)
        .values({
          id: uuidv4(),
          userId: user.id,
          releaseId: n.id,
          notifiedAt: new Date(),
        })
        .orIgnore()
        .returning(['id'])
        .execute();
      const insertedRows = inserted.raw as unknown[] | undefined;
      if (insertedRows?.length) {
        try {
          await this.workflow.createNotification(
            user.id,
            `What's new: ${n.title}`,
            n.summary,
            null,
            { type: NOTIFICATION_TYPE_RELEASE, entityId: n.id },
          );
        } catch (e) {
          // Best effort — the banner still shows.
          this.logger.warn(`Release notification failed: ${String(e)}`);
        }
      }
    }
    const fresh = await this.receipts(
      user.id,
      active.map((n) => n.id),
    );
    return {
      items: active
        .filter((n) => !fresh.get(n.id)?.dismissedAt)
        .map((n) => this.serialize(n, role, fresh.get(n.id), now)),
    };
  }

  private async mark(
    userId: string | undefined,
    releaseId: string,
    field: 'readAt' | 'dismissedAt',
  ) {
    const { user, role } = await this.actor(userId);
    const note = RELEASE_NOTES.find((n) => n.id === releaseId);
    if (!note || !note.audiences.includes(role)) {
      throw new NotFoundException({ message: 'Release note not found' });
    }
    let r = await this.receiptRepo.findOne({
      where: { userId: user.id, releaseId },
    });
    if (!r) {
      r = this.receiptRepo.create({
        id: uuidv4(),
        userId: user.id,
        releaseId,
        notifiedAt: new Date(),
      });
    }
    const now = new Date();
    if (field === 'dismissedAt') {
      r.dismissedAt = r.dismissedAt ?? now;
      r.readAt = r.readAt ?? now;
    } else {
      r.readAt = r.readAt ?? now;
    }
    await this.receiptRepo.save(r);
    return { ok: true };
  }

  markRead(userId: string | undefined, releaseId: string) {
    return this.mark(userId, releaseId, 'readAt');
  }

  dismiss(userId: string | undefined, releaseId: string) {
    return this.mark(userId, releaseId, 'dismissedAt');
  }
}
