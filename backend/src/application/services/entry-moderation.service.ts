import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { canonicalTehsil } from '../../domain/constants/tehsils';
import { ADMIN, SUPER_ADMIN } from '../../domain/constants/roles';
import { SUBMISSION_STATUS_REJECTED } from '../../domain/constants/submission.constants';
import {
  checkWaterLogModeration,
  isIsoDay,
  ModerationAction,
  normalizeModerationReason,
  parseModerationListLimit,
} from '../../domain/constants/entry-moderation.rules';
import { toIsoDateString } from '../../domain/utils/date.util';
import {
  ENTRY_ACTION_DELETE,
  ENTRY_ACTION_REJECT,
  ENTRY_TYPE_SOLAR_LOG,
  ENTRY_TYPE_WATER_LOG,
  EntryChangeLog,
} from '../../infrastructure/database/entities/entry-change-log.entity';
import {
  Notification,
  NOTIFICATION_TYPE_ENTRY_CHANGE,
} from '../../infrastructure/database/entities/notification.entity';
import { SolarEnergyLoggingMonthly } from '../../infrastructure/database/entities/solar-energy-logging-monthly.entity';
import { SolarSystem } from '../../infrastructure/database/entities/solar-system.entity';
import { Submission } from '../../infrastructure/database/entities/submission.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { UserTehsil } from '../../infrastructure/database/entities/user-tehsil.entity';
import { VerificationLog } from '../../infrastructure/database/entities/verification-log.entity';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { RbacService } from './rbac.service';
import { UserService } from './user.service';
import { WorkflowService } from './workflow.service';

export interface ModerationJwt {
  sub: string;
  role?: string;
}

export type ModerationResult = {
  statusCode: number;
  body: Record<string, unknown>;
};

/** Thrown inside a transaction to abort it with an HTTP-shaped result. */
class ModerationFailure extends Error {
  constructor(
    readonly statusCode: number,
    readonly body: { error: string },
  ) {
    super(body.error);
  }
}

const fail = (statusCode: number, error: string): never => {
  throw new ModerationFailure(statusCode, { error });
};

type PostCommitNotice = {
  operatorId: string | null;
  tehsil: string;
  title: string;
  message: string;
  submissionId: string | null;
};

/**
 * Manager Operations (SUPER_ADMIN) overrides on approved entries:
 *  - reject an accepted water daily log (soft: status → rejected, excluded from KPIs)
 *  - delete an accepted/rejected water daily log (hard, snapshot kept in audit)
 *  - delete a solar monthly log (hard, snapshot kept in audit)
 *
 * Every action requires a reason and writes an immutable `entry_change_logs` row.
 */
@Injectable()
export class EntryModerationService {
  private readonly logger = new Logger(EntryModerationService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(EntryChangeLog)
    private readonly changeLogRepo: Repository<EntryChangeLog>,
    @InjectRepository(UserTehsil)
    private readonly userTehsilRepo: Repository<UserTehsil>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly userService: UserService,
    private readonly rbac: RbacService,
    private readonly workflow: WorkflowService,
  ) {}

  // ── Public API ───────────────────────────────────────────────────────────

  rejectWaterLog(jwt: ModerationJwt, recordId: string, body: unknown) {
    return this.moderateWaterLog(jwt, recordId, body, 'reject');
  }

  deleteWaterLog(jwt: ModerationJwt, recordId: string, body: unknown) {
    return this.moderateWaterLog(jwt, recordId, body, 'delete');
  }

  async deleteSolarLog(
    jwt: ModerationJwt,
    recordId: string,
    body: unknown,
  ): Promise<ModerationResult> {
    return this.run(async () => {
      const reason = this.requireReason(body);
      const actor = await this.requireManagerOps(jwt);
      const id = this.requireId(recordId);

      const result = await this.dataSource.transaction(async (em) => {
        const record = await em.findOne(SolarEnergyLoggingMonthly, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!record)
          fail(
            404,
            'Solar monthly entry not found (it may already have been deleted)',
          );
        const system = await em.findOne(SolarSystem, {
          where: { id: record!.solarSystemId },
        });
        if (!system) fail(404, 'Solar site for this entry no longer exists');
        const tehsil = this.assertScope(actor, system!.tehsil);

        // Legacy solar submissions may exist without a DB FK — purge them too.
        const subs = await em.find(Submission, {
          where: { recordId: id },
        });
        const verification = await this.verificationHistory(em, subs);

        const period = `${record!.year}-${String(record!.month).padStart(2, '0')}`;
        const audit = await em.save(
          em.create(EntryChangeLog, {
            entryType: ENTRY_TYPE_SOLAR_LOG,
            entryId: id,
            action: ENTRY_ACTION_DELETE,
            reason,
            previousStatus: null,
            newStatus: 'deleted',
            performedBy: actor.id,
            performedByName: actor.name ?? null,
            performedByRole: SUPER_ADMIN,
            systemId: system!.id,
            systemUid: system!.uniqueIdentifier ?? null,
            tehsil,
            village: system!.village ?? null,
            settlement: system!.settlement ?? null,
            entryPeriod: period,
            submissionId: subs[0]?.id ?? null,
            snapshot: {
              record: this.solarSnapshot(record!),
              submissions: subs.map((s) => this.submissionSnapshot(s)),
              verification_history: verification,
            },
          }),
        );

        await this.purgeSubmissions(em, subs);
        await em.delete(SolarEnergyLoggingMonthly, { id });

        const notice: PostCommitNotice = {
          operatorId: null,
          tehsil,
          title: 'Solar entry deleted by Manager Operations',
          message:
            `Solar monthly entry for ${system!.uniqueIdentifier} (${period}) ` +
            `was deleted by ${actor.name}. Reason: ${reason}`,
          submissionId: null,
        };
        return { audit, notice };
      });

      await this.sendNotices(result.notice, actor.id, result.audit.id);
      return {
        statusCode: 200,
        body: {
          message: 'Solar monthly entry deleted',
          change_log: this.serialize(result.audit),
        },
      };
    });
  }

  async listChangeLogs(
    jwt: ModerationJwt,
    query: Record<string, string | undefined>,
  ): Promise<ModerationResult> {
    return this.run(async () => {
      const actor = await this.loadActiveActor(jwt);
      const role = this.rbac.userRoleCode(actor);
      let scope: Set<string>;
      if (role === SUPER_ADMIN) {
        scope = this.rbac.managerOperationTehsilSet(actor);
      } else if (role === ADMIN) {
        scope = new Set(
          (actor.tehsilLinks ?? [])
            .map((l) => canonicalTehsil(l.tehsil))
            .filter((t): t is string => Boolean(t)),
        );
      } else {
        return fail(
          403,
          'Access Forbidden: change history is for managers only',
        );
      }

      let tehsils = [...scope];
      if (query.tehsil?.trim()) {
        const c = canonicalTehsil(query.tehsil);
        if (!c) fail(400, `Unknown tehsil '${query.tehsil}'`);
        if (!scope.has(c!)) fail(403, 'Access denied for this tehsil');
        tehsils = [c!];
      }
      if (!tehsils.length) {
        return { statusCode: 200, body: { change_logs: [] } };
      }

      const qb = this.changeLogRepo
        .createQueryBuilder('c')
        .where('c.tehsil IN (:...tehsils)', { tehsils });

      if (query.entry_type) {
        if (
          ![ENTRY_TYPE_WATER_LOG, ENTRY_TYPE_SOLAR_LOG].includes(
            query.entry_type,
          )
        ) {
          fail(400, "entry_type must be 'water_log' or 'solar_log'");
        }
        qb.andWhere('c.entry_type = :et', { et: query.entry_type });
      }
      if (query.action) {
        if (
          ![ENTRY_ACTION_REJECT, ENTRY_ACTION_DELETE].includes(query.action)
        ) {
          fail(400, "action must be 'reject' or 'delete'");
        }
        qb.andWhere('c.action = :ac', { ac: query.action });
      }
      if (query.entry_id?.trim()) {
        qb.andWhere('c.entry_id = :eid', { eid: query.entry_id.trim() });
      }
      if (query.date_from) {
        if (!isIsoDay(query.date_from))
          fail(400, 'date_from must be YYYY-MM-DD');
        qb.andWhere('c.created_at >= :df', {
          df: `${query.date_from} 00:00:00`,
        });
      }
      if (query.date_to) {
        if (!isIsoDay(query.date_to)) fail(400, 'date_to must be YYYY-MM-DD');
        qb.andWhere("c.created_at < (CAST(:dt AS date) + INTERVAL '1 day')", {
          dt: query.date_to,
        });
      }
      if (query.date_from && query.date_to && query.date_from > query.date_to) {
        fail(400, 'date_from must be on or before date_to');
      }

      const rows = await qb
        .orderBy('c.created_at', 'DESC')
        .addOrderBy('c.id', 'DESC')
        .limit(parseModerationListLimit(query.limit))
        .getMany();

      return {
        statusCode: 200,
        body: { change_logs: rows.map((r) => this.serialize(r)) },
      };
    });
  }

  // ── Water ────────────────────────────────────────────────────────────────

  private async moderateWaterLog(
    jwt: ModerationJwt,
    recordId: string,
    body: unknown,
    action: ModerationAction,
  ): Promise<ModerationResult> {
    return this.run(async () => {
      const reason = this.requireReason(body);
      const actor = await this.requireManagerOps(jwt);
      const id = this.requireId(recordId);

      const result = await this.dataSource.transaction(async (em) => {
        // Row lock serialises concurrent reject/delete/re-review on this log.
        const log = await em.findOne(WaterEnergyLoggingDaily, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!log)
          fail(404, 'Water log not found (it may already have been deleted)');
        const system = await em.findOne(WaterSystem, {
          where: { id: log!.waterSystemId },
        });
        if (!system) fail(404, 'Water system for this log no longer exists');
        const tehsil = this.assertScope(actor, system!.tehsil);

        const check = checkWaterLogModeration(action, log!.status);
        if (!check.ok) fail(409, check.error);
        const previousStatus = check.ok ? check.status : null;

        const subs = await em.find(Submission, {
          where: { recordId: id, submissionType: 'water_system' },
          order: { createdAt: 'DESC' },
          lock: { mode: 'pessimistic_write' },
        });
        const primary = subs[0] ?? null;
        const verification = await this.verificationHistory(em, subs);
        const logDay = toIsoDateString(log!.logDate);
        const uid = system!.uniqueIdentifier ?? '';

        const snapshot = {
          record: this.waterSnapshot(log!),
          submissions: subs.map((s) => this.submissionSnapshot(s)),
          verification_history: verification,
        };

        const audit = await em.save(
          em.create(EntryChangeLog, {
            entryType: ENTRY_TYPE_WATER_LOG,
            entryId: id,
            action,
            reason,
            previousStatus,
            newStatus:
              action === 'reject' ? SUBMISSION_STATUS_REJECTED : 'deleted',
            performedBy: actor.id,
            performedByName: actor.name ?? null,
            performedByRole: SUPER_ADMIN,
            systemId: system!.id,
            systemUid: uid || null,
            tehsil,
            village: system!.village ?? null,
            settlement: system!.settlement ?? null,
            entryPeriod: logDay,
            submissionId: primary?.id ?? null,
            snapshot,
          }),
        );

        if (action === 'reject') {
          log!.status = SUBMISSION_STATUS_REJECTED;
          await em.save(log!);
          const now = new Date();
          for (const s of subs) {
            s.status = SUBMISSION_STATUS_REJECTED;
            s.reviewedAt = now;
            s.reviewedBy = actor.id;
            s.remarks = reason;
            await em.save(s);
          }
          if (primary) {
            await em.save(
              em.create(VerificationLog, {
                submissionId: primary.id,
                actionType: 'manager_reject',
                performedBy: actor.id,
                role: SUPER_ADMIN,
                comment: reason,
              }),
            );
          }
        } else {
          await this.purgeSubmissions(em, subs);
          await em.delete(WaterEnergyLoggingDaily, { id });
        }

        const verb = action === 'reject' ? 'rejected' : 'deleted';
        const notice: PostCommitNotice = {
          operatorId: primary?.operatorId ?? null,
          tehsil,
          title: `Water log ${verb} by Manager Operations`,
          message:
            `Your previously accepted water log for ${uid} on ${logDay} was ` +
            `${verb} by ${actor.name}. Reason: ${reason}`,
          submissionId: action === 'reject' ? (primary?.id ?? null) : null,
        };
        return { audit, notice };
      });

      await this.sendNotices(result.notice, actor.id, result.audit.id);
      return {
        statusCode: 200,
        body: {
          message:
            action === 'reject' ? 'Water log rejected' : 'Water log deleted',
          change_log: this.serialize(result.audit),
        },
      };
    });
  }

  // ── Guards & helpers ─────────────────────────────────────────────────────

  private async run(
    fn: () => Promise<ModerationResult>,
  ): Promise<ModerationResult> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ModerationFailure) {
        return { statusCode: e.statusCode, body: e.body };
      }
      throw e;
    }
  }

  private requireReason(body: unknown): string {
    const raw =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>).reason
        : undefined;
    const r = normalizeModerationReason(raw);
    if (!r.ok) fail(400, r.error);
    return (r as { reason: string }).reason;
  }

  private requireId(raw: string): string {
    const id = String(raw ?? '').trim();
    if (!id || id.length > 36) fail(404, 'Entry not found');
    return id;
  }

  private async loadActiveActor(jwt: ModerationJwt): Promise<User> {
    const actor = jwt?.sub ? await this.userService.getUserById(jwt.sub) : null;
    if (!actor) fail(401, 'User not found');
    if (actor!.isActive === false) fail(403, 'Account is deactivated');
    return actor!;
  }

  /** Role comes from the DB, not the JWT — a demoted user's old token is refused. */
  private async requireManagerOps(jwt: ModerationJwt): Promise<User> {
    const actor = await this.loadActiveActor(jwt);
    if (this.rbac.userRoleCode(actor) !== SUPER_ADMIN) {
      fail(
        403,
        'Only Manager Operations can reject or delete approved entries',
      );
    }
    return actor;
  }

  private assertScope(
    actor: User,
    rawTehsil: string | null | undefined,
  ): string {
    const c = canonicalTehsil(rawTehsil);
    if (!c || !this.rbac.managerOperationTehsilSet(actor).has(c)) {
      fail(403, 'This entry belongs to a tehsil that is not assigned to you');
    }
    return c!;
  }

  private async verificationHistory(
    em: EntityManager,
    subs: Submission[],
  ): Promise<Record<string, unknown>[]> {
    if (!subs.length) return [];
    const logs = await em.find(VerificationLog, {
      where: { submissionId: In(subs.map((s) => s.id)) },
      order: { createdAt: 'ASC' },
    });
    const userIds = [
      ...new Set(logs.map((l) => l.performedBy).filter(Boolean)),
    ];
    const users = userIds.length
      ? await em.find(User, { where: { id: In(userIds) } })
      : [];
    const names = new Map(users.map((u) => [u.id, u.name]));
    return logs.map((l) => ({
      submission_id: l.submissionId,
      action_type: l.actionType,
      performed_by: l.performedBy,
      performed_by_name: names.get(l.performedBy) ?? null,
      role: l.role,
      comment: l.comment,
      created_at: l.createdAt?.toISOString?.() ?? null,
    }));
  }

  private async purgeSubmissions(
    em: EntityManager,
    subs: Submission[],
  ): Promise<void> {
    if (!subs.length) return;
    const ids = subs.map((s) => s.id);
    await em.delete(VerificationLog, { submissionId: In(ids) });
    await em.delete(Notification, { submissionId: In(ids) });
    await em.delete(Submission, { id: In(ids) });
  }

  /** Best-effort: the change is committed; a notification failure must not undo it. */
  private async sendNotices(
    notice: PostCommitNotice,
    actorId: string,
    changeLogId: string,
  ): Promise<void> {
    try {
      const recipients = new Set<string>();
      if (notice.operatorId) recipients.add(String(notice.operatorId));
      const links = await this.userTehsilRepo.find({
        where: { tehsil: notice.tehsil },
      });
      const managerIds = [...new Set(links.map((l) => String(l.userId)))];
      if (managerIds.length) {
        const managers = await this.userRepo.find({
          where: { id: In(managerIds) },
          relations: { assignedRole: true },
        });
        for (const m of managers) {
          if (this.rbac.userRoleCode(m) === ADMIN && m.isActive !== false) {
            recipients.add(String(m.id));
          }
        }
      }
      recipients.delete(String(actorId));
      for (const uid of recipients) {
        await this.workflow.createNotification(
          uid,
          notice.title,
          notice.message,
          notice.submissionId,
          { type: NOTIFICATION_TYPE_ENTRY_CHANGE, entityId: changeLogId },
        );
      }
    } catch (e) {
      this.logger.warn(`Moderation notification failed: ${String(e)}`);
    }
  }

  private waterSnapshot(r: WaterEnergyLoggingDaily): Record<string, unknown> {
    return {
      id: r.id,
      water_system_id: r.waterSystemId,
      log_date: toIsoDateString(r.logDate),
      pump_start_time: r.pumpStartTime,
      pump_end_time: r.pumpEndTime,
      pump_operating_hours: r.pumpOperatingHours,
      total_water_pumped: r.totalWaterPumped,
      meter_reading_start: r.meterReadingStart,
      meter_reading_end: r.meterReadingEnd,
      bulk_meter_image_url: r.bulkMeterImageUrl,
      signed: r.signed,
      status: r.status,
      remarks: r.remarks,
      created_at: r.createdAt?.toISOString?.() ?? null,
      updated_at: r.updatedAt?.toISOString?.() ?? null,
    };
  }

  private solarSnapshot(r: SolarEnergyLoggingMonthly): Record<string, unknown> {
    return {
      id: r.id,
      solar_system_id: r.solarSystemId,
      year: r.year,
      month: r.month,
      export_off_peak: r.exportOffPeak,
      export_peak: r.exportPeak,
      import_off_peak: r.importOffPeak,
      import_peak: r.importPeak,
      net_off_peak: r.netOffPeak,
      net_peak: r.netPeak,
      electricity_bill_image_url: r.electricityBillImageUrl,
      remarks: r.remarks,
      created_at: r.createdAt?.toISOString?.() ?? null,
      updated_at: r.updatedAt?.toISOString?.() ?? null,
    };
  }

  private submissionSnapshot(s: Submission): Record<string, unknown> {
    return {
      id: s.id,
      operator_id: s.operatorId,
      status: s.status,
      submitted_at: s.submittedAt?.toISOString?.() ?? null,
      reviewed_at: s.reviewedAt?.toISOString?.() ?? null,
      reviewed_by: s.reviewedBy,
      remarks: s.remarks,
    };
  }

  serialize(r: EntryChangeLog): Record<string, unknown> {
    return {
      id: r.id,
      entry_type: r.entryType,
      entry_id: r.entryId,
      action: r.action,
      reason: r.reason,
      previous_status: r.previousStatus,
      new_status: r.newStatus,
      performed_by: r.performedBy,
      performed_by_name: r.performedByName,
      performed_by_role: r.performedByRole,
      system_id: r.systemId,
      system_uid: r.systemUid,
      tehsil: r.tehsil,
      village: r.village,
      settlement: r.settlement,
      entry_period: r.entryPeriod,
      submission_id: r.submissionId,
      snapshot: r.snapshot,
      created_at: r.createdAt?.toISOString?.() ?? null,
    };
  }
}
