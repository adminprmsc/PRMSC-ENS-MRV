import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AppModule } from '../src/app.module';
import {
  NOTIFICATION_TYPE_RELEASE,
  ReleaseNotesService,
} from '../src/application/services/release-notes.service';
import { TehsilManagerService } from '../src/application/services/tehsil-manager.service';
import {
  RELEASE_NOTES,
  isAnnounced,
} from '../src/domain/constants/release-notes';
import { Notification } from '../src/infrastructure/database/entities/notification.entity';
import { ReleaseNoteReceipt } from '../src/infrastructure/database/entities/release-note-receipt.entity';
import { SystemMeter } from '../src/infrastructure/database/entities/system-meter.entity';
import { User } from '../src/infrastructure/database/entities/user.entity';
import { UserTehsil } from '../src/infrastructure/database/entities/user-tehsil.entity';
import { WaterBulkCutoverLog } from '../src/infrastructure/database/entities/water-bulk-cutover-log.entity';
import { WaterEnergyLoggingDaily } from '../src/infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../src/infrastructure/database/entities/water-system.entity';
import { integrationDatabaseUrl, isPostgresReachable } from './integration-env';

const ROLE = {
  USER: 'f1111111-1111-4111-a111-111111111101',
  ADMIN: 'f1111111-1111-4111-a111-111111111102',
  SUPER_ADMIN: 'f1111111-1111-4111-a111-111111111103',
} as const;
const TEHSIL = 'DARYA KHAN';
type Body = Record<string, unknown>;

describe('Release notes + bulk-meter start integrity (Postgres integration)', () => {
  let dbAvailable = false;
  let moduleRef: TestingModule | undefined;
  let ds: DataSource;
  let rel: ReleaseNotesService;
  let tm: TehsilManagerService;

  const tag = uuidv4().slice(0, 8);
  const users: Record<string, string> = {};
  let ws = '';
  const logIds: string[] = [];

  const activeFor = (role: string) =>
    RELEASE_NOTES.filter((n) => n.audiences.includes(role) && isAnnounced(n));

  async function mkUser(key: string, roleId: string) {
    const id = uuidv4();
    await ds.getRepository(User).save(
      ds.getRepository(User).create({
        id,
        name: `INT ${key} ${tag}`,
        email: `int-rel-${key}-${tag}@example.test`,
        passwordHash: 'x',
        roleId,
        isActive: true,
      }),
    );
    users[key] = id;
  }

  async function addLog(date: string, start: string, meterEnd: number | null) {
    const id = uuidv4();
    await ds.getRepository(WaterEnergyLoggingDaily).save(
      ds.getRepository(WaterEnergyLoggingDaily).create({
        id,
        waterSystemId: ws,
        logDate: new Date(`${date}T00:00:00Z`),
        pumpStartTime: `${start}:00`,
        pumpEndTime: `${start}:00`,
        pumpOperatingHours: 1,
        meterReadingStart: meterEnd != null ? meterEnd - 10 : null,
        meterReadingEnd: meterEnd,
        totalWaterPumped: meterEnd != null ? 10 : null,
        status: 'accepted',
        signed: true,
      }),
    );
    logIds.push(id);
  }

  const update = (date: string, time = '') =>
    tm.updateWaterSystem({ sub: users.tm, role: 'ADMIN' }, ws, {
      bulk_meter_since_date: date,
      bulk_meter_since_time: time,
      current_meter: {
        meter_type: 'tubewell',
        meter_model: 'M1',
        meter_serial_number: `SN-${tag}`,
        meter_accuracy_class: 'B',
        installation_date: '2026-01-01',
      },
    });

  const audits = () =>
    ds
      .getRepository(WaterBulkCutoverLog)
      .find({ where: { waterSystemId: ws }, order: { createdAt: 'ASC' } });

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDatabaseUrl();
    dbAvailable = await isPostgresReachable();
    if (!dbAvailable) return;
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    ds = moduleRef.get(DataSource);
    rel = moduleRef.get(ReleaseNotesService);
    tm = moduleRef.get(TehsilManagerService);

    await mkUser('tm', ROLE.ADMIN);
    await mkUser('mo', ROLE.SUPER_ADMIN);
    await mkUser('op', ROLE.USER);
    await ds
      .getRepository(UserTehsil)
      .save(
        ds
          .getRepository(UserTehsil)
          .create({ userId: users.tm, tehsil: TEHSIL }),
      );

    ws = uuidv4();
    await ds.getRepository(WaterSystem).save(
      ds.getRepository(WaterSystem).create({
        id: ws,
        tehsil: TEHSIL,
        village: `INT-REL-${tag}`,
        settlement: '',
        uniqueIdentifier: `INT-REL-${tag}`,
        bulkMeterInstalled: true,
        pumpHorsePower: 10,
        pumpFlowRate: 10,
      }),
    );
    await addLog('2026-01-10', '08:00', null); // hours only, before the meter
    await addLog('2026-02-01', '09:00', 100); // first meter reading
    await addLog('2026-02-03', '09:00', 150);
    await addLog('2026-02-04', '09:00', null); // hours only after the meter
  }, 120_000);

  afterAll(async () => {
    if (!dbAvailable || !moduleRef) return;
    try {
      const ids = Object.values(users);
      await ds.getRepository(Notification).delete({ userId: In(ids) });
      await ds.getRepository(ReleaseNoteReceipt).delete({ userId: In(ids) });
      await ds.getRepository(WaterBulkCutoverLog).delete({ waterSystemId: ws });
      await ds
        .getRepository(WaterEnergyLoggingDaily)
        .delete({ id: In(logIds) });
      await ds.getRepository(SystemMeter).delete({ waterSystemId: ws });
      await ds.getRepository(WaterSystem).delete({ id: ws });
      await ds.getRepository(UserTehsil).delete({ userId: In(ids) });
      await ds.getRepository(User).delete({ id: In(ids) });
    } finally {
      await moduleRef.close();
    }
  }, 60_000);

  const skip = () => {
    if (!dbAvailable) {
      expect(true).toBe(true);
      return true;
    }
    return false;
  };

  // ── Release notes ────────────────────────────────────────────────────────

  it('announces active notes to managers and notifies each user exactly once', async () => {
    if (skip()) return;
    const expected = activeFor('ADMIN')
      .map((n) => n.id)
      .sort();
    // Two concurrent loads (e.g. two tabs) must not double-notify.
    const [a] = await Promise.all([
      rel.announcements(users.tm),
      rel.announcements(users.tm),
    ]);
    expect(a.items.map((i) => i.id).sort()).toEqual(expected);
    await rel.announcements(users.tm);
    const notes = await ds.getRepository(Notification).find({
      where: { userId: users.tm, notificationType: NOTIFICATION_TYPE_RELEASE },
    });
    expect(notes.map((n) => n.entityId).sort()).toEqual(expected);
  });

  it('dismissed notes stop showing but stay in What’s new', async () => {
    if (skip()) return;
    const first = activeFor('ADMIN')[0];
    await rel.dismiss(users.tm, first.id);
    const ann = await rel.announcements(users.tm);
    expect(ann.items.find((i) => i.id === first.id)).toBeUndefined();
    const list = await rel.list(users.tm);
    const item = list.items.find((i) => i.id === first.id)!;
    expect(item.dismissed_at).not.toBeNull();
    expect(item.read_at).not.toBeNull();
    expect(list.unread).toBe(activeFor('ADMIN').length - 1);
  });

  it('role-specific content and links', async () => {
    if (skip()) return;
    const mo = await rel.list(users.mo);
    expect(mo.items.length).toBe(
      RELEASE_NOTES.filter((n) => n.audiences.includes('SUPER_ADMIN')).length,
    );
    const water = mo.items.find(
      (i) => i.id === '2026-11-water-bulk-meter-source',
    );
    expect(water?.link).toEqual({
      label: 'Open Water analysis',
      path: '/hq/water',
    });
    // Tubewell operators are not an audience.
    expect((await rel.list(users.op)).items).toEqual([]);
    await expect(rel.markRead(users.op, RELEASE_NOTES[0].id)).rejects.toThrow(
      'Release note not found',
    );
    await expect(rel.markRead(users.tm, 'no-such-note')).rejects.toThrow(
      'Release note not found',
    );
  });

  // ── Bulk-meter start: measured data is never silently dropped ────────────

  it('refuses a start after existing meter readings (would drop them)', async () => {
    if (skip()) return;
    const r = await update('2026-02-03', '12:00');
    expect(r.statusCode).toBe(409);
    expect(r.body).toMatchObject({
      error: 'bulk_meter_start_after_readings',
      earliest_reading: '2026-02-01 09:00',
    });
    const site = await ds
      .getRepository(WaterSystem)
      .findOneByOrFail({ id: ws });
    expect(site.bulkMeterSinceDate).toBeNull();
    expect(await audits()).toHaveLength(0);
  });

  it('accepts a start at the first reading, warns about later hours-only logs, audits it', async () => {
    if (skip()) return;
    const r = await update('2026-02-01', '09:00');
    expect(r.statusCode).toBe(200);
    expect((r.body as Body).warning).toContain('1 log(s)');
    const log = await audits();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      previousSince: null,
      newSince: '2026-02-01 09:00:00',
      newlyUnmeteredLogs: 1,
      performedBy: users.tm,
    });
  });

  it('saving the same start again does not add an audit row; clearing does', async () => {
    if (skip()) return;
    expect((await update('2026-02-01', '09:00')).statusCode).toBe(200);
    expect(await audits()).toHaveLength(1);
    expect((await update('')).statusCode).toBe(200);
    const log = await audits();
    expect(log).toHaveLength(2);
    expect(log[1]).toMatchObject({
      previousSince: '2026-02-01 09:00:00',
      newSince: null,
    });
  });

  it('logs and readings themselves are never modified', async () => {
    if (skip()) return;
    const rows = await ds
      .getRepository(WaterEnergyLoggingDaily)
      .find({ where: { id: In(logIds) } });
    expect(rows.map((r) => r.meterReadingEnd).sort()).toEqual(
      [100, 150, null, null].sort(),
    );
  });
});
