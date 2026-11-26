import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AppModule } from '../src/app.module';
import { DashboardService } from '../src/application/services/dashboard.service';
import { WaterMeterVolumeService } from '../src/application/services/water-meter-volume.service';
import { resolveDashboardPeriod } from '../src/domain/utils/dashboard-period.util';
import { WaterEnergyLoggingDaily } from '../src/infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../src/infrastructure/database/entities/water-system.entity';
import { integrationDatabaseUrl, isPostgresReachable } from './integration-env';

type Row = Record<string, unknown>;

/**
 * Water analysis source selection against Postgres:
 * bulk cutover (configured + fallback), one source per log, meter-era
 * averages, bulk-era unmetered logs, rejected logs, Command Center series.
 */
describe('Water source selection — bulk vs hourly (Postgres integration)', () => {
  let dbAvailable = false;
  let moduleRef: TestingModule | undefined;
  let ds: DataSource;
  let dash: DashboardService;
  let meter: WaterMeterVolumeService;

  const tag = uuidv4().slice(0, 8);
  const TEHSIL = 'ISA KHEL';
  const village = `INT-WS-${tag}`;
  const ids = { cut: '', fallback: '', ohr: '', bulkNoReadings: '' };
  const logIds: string[] = [];

  // η = 2 / 4 = 0.5, Q = 10 m³/h → estimate = 5 m³ per pump hour.
  const base = {
    tehsil: TEHSIL,
    village,
    settlement: '',
    pumpFlowRate: 10,
    ohrFillRequired: 2,
    timeToFill: 4,
  };

  async function addLog(
    systemId: string,
    date: string,
    start: string,
    hours: number,
    m: { start?: number; end?: number } = {},
    status = 'accepted',
  ) {
    const id = uuidv4();
    const endH = Number(start.slice(0, 2)) + hours;
    await ds.getRepository(WaterEnergyLoggingDaily).save(
      ds.getRepository(WaterEnergyLoggingDaily).create({
        id,
        waterSystemId: systemId,
        logDate: new Date(`${date}T00:00:00Z`),
        pumpStartTime: `${start}:00`,
        pumpEndTime: `${String(endH).padStart(2, '0')}:${start.slice(3)}:00`,
        pumpOperatingHours: hours,
        meterReadingStart: m.start ?? null,
        meterReadingEnd: m.end ?? null,
        totalWaterPumped:
          m.end != null && m.start != null ? m.end - m.start : null,
        status,
        signed: true,
      }),
    );
    logIds.push(id);
  }

  const period = () => resolveDashboardPeriod({ year: 2025, month: 3 });
  const rowFor = async (id: string) => {
    const { rows } = await dash.getWaterSystemsDetail(
      TEHSIL,
      village,
      period(),
    );
    return rows.find((r) => r.water_system_id === id) as Row | undefined;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDatabaseUrl();
    dbAvailable = await isPostgresReachable();
    if (!dbAvailable) return;
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    ds = moduleRef.get(DataSource);
    dash = moduleRef.get(DashboardService);
    meter = moduleRef.get(WaterMeterVolumeService);

    const repo = ds.getRepository(WaterSystem);
    for (const k of Object.keys(ids) as Array<keyof typeof ids>)
      ids[k] = uuidv4();
    await repo.save([
      // Bulk meter configured from 15 Mar 2025 10:00.
      repo.create({
        ...base,
        id: ids.cut,
        uniqueIdentifier: `INT-WS-CUT-${tag}`,
        bulkMeterInstalled: true,
        bulkMeterSinceDate: new Date('2025-03-15T00:00:00Z'),
        bulkMeterSinceTime: '10:00:00',
      }),
      // Bulk, no configured start → first meter reading decides.
      repo.create({
        ...base,
        id: ids.fallback,
        uniqueIdentifier: `INT-WS-FB-${tag}`,
        bulkMeterInstalled: true,
      }),
      // No bulk meter at all.
      repo.create({
        ...base,
        id: ids.ohr,
        uniqueIdentifier: `INT-WS-OHR-${tag}`,
        bulkMeterInstalled: false,
      }),
      // Bulk flag on but no readings and no start yet.
      repo.create({
        ...base,
        id: ids.bulkNoReadings,
        uniqueIdentifier: `INT-WS-BNR-${tag}`,
        bulkMeterInstalled: true,
      }),
    ]);

    // CUT site — before cutover: hourly (one carries a stray meter reading).
    await addLog(ids.cut, '2025-03-10', '06:00', 4);
    await addLog(ids.cut, '2025-03-12', '06:00', 2, { start: 900, end: 950 });
    await addLog(ids.cut, '2025-03-15', '06:00', 2); // cutover day, before 10:00
    // After cutover: meter.
    await addLog(ids.cut, '2025-03-15', '12:00', 3, { start: 1000, end: 1060 });
    await addLog(ids.cut, '2025-03-16', '08:00', 5, { start: 1060, end: 1160 });
    await addLog(ids.cut, '2025-03-17', '08:00', 2); // bulk era, no reading
    await addLog(
      ids.cut,
      '2025-03-18',
      '08:00',
      9,
      { start: 1160, end: 9999 },
      'rejected',
    );

    // FALLBACK site — first meter log 2025-03-05 07:00.
    await addLog(ids.fallback, '2025-03-01', '07:00', 2);
    await addLog(ids.fallback, '2025-03-05', '07:00', 4, {
      start: 50,
      end: 90,
    });

    // OHR site — always hourly; even a meter value is ignored.
    await addLog(ids.ohr, '2025-03-02', '07:00', 3, { start: 1, end: 500 });
    await addLog(ids.ohr, '2025-03-03', '07:00', 1);

    await addLog(ids.bulkNoReadings, '2025-03-04', '07:00', 6);
  }, 120_000);

  afterAll(async () => {
    if (!dbAvailable || !moduleRef) return;
    try {
      await ds
        .getRepository(WaterEnergyLoggingDaily)
        .delete({ id: In(logIds) });
      await ds
        .getRepository(WaterSystem)
        .delete({ id: In(Object.values(ids)) });
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

  it('configured cutover: meter after, estimate before, each log once', async () => {
    if (skip()) return;
    const r = (await rowFor(ids.cut))!;
    expect(r).toMatchObject({
      bulk_meter_installed: true,
      bulk_meter_since: '2025-03-15 10:00',
      bulk_meter_since_source: 'configured',
      volume_basis: 'mixed',
      // meter: 60 + 100 (rejected 8839 ignored)
      total_water_pumped_m3: 160,
      bulk_logs_count: 3,
      bulk_pump_hours_h: 10,
      bulk_days_logged: 3,
      unmetered_bulk_logs: 1,
      // hourly: 4 + 2 + 2 = 8 h × 5 → 40 (stray 50 m³ reading NOT added)
      estimated_water_m3: 40,
      hourly_logs_count: 3,
      hourly_pump_hours_h: 8,
      hourly_days_logged: 3,
      calculated_total_m3: 200,
      total_pump_hours_h: 18,
      days_logged: 5, // 15 Mar counted once
      logs_count: 6,
      latest_meter_reading_end_m3: 1160,
    });
    // Meter averages use meter-era hours/days only.
    expect(r.avg_m3_per_hour).toBe(16);
    expect(r.avg_m3_per_day_logged).toBeCloseTo(160 / 3);
    expect(r.estimated_avg_hourly_m3).toBe(5);
  });

  it('no configured start: first meter reading is the cutover', async () => {
    if (skip()) return;
    const r = (await rowFor(ids.fallback))!;
    expect(r).toMatchObject({
      bulk_meter_since: '2025-03-05 07:00',
      bulk_meter_since_source: 'first_meter_reading',
      total_water_pumped_m3: 40,
      estimated_water_m3: 10,
      calculated_total_m3: 50,
      volume_basis: 'mixed',
    });
  });

  it('site without bulk meter is purely hourly', async () => {
    if (skip()) return;
    const r = (await rowFor(ids.ohr))!;
    expect(r).toMatchObject({
      bulk_meter_since: null,
      volume_basis: 'estimated',
      total_water_pumped_m3: null,
      estimated_water_m3: 20,
      calculated_total_m3: 20,
      latest_meter_reading_end_m3: null,
    });
  });

  it('bulk flag with no readings and no start stays on the estimate', async () => {
    if (skip()) return;
    const r = (await rowFor(ids.bulkNoReadings))!;
    expect(r).toMatchObject({
      bulk_meter_installed: true,
      bulk_meter_since: null,
      volume_basis: 'estimated',
      estimated_water_m3: 30,
      total_water_pumped_m3: null,
    });
  });

  it('flags estimate-era logs whose η / flow inputs are missing', async () => {
    if (skip()) return;
    await ds
      .getRepository(WaterSystem)
      .update({ id: ids.fallback }, { timeToFill: null });
    try {
      const r = (await rowFor(ids.fallback))!;
      expect(r).toMatchObject({
        estimate_inputs_missing: true,
        estimated_water_m3: null,
        total_water_pumped_m3: 40,
        calculated_total_m3: 40,
      });
    } finally {
      await ds
        .getRepository(WaterSystem)
        .update({ id: ids.fallback }, { timeToFill: 4 });
    }
  });

  it('Command Center monthly series counts meter volume only after each cutover', async () => {
    if (skip()) return;
    const series = (await dash.getWaterSupplied(
      TEHSIL,
      village,
      period(),
    )) as Array<Row>;
    // CUT 160 + FALLBACK 40; CUT's pre-cutover 50 and OHR's 499 excluded.
    expect(series[0]).toMatchObject({ month: 3, total_water_pumped: 200 });
  });

  it('meter capture is required from the configured start, not before', async () => {
    if (skip()) return;
    const ask = (date: string, end: string) =>
      meter.logRequiresBulkMeterCapture({
        bulkMeterInstalled: true,
        waterSystemId: ids.cut,
        logDate: new Date(`${date}T00:00:00Z`),
        pumpEndTime: end,
        bulkMeterSinceDate: new Date('2025-03-15T00:00:00Z'),
        bulkMeterSinceTime: '10:00:00',
      });
    await expect(ask('2025-03-15', '09:00:00')).resolves.toBe(false);
    await expect(ask('2025-03-15', '11:00:00')).resolves.toBe(true);
    await expect(ask('2025-03-01', '23:00:00')).resolves.toBe(false);
  });
});
