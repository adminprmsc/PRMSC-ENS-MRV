import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AppModule } from '../src/app.module';
import { EntryModerationService } from '../src/application/services/entry-moderation.service';
import { TehsilManagerService } from '../src/application/services/tehsil-manager.service';
import { WaterMeterVolumeService } from '../src/application/services/water-meter-volume.service';
import { EntryChangeLog } from '../src/infrastructure/database/entities/entry-change-log.entity';
import { Notification } from '../src/infrastructure/database/entities/notification.entity';
import { SolarEnergyLoggingMonthly } from '../src/infrastructure/database/entities/solar-energy-logging-monthly.entity';
import { SolarSystem } from '../src/infrastructure/database/entities/solar-system.entity';
import { Submission } from '../src/infrastructure/database/entities/submission.entity';
import { User } from '../src/infrastructure/database/entities/user.entity';
import { UserManagerOperation } from '../src/infrastructure/database/entities/user-manager-operation.entity';
import { UserTehsil } from '../src/infrastructure/database/entities/user-tehsil.entity';
import { VerificationLog } from '../src/infrastructure/database/entities/verification-log.entity';
import { WaterEnergyLoggingDaily } from '../src/infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../src/infrastructure/database/entities/water-system.entity';
import { integrationDatabaseUrl, isPostgresReachable } from './integration-env';

const ROLE = {
  USER: 'f1111111-1111-4111-a111-111111111101',
  ADMIN: 'f1111111-1111-4111-a111-111111111102',
  SUPER_ADMIN: 'f1111111-1111-4111-a111-111111111103',
  SYSTEM_ADMIN: 'f1111111-1111-4111-a111-111111111104',
} as const;

const TEHSIL_A = 'ALIPUR';
const TEHSIL_B = 'ROJHAN';
const REASON = 'Bulk meter photo does not match the reading entered';

describe('Manager Operations entry moderation (Postgres integration)', () => {
  let dbAvailable = false;
  let moduleRef: TestingModule | undefined;
  let app: INestApplication | undefined;
  let ds: DataSource;
  let svc: EntryModerationService;
  let tm: TehsilManagerService;
  let meter: WaterMeterVolumeService;
  let jwt: JwtService;

  const tag = uuidv4().slice(0, 8);
  const users: Record<string, string> = {};
  let wsA = '';
  let wsB = '';
  let ssA = '';
  let ssB = '';
  const logIds: string[] = [];
  const solarIds: string[] = [];
  let dayCounter = 0;

  async function makeUser(
    key: string,
    roleId: string,
    opts: { active?: boolean } = {},
  ) {
    const id = uuidv4();
    await ds.getRepository(User).save(
      ds.getRepository(User).create({
        id,
        name: `INT ${key} ${tag}`,
        email: `int-${key}-${tag}@example.test`,
        passwordHash: 'x',
        roleId,
        isActive: opts.active ?? true,
      }),
    );
    users[key] = id;
    return id;
  }

  /** Creates a water log (+ optional submission & accept history). */
  async function makeWaterLog(
    status: string,
    opts: {
      systemId?: string;
      withSubmission?: boolean;
      meterEnd?: number;
    } = {},
  ): Promise<{ logId: string; subId: string | null }> {
    dayCounter += 1;
    const logId = uuidv4();
    const day = new Date(Date.UTC(2026, 0, 1 + dayCounter));
    await ds.getRepository(WaterEnergyLoggingDaily).save(
      ds.getRepository(WaterEnergyLoggingDaily).create({
        id: logId,
        waterSystemId: opts.systemId ?? wsA,
        logDate: day,
        pumpStartTime: '08:00:00',
        pumpEndTime: '10:00:00',
        pumpOperatingHours: 2,
        totalWaterPumped: 50,
        meterReadingStart: opts.meterEnd != null ? opts.meterEnd - 50 : null,
        meterReadingEnd: opts.meterEnd ?? null,
        status,
        signed: true,
      }),
    );
    logIds.push(logId);
    if (opts.withSubmission === false) return { logId, subId: null };

    const subId = uuidv4();
    await ds.getRepository(Submission).save(
      ds.getRepository(Submission).create({
        id: subId,
        operatorId: users.op,
        submissionType: 'water_system',
        recordId: logId,
        status,
        submittedAt: new Date(),
        reviewedAt: status === 'accepted' ? new Date() : null,
        reviewedBy: status === 'accepted' ? users.tm : null,
      }),
    );
    await ds.getRepository(VerificationLog).save(
      ds.getRepository(VerificationLog).create({
        submissionId: subId,
        actionType: 'submit',
        performedBy: users.op,
        role: 'USER',
        comment: 'submitted',
      }),
    );
    if (status === 'accepted') {
      await ds.getRepository(VerificationLog).save(
        ds.getRepository(VerificationLog).create({
          submissionId: subId,
          actionType: 'accept',
          performedBy: users.tm,
          role: 'ADMIN',
          comment: 'ok',
        }),
      );
      // Pre-existing notification tied to the submission (must not block delete).
      await ds.getRepository(Notification).save(
        ds.getRepository(Notification).create({
          userId: users.op,
          title: 'Submission accepted',
          message: 'accepted',
          submissionId: subId,
        }),
      );
    }
    return { logId, subId };
  }

  async function makeSolarLog(systemId: string, month: number) {
    const id = uuidv4();
    await ds.getRepository(SolarEnergyLoggingMonthly).save(
      ds.getRepository(SolarEnergyLoggingMonthly).create({
        id,
        solarSystemId: systemId,
        year: 2026,
        month,
        exportOffPeak: 100,
        importOffPeak: 40,
        netOffPeak: 60,
      }),
    );
    solarIds.push(id);
    return id;
  }

  const as = (key: string, role: string) => ({ sub: users[key], role });
  const changeLogsFor = (entryId: string) =>
    ds
      .getRepository(EntryChangeLog)
      .find({ where: { entryId }, order: { createdAt: 'ASC' } });

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDatabaseUrl();
    dbAvailable = await isPostgresReachable();
    if (!dbAvailable) {
      console.warn(
        '[integration] Postgres not reachable — skipping entry moderation tests.',
      );
      return;
    }
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    ds = moduleRef.get(DataSource);
    svc = moduleRef.get(EntryModerationService);
    tm = moduleRef.get(TehsilManagerService);
    meter = moduleRef.get(WaterMeterVolumeService);
    jwt = moduleRef.get(JwtService);

    await makeUser('mo', ROLE.SUPER_ADMIN);
    await makeUser('moB', ROLE.SUPER_ADMIN);
    await makeUser('moNoScope', ROLE.SUPER_ADMIN);
    await makeUser('moInactive', ROLE.SUPER_ADMIN, { active: false });
    await makeUser('tm', ROLE.ADMIN);
    await makeUser('tmB', ROLE.ADMIN);
    await makeUser('op', ROLE.USER);
    await makeUser('sys', ROLE.SYSTEM_ADMIN);

    const moLink = ds.getRepository(UserManagerOperation);
    await moLink.save([
      moLink.create({ userId: users.mo, tehsil: TEHSIL_A }),
      moLink.create({ userId: users.moB, tehsil: TEHSIL_B }),
      moLink.create({ userId: users.moInactive, tehsil: TEHSIL_A }),
    ]);
    const tLink = ds.getRepository(UserTehsil);
    await tLink.save([
      tLink.create({ userId: users.tm, tehsil: TEHSIL_A }),
      tLink.create({ userId: users.tmB, tehsil: TEHSIL_B }),
    ]);

    wsA = uuidv4();
    wsB = uuidv4();
    await ds.getRepository(WaterSystem).save([
      ds.getRepository(WaterSystem).create({
        id: wsA,
        tehsil: TEHSIL_A,
        village: `INT-V-${tag}`,
        settlement: '',
        uniqueIdentifier: `INT-WA-${tag}`,
        bulkMeterInstalled: true,
      }),
      ds.getRepository(WaterSystem).create({
        id: wsB,
        tehsil: TEHSIL_B,
        village: `INT-V-${tag}`,
        settlement: '',
        uniqueIdentifier: `INT-WB-${tag}`,
        bulkMeterInstalled: true,
      }),
    ]);
    ssA = uuidv4();
    ssB = uuidv4();
    await ds.getRepository(SolarSystem).save([
      ds.getRepository(SolarSystem).create({
        id: ssA,
        tehsil: TEHSIL_A,
        village: `INT-V-${tag}`,
        uniqueIdentifier: `INT-SA-${tag}`,
      }),
      ds.getRepository(SolarSystem).create({
        id: ssB,
        tehsil: TEHSIL_B,
        village: `INT-V-${tag}`,
        uniqueIdentifier: `INT-SB-${tag}`,
      }),
    ]);
  }, 120_000);

  afterAll(async () => {
    if (!dbAvailable || !moduleRef) return;
    try {
      const userIds = Object.values(users);
      const entryIds = [...logIds, ...solarIds];
      await ds.getRepository(EntryChangeLog).delete({ entryId: In(entryIds) });
      const subs = await ds
        .getRepository(Submission)
        .find({ where: { recordId: In(entryIds) } });
      const subIds = subs.map((s) => s.id);
      if (subIds.length) {
        await ds
          .getRepository(Notification)
          .delete({ submissionId: In(subIds) });
        await ds
          .getRepository(VerificationLog)
          .delete({ submissionId: In(subIds) });
        await ds.getRepository(Submission).delete({ id: In(subIds) });
      }
      await ds.getRepository(Notification).delete({ userId: In(userIds) });
      await ds
        .getRepository(WaterEnergyLoggingDaily)
        .delete({ id: In(logIds) });
      await ds
        .getRepository(SolarEnergyLoggingMonthly)
        .delete({ id: In(solarIds) });
      await ds.getRepository(WaterSystem).delete({ id: In([wsA, wsB]) });
      await ds.getRepository(SolarSystem).delete({ id: In([ssA, ssB]) });
      await ds.getRepository(User).delete({ id: In(userIds) });
    } finally {
      await app?.close();
    }
  }, 60_000);

  const skip = () => {
    if (!dbAvailable) {
      expect(true).toBe(true);
      return true;
    }
    return false;
  };

  // ── Reject ────────────────────────────────────────────────────────────────

  describe('reject accepted water log', () => {
    it('rejects, records the reason everywhere, and notifies operator + tehsil manager only', async () => {
      if (skip()) return;
      const { logId, subId } = await makeWaterLog('accepted');

      const res = await svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
        reason: `   ${REASON}   `,
      });
      expect(res.statusCode).toBe(200);

      const log = await ds
        .getRepository(WaterEnergyLoggingDaily)
        .findOneByOrFail({ id: logId });
      expect(log.status).toBe('rejected');
      const sub = await ds
        .getRepository(Submission)
        .findOneByOrFail({ id: subId! });
      expect(sub.status).toBe('rejected');
      expect(sub.reviewedBy).toBe(users.mo);
      expect(sub.remarks).toBe(REASON); // trimmed

      const vlogs = await ds
        .getRepository(VerificationLog)
        .find({ where: { submissionId: subId! } });
      expect(vlogs.map((v) => v.actionType)).toContain('manager_reject');

      const [audit] = await changeLogsFor(logId);
      expect(audit).toMatchObject({
        entryType: 'water_log',
        action: 'reject',
        reason: REASON,
        previousStatus: 'accepted',
        newStatus: 'rejected',
        performedBy: users.mo,
        tehsil: TEHSIL_A,
        systemUid: `INT-WA-${tag}`,
        submissionId: subId,
      });
      expect((audit.snapshot as any).record.status).toBe('accepted');

      const notes = await ds.getRepository(Notification).find({
        where: {
          userId: In(Object.values(users)),
          title: 'Water log rejected by Manager Operations',
        },
      });
      const recipients = new Set(
        notes
          .filter((n) => n.message.includes(log.id) || n.submissionId === subId)
          .map((n) => n.userId),
      );
      expect(recipients.has(users.op)).toBe(true);
      expect(recipients.has(users.tm)).toBe(true);
      expect(recipients.has(users.tmB)).toBe(false);
      expect(recipients.has(users.mo)).toBe(false);
    });

    it('refuses to reject twice (409) and writes no second audit row', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      expect(
        (
          await svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
            reason: REASON,
          })
        ).statusCode,
      ).toBe(200);
      const again = await svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
        reason: REASON,
      });
      expect(again.statusCode).toBe(409);
      expect(again.body.error).toMatch(/already been rejected/);
      expect(await changeLogsFor(logId)).toHaveLength(1);
    });

    it.each(['submitted', 'drafted', 'reverted_back'])(
      'refuses to reject or delete an in-flight (%s) log and leaves it untouched',
      async (status) => {
        if (skip()) return;
        const { logId, subId } = await makeWaterLog(status);
        const r1 = await svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
          reason: REASON,
        });
        const r2 = await svc.deleteWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
          reason: REASON,
        });
        expect(r1.statusCode).toBe(409);
        expect(r2.statusCode).toBe(409);
        const log = await ds
          .getRepository(WaterEnergyLoggingDaily)
          .findOneByOrFail({ id: logId });
        expect(log.status).toBe(status);
        expect(
          (await ds.getRepository(Submission).findOneByOrFail({ id: subId! }))
            .status,
        ).toBe(status);
        expect(await changeLogsFor(logId)).toHaveLength(0);
      },
    );

    it('works for a legacy accepted log that has no submission row', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted', {
        withSubmission: false,
      });
      const res = await svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
        reason: REASON,
      });
      expect(res.statusCode).toBe(200);
      const [audit] = await changeLogsFor(logId);
      expect(audit.submissionId).toBeNull();
    });

    it('removes the rejected reading from the meter chain', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted', { meterEnd: 987654 });
      expect(await meter.getLatestSubmittedMeterReadingEnd(wsA)).toBe(987654);
      await svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
        reason: REASON,
      });
      expect(await meter.getLatestSubmittedMeterReadingEnd(wsA)).not.toBe(
        987654,
      );
    });

    it('tehsil manager cannot re-accept a log rejected by Manager Operations', async () => {
      if (skip()) return;
      const { logId, subId } = await makeWaterLog('accepted');
      await svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
        reason: REASON,
      });
      const res = await tm.acceptSubmission(as('tm', 'ADMIN'), subId!, {});
      expect(res.statusCode).toBe(400);
    });

    it('shows the rejected status and reason in the tehsil manager queue', async () => {
      if (skip()) return;
      const { logId, subId } = await makeWaterLog('accepted');
      await svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
        reason: REASON,
      });
      const res = await tm.getPendingSubmissions(as('tm', 'ADMIN'));
      const row = (res.body.submissions as any[]).find((s) => s.id === subId);
      expect(row).toMatchObject({ status: 'rejected', remarks: REASON });
    });
  });

  // ── Validation & authorisation ───────────────────────────────────────────

  describe('validation and authorisation', () => {
    it.each([
      [undefined, 'A reason is required'],
      [{}, 'A reason is required'],
      [{ reason: '' }, 'A reason is required'],
      [{ reason: '     ' }, 'A reason is required'],
      [{ reason: 123 }, 'A reason is required'],
      [{ reason: 'too short' }, /at least 10/],
      [{ reason: 'x'.repeat(1001) }, /at most 1000/],
    ])('rejects body %p with 400 and changes nothing', async (body, msg) => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      for (const fn of [svc.rejectWaterLog, svc.deleteWaterLog]) {
        const res = await fn.call(svc, as('mo', 'SUPER_ADMIN'), logId, body);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toEqual(
          typeof msg === 'string' ? msg : expect.stringMatching(msg),
        );
      }
      const log = await ds
        .getRepository(WaterEnergyLoggingDaily)
        .findOneByOrFail({ id: logId });
      expect(log.status).toBe('accepted');
      expect(await changeLogsFor(logId)).toHaveLength(0);
    });

    it.each([
      ['tm', 'ADMIN'],
      ['op', 'USER'],
      ['sys', 'SYSTEM_ADMIN'],
    ])('refuses %s (%s) with 403', async (key, role) => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      const s = await makeSolarLog(ssA, 1);
      expect(
        (await svc.rejectWaterLog(as(key, role), logId, { reason: REASON }))
          .statusCode,
      ).toBe(403);
      expect(
        (await svc.deleteWaterLog(as(key, role), logId, { reason: REASON }))
          .statusCode,
      ).toBe(403);
      expect(
        (await svc.deleteSolarLog(as(key, role), s, { reason: REASON }))
          .statusCode,
      ).toBe(403);
      expect(await changeLogsFor(logId)).toHaveLength(0);
    });

    it('uses the DB role, not the JWT claim (stale/forged SUPER_ADMIN claim is refused)', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      const res = await svc.rejectWaterLog(
        { sub: users.tm, role: 'SUPER_ADMIN' },
        logId,
        { reason: REASON },
      );
      expect(res.statusCode).toBe(403);
    });

    it('refuses a deactivated Manager Operations account', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      const res = await svc.rejectWaterLog(
        as('moInactive', 'SUPER_ADMIN'),
        logId,
        { reason: REASON },
      );
      expect(res.statusCode).toBe(403);
    });

    it('refuses entries outside the manager’s assigned tehsils', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted', { systemId: wsB });
      const s = await makeSolarLog(ssB, 2);
      for (const key of ['mo', 'moNoScope']) {
        expect(
          (
            await svc.rejectWaterLog(as(key, 'SUPER_ADMIN'), logId, {
              reason: REASON,
            })
          ).statusCode,
        ).toBe(403);
        expect(
          (
            await svc.deleteWaterLog(as(key, 'SUPER_ADMIN'), logId, {
              reason: REASON,
            })
          ).statusCode,
        ).toBe(403);
        expect(
          (
            await svc.deleteSolarLog(as(key, 'SUPER_ADMIN'), s, {
              reason: REASON,
            })
          ).statusCode,
        ).toBe(403);
      }
      // The manager assigned to that tehsil can.
      expect(
        (
          await svc.rejectWaterLog(as('moB', 'SUPER_ADMIN'), logId, {
            reason: REASON,
          })
        ).statusCode,
      ).toBe(200);
    });

    it.each([uuidv4(), 'not-a-uuid', 'x'.repeat(200), ''])(
      'returns 404 for unknown id %p',
      async (id) => {
        if (skip()) return;
        expect(
          (
            await svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), id, {
              reason: REASON,
            })
          ).statusCode,
        ).toBe(404);
        expect(
          (
            await svc.deleteWaterLog(as('mo', 'SUPER_ADMIN'), id, {
              reason: REASON,
            })
          ).statusCode,
        ).toBe(404);
        expect(
          (
            await svc.deleteSolarLog(as('mo', 'SUPER_ADMIN'), id, {
              reason: REASON,
            })
          ).statusCode,
        ).toBe(404);
      },
    );
  });

  // ── Delete ───────────────────────────────────────────────────────────────

  describe('delete water log', () => {
    it('hard-deletes the log and its verification graph, keeping a full snapshot', async () => {
      if (skip()) return;
      const { logId, subId } = await makeWaterLog('accepted', {
        meterEnd: 5000,
      });
      const res = await svc.deleteWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
        reason: REASON,
      });
      expect(res.statusCode).toBe(200);

      expect(
        await ds
          .getRepository(WaterEnergyLoggingDaily)
          .findOneBy({ id: logId }),
      ).toBeNull();
      expect(
        await ds.getRepository(Submission).findOneBy({ id: subId! }),
      ).toBeNull();
      expect(
        await ds
          .getRepository(VerificationLog)
          .countBy({ submissionId: subId! }),
      ).toBe(0);
      expect(
        await ds.getRepository(Notification).countBy({ submissionId: subId! }),
      ).toBe(0);

      const [audit] = await changeLogsFor(logId);
      expect(audit).toMatchObject({
        action: 'delete',
        previousStatus: 'accepted',
        newStatus: 'deleted',
      });
      const snap = audit.snapshot as any;
      expect(snap.record.meter_reading_end).toBe(5000);
      expect(snap.submissions[0].id).toBe(subId);
      expect(snap.verification_history.map((v: any) => v.action_type)).toEqual([
        'submit',
        'accept',
      ]);

      // Operator still gets told, via a notification not tied to the deleted submission.
      const note = await ds.getRepository(Notification).findOne({
        where: {
          userId: users.op,
          title: 'Water log deleted by Manager Operations',
        },
      });
      expect(note?.submissionId).toBeNull();
    });

    it('can delete a log that Manager Operations rejected earlier; both actions stay in history', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      await svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
        reason: REASON,
      });
      const res = await svc.deleteWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
        reason: 'Duplicate of another day entry',
      });
      expect(res.statusCode).toBe(200);
      const history = await changeLogsFor(logId);
      expect(history.map((h) => h.action)).toEqual(['reject', 'delete']);
      expect(history[1].previousStatus).toBe('rejected');
      expect(
        (history[1].snapshot as any).verification_history.map(
          (v: any) => v.action_type,
        ),
      ).toContain('manager_reject');
    });

    it('second delete returns 404', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      expect(
        (
          await svc.deleteWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
            reason: REASON,
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await svc.deleteWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
            reason: REASON,
          })
        ).statusCode,
      ).toBe(404);
    });
  });

  describe('concurrency', () => {
    it('parallel rejects: exactly one wins, one audit row', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      const results = await Promise.all([
        svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, { reason: REASON }),
        svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, { reason: REASON }),
        svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, { reason: REASON }),
      ]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409, 409]);
      expect(await changeLogsFor(logId)).toHaveLength(1);
    });

    it('parallel deletes: exactly one wins, one audit row', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      const results = await Promise.all([
        svc.deleteWaterLog(as('mo', 'SUPER_ADMIN'), logId, { reason: REASON }),
        svc.deleteWaterLog(as('mo', 'SUPER_ADMIN'), logId, { reason: REASON }),
      ]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([200, 404]);
      expect(await changeLogsFor(logId)).toHaveLength(1);
    });
  });

  // ── Solar ────────────────────────────────────────────────────────────────

  describe('delete solar monthly entry', () => {
    it('deletes, snapshots and notifies the tehsil manager', async () => {
      if (skip()) return;
      const id = await makeSolarLog(ssA, 3);
      const res = await svc.deleteSolarLog(as('mo', 'SUPER_ADMIN'), id, {
        reason: REASON,
      });
      expect(res.statusCode).toBe(200);
      expect(
        await ds.getRepository(SolarEnergyLoggingMonthly).findOneBy({ id }),
      ).toBeNull();
      const [audit] = await changeLogsFor(id);
      expect(audit).toMatchObject({
        entryType: 'solar_log',
        action: 'delete',
        entryPeriod: '2026-03',
        systemUid: `INT-SA-${tag}`,
        tehsil: TEHSIL_A,
      });
      expect((audit.snapshot as any).record.export_off_peak).toBe(100);
      const note = await ds.getRepository(Notification).findOne({
        where: {
          userId: users.tm,
          title: 'Solar entry deleted by Manager Operations',
        },
      });
      expect(note).not.toBeNull();
      expect(
        await ds.getRepository(Notification).countBy({
          userId: users.tmB,
          title: 'Solar entry deleted by Manager Operations',
        }),
      ).toBe(0);
    });

    it('second delete returns 404', async () => {
      if (skip()) return;
      const id = await makeSolarLog(ssA, 4);
      expect(
        (
          await svc.deleteSolarLog(as('mo', 'SUPER_ADMIN'), id, {
            reason: REASON,
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await svc.deleteSolarLog(as('mo', 'SUPER_ADMIN'), id, {
            reason: REASON,
          })
        ).statusCode,
      ).toBe(404);
    });
  });

  // ── Change history listing ───────────────────────────────────────────────

  describe('change history', () => {
    let entryA = '';
    let entryB = '';
    beforeAll(async () => {
      if (!dbAvailable) return;
      entryA = (await makeWaterLog('accepted')).logId;
      entryB = (await makeWaterLog('accepted', { systemId: wsB })).logId;
      await svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), entryA, {
        reason: REASON,
      });
      await svc.rejectWaterLog(as('moB', 'SUPER_ADMIN'), entryB, {
        reason: REASON,
      });
    });

    const ids = (res: { body: Record<string, unknown> }) =>
      new Set((res.body.change_logs as any[]).map((r) => r.entry_id));

    it('is scoped to the caller’s tehsils for Manager Operations and tehsil managers', async () => {
      if (skip()) return;
      const mo = ids(await svc.listChangeLogs(as('mo', 'SUPER_ADMIN'), {}));
      expect(mo.has(entryA)).toBe(true);
      expect(mo.has(entryB)).toBe(false);
      const tmA = ids(await svc.listChangeLogs(as('tm', 'ADMIN'), {}));
      expect(tmA.has(entryA)).toBe(true);
      expect(tmA.has(entryB)).toBe(false);
      const tmB = ids(await svc.listChangeLogs(as('tmB', 'ADMIN'), {}));
      expect(tmB.has(entryB)).toBe(true);
      expect(tmB.has(entryA)).toBe(false);
      const none = await svc.listChangeLogs(as('moNoScope', 'SUPER_ADMIN'), {});
      expect(none.body.change_logs).toEqual([]);
    });

    it.each([
      ['op', 'USER'],
      ['sys', 'SYSTEM_ADMIN'],
    ])('refuses %s', async (key, role) => {
      if (skip()) return;
      expect((await svc.listChangeLogs(as(key, role), {})).statusCode).toBe(
        403,
      );
    });

    it('filters and validates query params', async () => {
      if (skip()) return;
      const byEntry = await svc.listChangeLogs(as('mo', 'SUPER_ADMIN'), {
        entry_id: entryA,
      });
      expect(
        (byEntry.body.change_logs as any[]).every((r) => r.entry_id === entryA),
      ).toBe(true);
      expect((byEntry.body.change_logs as any[]).length).toBe(1);

      const solarOnly = await svc.listChangeLogs(as('mo', 'SUPER_ADMIN'), {
        entry_type: 'solar_log',
      });
      expect(
        (solarOnly.body.change_logs as any[]).every(
          (r) => r.entry_type === 'solar_log',
        ),
      ).toBe(true);

      const today = new Date().toISOString().slice(0, 10);
      const ranged = await svc.listChangeLogs(as('mo', 'SUPER_ADMIN'), {
        date_from: today,
        date_to: today,
      });
      expect(ids(ranged).has(entryA)).toBe(true);
      const past = await svc.listChangeLogs(as('mo', 'SUPER_ADMIN'), {
        date_from: '2020-01-01',
        date_to: '2020-01-02',
      });
      expect(past.body.change_logs).toEqual([]);

      const bad = [
        { entry_type: 'bogus' },
        { action: 'approve' },
        { date_from: '2026-02-30' },
        { date_to: 'yesterday' },
        { date_from: '2026-05-02', date_to: '2026-05-01' },
        { tehsil: 'NOT A TEHSIL' },
      ];
      for (const q of bad) {
        expect(
          (await svc.listChangeLogs(as('mo', 'SUPER_ADMIN'), q)).statusCode,
        ).toBe(400);
      }
      expect(
        (
          await svc.listChangeLogs(as('mo', 'SUPER_ADMIN'), {
            tehsil: TEHSIL_B,
          })
        ).statusCode,
      ).toBe(403);
      const limited = await svc.listChangeLogs(as('mo', 'SUPER_ADMIN'), {
        limit: '1',
      });
      expect((limited.body.change_logs as any[]).length).toBe(1);
    });
  });

  // ── HTTP layer (guards, routing, status codes) ───────────────────────────

  describe('HTTP', () => {
    const token = (key: string, role: string) =>
      `Bearer ${jwt.sign({ sub: users[key], role })}`;

    it('requires authentication', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      await request(app!.getHttpServer())
        .post(`/api/operator/manager-ops/water-logs/${logId}/reject`)
        .send({ reason: REASON })
        .expect(401);
    });

    it.each([
      ['tm', 'ADMIN'],
      ['op', 'USER'],
      ['sys', 'SYSTEM_ADMIN'],
    ])('guards mutations from %s', async (key, role) => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      await request(app!.getHttpServer())
        .post(`/api/operator/manager-ops/water-logs/${logId}/delete`)
        .set('Authorization', token(key, role))
        .send({ reason: REASON })
        .expect(403);
      expect(
        await ds
          .getRepository(WaterEnergyLoggingDaily)
          .findOneBy({ id: logId }),
      ).not.toBeNull();
    });

    it('end to end: reject → 200, reject again → 409, bad reason → 400, list shows it', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      const srv = app!.getHttpServer();
      const auth = token('mo', 'SUPER_ADMIN');
      await request(srv)
        .post(`/api/operator/manager-ops/water-logs/${logId}/reject`)
        .set('Authorization', auth)
        .send({ reason: 'short' })
        .expect(400);
      const ok = await request(srv)
        .post(`/api/operator/manager-ops/water-logs/${logId}/reject`)
        .set('Authorization', auth)
        .send({ reason: REASON })
        .expect(200);
      expect(ok.body.change_log.entry_id).toBe(logId);
      await request(srv)
        .post(`/api/operator/manager-ops/water-logs/${logId}/reject`)
        .set('Authorization', auth)
        .send({ reason: REASON })
        .expect(409);
      const list = await request(srv)
        .get(`/api/operator/manager-ops/change-logs`)
        .query({ entry_id: logId })
        .set('Authorization', token('tm', 'ADMIN'))
        .expect(200);
      expect(list.body.change_logs).toHaveLength(1);
      expect(list.body.change_logs[0].reason).toBe(REASON);
    });

    it('tehsil manager may read history but USER may not', async () => {
      if (skip()) return;
      await request(app!.getHttpServer())
        .get(`/api/operator/manager-ops/change-logs`)
        .set('Authorization', token('op', 'USER'))
        .expect(403);
    });
  });

  // ── Notifications ────────────────────────────────────────────────────────

  describe('notifications', () => {
    const token = (key: string, role: string) =>
      `Bearer ${jwt.sign({ sub: users[key], role })}`;

    it('links override notices to the change-log row', async () => {
      if (skip()) return;
      const { logId } = await makeWaterLog('accepted');
      const res = await svc.rejectWaterLog(as('mo', 'SUPER_ADMIN'), logId, {
        reason: REASON,
      });
      const changeLogId = (res.body.change_log as { id: string }).id;
      const notes = await ds
        .getRepository(Notification)
        .find({ where: { entityId: changeLogId } });
      expect(notes.length).toBeGreaterThanOrEqual(2); // operator + tehsil manager
      expect(notes.every((n) => n.notificationType === 'entry_change')).toBe(
        true,
      );

      const list = await request(app!.getHttpServer())
        .get('/api/operator/notifications')
        .set('Authorization', token('tm', 'ADMIN'))
        .expect(200);
      const mine = (list.body.notifications as any[]).find(
        (n) => n.entity_id === changeLogId,
      );
      expect(mine).toMatchObject({ type: 'entry_change', is_read: false });
    });

    it('batch mark-read only touches the caller’s own notifications', async () => {
      if (skip()) return;
      const repo = ds.getRepository(Notification);
      const own = await repo.save(
        repo.create({ userId: users.tm, title: 'own', message: 'm' }),
      );
      const other = await repo.save(
        repo.create({ userId: users.tmB, title: 'other', message: 'm' }),
      );
      const srv = app!.getHttpServer();
      const res = await request(srv)
        .post('/api/operator/notifications/read-batch')
        .set('Authorization', token('tm', 'ADMIN'))
        .send({ ids: [own.id, other.id, 42, '', 'x'.repeat(99)] })
        .expect(200);
      expect(res.body.updated).toBe(1);
      expect((await repo.findOneByOrFail({ id: own.id })).isRead).toBe(true);
      expect((await repo.findOneByOrFail({ id: other.id })).isRead).toBe(false);

      await request(srv)
        .post('/api/operator/notifications/read-batch')
        .set('Authorization', token('tm', 'ADMIN'))
        .send({ ids: 'nope' })
        .expect(400);
      await request(srv)
        .post('/api/operator/notifications/read-batch')
        .set('Authorization', token('tm', 'ADMIN'))
        .send({ ids: Array.from({ length: 101 }, () => uuidv4()) })
        .expect(400);
      await request(srv)
        .post('/api/operator/notifications/read-batch')
        .send({ ids: [own.id] })
        .expect(401);
    });

    it('mark-all with a type leaves other kinds unread', async () => {
      if (skip()) return;
      const repo = ds.getRepository(Notification);
      const change = await repo.save(
        repo.create({
          userId: users.tmB,
          title: 'c',
          message: 'm',
          notificationType: 'entry_change',
        }),
      );
      const general = await repo.save(
        repo.create({ userId: users.tmB, title: 'g', message: 'm' }),
      );
      await request(app!.getHttpServer())
        .post('/api/operator/notifications/read-all')
        .query({ type: 'entry_change' })
        .set('Authorization', token('tmB', 'ADMIN'))
        .expect(201);
      expect((await repo.findOneByOrFail({ id: change.id })).isRead).toBe(true);
      expect((await repo.findOneByOrFail({ id: general.id })).isRead).toBe(
        false,
      );
    });
  });
});
