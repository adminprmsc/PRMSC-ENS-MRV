import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AppModule } from '../src/app.module';
import { DashboardService } from '../src/application/services/dashboard.service';
import { TehsilManagerService } from '../src/application/services/tehsil-manager.service';
import { resolveDashboardPeriod } from '../src/domain/utils/dashboard-period.util';
import { SolarEnergyLoggingMonthly } from '../src/infrastructure/database/entities/solar-energy-logging-monthly.entity';
import { SolarSystem } from '../src/infrastructure/database/entities/solar-system.entity';
import { SystemMeter } from '../src/infrastructure/database/entities/system-meter.entity';
import { Notification } from '../src/infrastructure/database/entities/notification.entity';
import { User } from '../src/infrastructure/database/entities/user.entity';
import { UserTehsil } from '../src/infrastructure/database/entities/user-tehsil.entity';
import { integrationDatabaseUrl, isPostgresReachable } from './integration-env';

const ROLE_ADMIN = 'f1111111-1111-4111-a111-111111111102';
const TEHSIL_A = 'ALIPUR';
const TEHSIL_B = 'ROJHAN';

type Body = Record<string, unknown>;

/**
 * "Before green meter" solar logs, end to end against Postgres:
 * service validation, atomic bulk save, edit, site-date conflicts,
 * HQ aggregates and the DB check constraint.
 */
describe('Solar meter phase — before green meter logs (Postgres integration)', () => {
  let dbAvailable = false;
  let moduleRef: TestingModule | undefined;
  let ds: DataSource;
  let tm: TehsilManagerService;
  let dash: DashboardService;

  const tag = uuidv4().slice(0, 8);
  const village = `INT-PG-${tag}`;
  const users: Record<string, string> = {};
  let s1 = ''; // ALIPUR, green meter 2025-06-15
  let s2 = ''; // ALIPUR, no green meter date
  let s3 = ''; // ROJHAN (other manager)

  const jwt = (k: string) => ({ sub: users[k], role: 'ADMIN' });

  const bulk = (
    who: string,
    systemId: string,
    tehsil: string,
    year: number,
    months: Body[],
  ) =>
    tm.saveSolarSupplyData(jwt(who), {
      year,
      data: [
        {
          tehsil,
          village,
          settlement: '',
          solar_system_id: systemId,
          monthlyData: months,
        },
      ],
    });

  const preGreen = (month: number, peak = 120, offPeak = 300): Body => ({
    month,
    meter_phase: 'pre_green',
    units_consumed_peak: peak,
    units_consumed_off_peak: offPeak,
  });
  const green = (month: number): Body => ({
    month,
    meter_phase: 'green',
    tou_required: true,
    export_off_peak: 50,
    export_peak: 20,
    import_off_peak: 30,
    import_peak: 10,
    net_off_peak: 20,
    net_peak: 10,
  });

  const logFor = (systemId: string, year: number, month: number) =>
    ds
      .getRepository(SolarEnergyLoggingMonthly)
      .findOne({ where: { solarSystemId: systemId, year, month } });

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDatabaseUrl();
    dbAvailable = await isPostgresReachable();
    if (!dbAvailable) {
      console.warn('[integration] Postgres not reachable — skipping.');
      return;
    }
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    ds = moduleRef.get(DataSource);
    tm = moduleRef.get(TehsilManagerService);
    dash = moduleRef.get(DashboardService);

    for (const k of ['tm', 'tmB']) {
      const id = uuidv4();
      await ds.getRepository(User).save(
        ds.getRepository(User).create({
          id,
          name: `INT ${k} ${tag}`,
          email: `int-pg-${k}-${tag}@example.test`,
          passwordHash: 'x',
          roleId: ROLE_ADMIN,
          isActive: true,
        }),
      );
      users[k] = id;
    }
    await ds
      .getRepository(UserTehsil)
      .save([
        ds
          .getRepository(UserTehsil)
          .create({ userId: users.tm, tehsil: TEHSIL_A }),
        ds
          .getRepository(UserTehsil)
          .create({ userId: users.tmB, tehsil: TEHSIL_B }),
      ]);

    s1 = uuidv4();
    s2 = uuidv4();
    s3 = uuidv4();
    const repo = ds.getRepository(SolarSystem);
    await repo.save([
      repo.create({
        id: s1,
        tehsil: TEHSIL_A,
        village,
        uniqueIdentifier: `INT-PG1-${tag}`,
        billReferenceNumber: `INT-BILL-1-${tag}`,
        greenMeterConnectionDate: new Date('2025-06-15T00:00:00Z'),
        greenConnectionDate: new Date('2025-06-15T00:00:00Z'),
      }),
      repo.create({
        id: s2,
        tehsil: TEHSIL_A,
        village,
        uniqueIdentifier: `INT-PG2-${tag}`,
        billReferenceNumber: `INT-BILL-2-${tag}`,
      }),
      repo.create({
        id: s3,
        tehsil: TEHSIL_B,
        village,
        uniqueIdentifier: `INT-PG3-${tag}`,
        billReferenceNumber: `INT-BILL-3-${tag}`,
      }),
    ]);
  }, 120_000);

  afterAll(async () => {
    if (!dbAvailable || !moduleRef) return;
    try {
      const ids = [s1, s2, s3];
      await ds
        .getRepository(SolarEnergyLoggingMonthly)
        .delete({ solarSystemId: In(ids) });
      await ds.getRepository(SystemMeter).delete({ solarSystemId: In(ids) });
      await ds.getRepository(SolarSystem).delete({ id: In(ids) });
      await ds
        .getRepository(UserTehsil)
        .delete({ userId: In(Object.values(users)) });
      // Saving logs may notify the manager; those rows reference the user.
      await ds
        .getRepository(Notification)
        .delete({ userId: In(Object.values(users)) });
      await ds.getRepository(User).delete({ id: In(Object.values(users)) });
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

  it('saves a before-green-meter month with consumption only', async () => {
    if (skip()) return;
    const r = await bulk('tm', s1, TEHSIL_A, 2025, [preGreen(3, 120.5, 300)]);
    expect(r.statusCode).toBe(201);
    const row = await logFor(s1, 2025, 3);
    expect(row).toMatchObject({
      meterPhase: 'pre_green',
      importPeak: 120.5,
      importOffPeak: 300,
      exportPeak: null,
      exportOffPeak: null,
      netPeak: null,
      netOffPeak: null,
    });
  });

  it('returns phase + consumption totals in list and record responses', async () => {
    if (skip()) return;
    const list = await tm.getSolarSupplyData(jwt('tm'), {
      solar_system_id: s1,
      year: '2025',
    });
    const rows = list.body as unknown as Body[];
    const mar = rows.find((r) => r.month === 3)!;
    expect(mar).toMatchObject({
      meter_phase: 'pre_green',
      units_consumed_peak: 120.5,
      units_consumed_off_peak: 300,
      units_consumed_total: 420.5,
      export_total: null,
      net_total: null,
    });
    const rec = await tm.getSolarSupplyDataRecord(jwt('tm'), String(mar.id));
    expect(rec.body).toMatchObject({
      meter_phase: 'pre_green',
      units_consumed_total: 420.5,
    });
  });

  it.each([
    [
      'green log before the green meter month',
      2025,
      green(2),
      'before the green meter was connected',
    ],
    [
      'pre-green log after the green meter month',
      2025,
      preGreen(8),
      'after the green meter was connected',
    ],
    [
      'export on a pre-green log',
      2025,
      { ...preGreen(1), export_peak: 4 },
      'Nothing is exported',
    ],
    ['negative consumption', 2025, preGreen(1, -1), 'cannot be negative'],
    [
      'missing off-peak',
      2025,
      { month: 1, meter_phase: 'pre_green', units_consumed_peak: 1 },
      'off-peak) is required',
    ],
    ['a future month', 2099, preGreen(1), 'future'],
    ['month 13', 2025, preGreen(13), 'between 1 and 12'],
    ['year before 2000', 1999, preGreen(1), '2000 or later'],
  ])('rejects %s', async (_label, year, month, msg) => {
    if (skip()) return;
    const r = await bulk('tm', s1, TEHSIL_A, year, [month]);
    expect(r.statusCode).toBe(400);
    expect(String((r.body as Body).message)).toContain(msg);
  });

  it('allows either phase in the green meter month itself', async () => {
    if (skip()) return;
    expect(
      (await bulk('tm', s1, TEHSIL_A, 2025, [preGreen(6)])).statusCode,
    ).toBe(201);
    expect((await logFor(s1, 2025, 6))?.meterPhase).toBe('pre_green');
    // Upsert switches the same month to green.
    expect((await bulk('tm', s1, TEHSIL_A, 2025, [green(6)])).statusCode).toBe(
      201,
    );
    const june = await logFor(s1, 2025, 6);
    expect(june).toMatchObject({ meterPhase: 'green', exportPeak: 20 });
  });

  it('bulk save is all-or-nothing', async () => {
    if (skip()) return;
    const r = await bulk('tm', s1, TEHSIL_A, 2025, [preGreen(4), green(5)]);
    expect(r.statusCode).toBe(400);
    expect(await logFor(s1, 2025, 4)).toBeNull();
  });

  it('rejects the same month twice in one request', async () => {
    if (skip()) return;
    const r = await bulk('tm', s1, TEHSIL_A, 2025, [preGreen(4), preGreen(4)]);
    expect(r.statusCode).toBe(400);
    expect(String((r.body as Body).message)).toContain('more than once');
    expect(await logFor(s1, 2025, 4)).toBeNull();
  });

  it('accepts both phases when the site has no green meter date (legacy)', async () => {
    if (skip()) return;
    expect(
      (await bulk('tm', s2, TEHSIL_A, 2024, [preGreen(1)])).statusCode,
    ).toBe(201);
    expect((await bulk('tm', s2, TEHSIL_A, 2024, [green(2)])).statusCode).toBe(
      201,
    );
  });

  it('legacy payload without meter_phase is inferred from its fields', async () => {
    if (skip()) return;
    const { meter_phase: _omit, ...legacyGreen } = green(9);
    void _omit;
    expect(
      (await bulk('tm', s1, TEHSIL_A, 2025, [legacyGreen])).statusCode,
    ).toBe(201);
    expect((await logFor(s1, 2025, 9))?.meterPhase).toBe('green');

    const { meter_phase: _o2, ...legacyGreenEarly } = green(1);
    void _o2;
    const r = await bulk('tm', s1, TEHSIL_A, 2025, [legacyGreenEarly]);
    expect(String((r.body as Body).message)).toContain(
      'before the green meter',
    );
  });

  it("another tehsil's manager cannot log for this site", async () => {
    if (skip()) return;
    const r = await bulk('tmB', s1, TEHSIL_A, 2025, [preGreen(2)]);
    expect(r.statusCode).toBe(400);
    expect(String((r.body as Body).message)).toContain('not permitted');
    expect(await logFor(s1, 2025, 2)).toBeNull();
  });

  it('single POST /solar-data validates and refuses duplicates with 409', async () => {
    if (skip()) return;
    const ok = await tm.submitSolarData(jwt('tm'), {
      solar_system_id: s1,
      year: 2025,
      ...preGreen(2),
    });
    expect(ok.statusCode).toBe(201);
    const dup = await tm.submitSolarData(jwt('tm'), {
      solar_system_id: s1,
      year: 2025,
      ...preGreen(2),
    });
    expect(dup.statusCode).toBe(409);
  });

  it('edits a pre-green record but will not turn it into green before the meter', async () => {
    if (skip()) return;
    const rec = (await logFor(s1, 2025, 3))!;
    const ok = await tm.updateSolarSupplyDataRecord(jwt('tm'), rec.id, {
      meter_phase: 'pre_green',
      units_consumed_peak: 99,
      units_consumed_off_peak: 1,
      remarks: 'corrected from bill',
    });
    expect(ok.statusCode).toBe(200);
    expect(await logFor(s1, 2025, 3)).toMatchObject({
      importPeak: 99,
      remarks: 'corrected from bill',
    });

    const bad = await tm.updateSolarSupplyDataRecord(jwt('tm'), rec.id, {
      ...green(3),
    });
    expect(bad.statusCode).toBe(400);
    expect((await logFor(s1, 2025, 3))?.meterPhase).toBe('pre_green');
  });

  it('refuses a green meter date that contradicts existing logs', async () => {
    if (skip()) return;
    // s1 logs now: pre_green Feb, Mar · green Jun, Sep (G = 2025-06-15).
    // Moving G to Feb 2025 strands the March pre-green log.
    const conflict = await tm.updateSolarSystem(jwt('tm'), s1, {
      green_meter_connection_date: '2025-02-01',
    });
    expect(conflict.statusCode).toBe(409);
    const body = conflict.body as Body;
    expect(body.error).toBe('green_meter_date_conflict');
    expect(body.conflicts).toEqual(
      expect.arrayContaining([
        { year: 2025, month: 3, meter_phase: 'pre_green' },
      ]),
    );
    // Unchanged.
    const site = await ds
      .getRepository(SolarSystem)
      .findOneByOrFail({ id: s1 });
    expect(site.greenMeterConnectionDate?.toISOString().slice(0, 10)).toBe(
      '2025-06-15',
    );

    // Moving G later than a green log strands it too.
    const later = await tm.updateSolarSystem(jwt('tm'), s1, {
      green_meter_connection_date: '2025-10-01',
    });
    expect(later.statusCode).toBe(409);

    const future = await tm.updateSolarSystem(jwt('tm'), s1, {
      green_meter_connection_date: '2099-01-01',
    });
    expect(future.statusCode).toBe(400);
    expect(String((future.body as Body).message)).toContain('future');

    // A date consistent with history is accepted.
    const fine = await tm.updateSolarSystem(jwt('tm'), s1, {
      green_meter_connection_date: '2025-06-01',
    });
    expect(fine.statusCode).toBe(200);
  });

  it('HQ analysis keeps green totals clean and reports the pre-green baseline', async () => {
    if (skip()) return;
    const period = resolveDashboardPeriod({ year: 2025 });
    const { rows } = await dash.getSolarSystemsDetail(
      TEHSIL_A,
      village,
      period,
    );
    const row = rows.find((r) => r.solar_system_id === s1)!;
    // s1 2025: pre_green Feb(120+300) + Mar(99+1); green Jun + Sep (import 40 each, export 70 each).
    expect(row.pre_green_months_logged).toBe(2);
    expect(row.pre_green_consumed_kwh).toBe(420 + 100);
    expect(row.avg_pre_green_consumed_kwh_per_month).toBe(260);
    expect(row.months_logged).toBe(2);
    expect(row.total_import_kwh).toBe(80);
    expect(row.total_export_kwh).toBe(140);
    // (40 − 260) / 260 → about −84.6 %
    expect(row.grid_draw_change_pct).toBeCloseTo(((40 - 260) / 260) * 100, 5);
    expect(row.green_meter_connection_date).toBe('2025-06-01');

    // Monthly grid-import series excludes pre-green consumption.
    const series = (await dash.getGridImport(
      TEHSIL_A,
      village,
      period,
    )) as Array<Record<string, number>>;
    const feb = series.find((m) => m.month === 2)!;
    const jun = series.find((m) => m.month === 6)!;
    expect(feb.grid_import_kwh).toBe(0);
    expect(jun.grid_import_kwh).toBe(40);
  });

  it('data-years lists only years that have logs, scoped by tehsil', async () => {
    if (skip()) return;
    const a = await dash.getDataYears(TEHSIL_A);
    // s1 has 2025 logs, s2 has 2024 logs (both ALIPUR).
    expect(a.solar_years).toEqual(expect.arrayContaining([2025, 2024]));
    expect(a.years).toEqual([...a.years].sort((x, y) => y - x));
    expect(a.years).toEqual(expect.arrayContaining(a.solar_years));
    // ROJHAN site s3 has no logs from this suite.
    const all = await dash.getDataYears(undefined, `${TEHSIL_A},${TEHSIL_B}`);
    expect(all.years).toEqual(expect.arrayContaining([2025, 2024]));
  });

  it('DB constraint blocks a pre-green row that carries export', async () => {
    if (skip()) return;
    await expect(
      ds.query(
        `INSERT INTO solar_energy_logging_monthly
           (id, solar_system_id, year, month, meter_phase, import_peak, import_off_peak, export_peak)
         VALUES ($1, $2, 2025, 1, 'pre_green', 1, 1, 5)`,
        [uuidv4(), s1],
      ),
    ).rejects.toThrow(/CHK_solar_monthly_pre_green_no_export/);
  });
});
