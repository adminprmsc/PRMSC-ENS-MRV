import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  METER_TYPE_TUBEWELL,
  SUBMISSION_STATUS_REJECTED,
} from '../../domain/constants/submission.constants';
import {
  getCalendarMonth,
  getCalendarYear,
} from '../../domain/utils/date.util';
import { SolarEnergyLoggingMonthly } from '../../infrastructure/database/entities/solar-energy-logging-monthly.entity';
import { SolarSystem } from '../../infrastructure/database/entities/solar-system.entity';
import { SystemMeter } from '../../infrastructure/database/entities/system-meter.entity';
import { UserWaterSystem } from '../../infrastructure/database/entities/user-water-system.entity';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { WaterMeterVolumeService } from './water-meter-volume.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(WaterSystem)
    private readonly waterSystemRepo: Repository<WaterSystem>,
    @InjectRepository(SolarSystem)
    private readonly solarSystemRepo: Repository<SolarSystem>,
    @InjectRepository(SystemMeter)
    private readonly systemMeterRepo: Repository<SystemMeter>,
    @InjectRepository(WaterEnergyLoggingDaily)
    private readonly waterLogRepo: Repository<WaterEnergyLoggingDaily>,
    @InjectRepository(SolarEnergyLoggingMonthly)
    private readonly solarLogRepo: Repository<SolarEnergyLoggingMonthly>,
    @InjectRepository(UserWaterSystem)
    private readonly userWaterSystemRepo: Repository<UserWaterSystem>,
    private readonly waterMeterVolume: WaterMeterVolumeService,
  ) {}

  private applyLocationFilters<
    T extends { tehsil?: string; village?: string; settlement?: string | null },
  >(items: T[], tehsil?: string, village?: string, settlement?: string): T[] {
    let result = items;
    if (tehsil && tehsil !== 'All Tehsils') {
      result = result.filter((i) => i.tehsil === tehsil);
    }
    if (village && village !== 'All Villages') {
      result = result.filter((i) => i.village === village);
    }
    if (settlement && settlement !== 'All Settlements') {
      result = result.filter((i) => (i.settlement ?? '') === settlement);
    }
    return result;
  }

  private logNotRejectedQb(alias = 'log') {
    return `(${alias}.status IS NULL OR ${alias}.status != '${SUBMISSION_STATUS_REJECTED}')`;
  }

  async getProgramSummary(
    tehsil?: string,
    village?: string,
    month?: number,
    year?: number,
    settlement?: string,
  ) {
    let waterSystems = await this.waterSystemRepo.find();
    let solarSystems = await this.solarSystemRepo.find();
    waterSystems = this.applyLocationFilters(
      waterSystems,
      tehsil,
      village,
      settlement,
    );
    solarSystems = this.applyLocationFilters(
      solarSystems,
      tehsil,
      village,
      settlement,
    );

    const ohrCount = waterSystems.length;
    const solarFacilities = solarSystems.length;

    const waterIds = waterSystems.map((ws) => String(ws.id));
    const solarIds = solarSystems.map((ss) => String(ss.id));

    const bulkMeters = await this.systemMeterRepo
      .createQueryBuilder('m')
      .where('m.meter_type = :type', { type: METER_TYPE_TUBEWELL })
      .andWhere('m.is_active = true')
      .andWhere('m.water_system_id IN (:...ids)', {
        ids: waterIds.length ? waterIds : [''],
      })
      .getCount();

    let waterLogQb = this.waterLogRepo
      .createQueryBuilder('log')
      .select('log.water_system_id', 'system_id')
      .addSelect('COUNT(log.id)', 'logs_count')
      .addSelect('COUNT(DISTINCT log.log_date)', 'days_logged')
      .addSelect('MAX(log.log_date)', 'last_log_date')
      .where(this.logNotRejectedQb('log'))
      .andWhere('log.water_system_id IN (:...ids)', {
        ids: waterIds.length ? waterIds : [''],
      })
      .groupBy('log.water_system_id');

    let fetchEndExclusive: string | null = null;
    let fetchStart: string | null = null;
    if (year && month) {
      fetchStart = `${year}-${String(month).padStart(2, '0')}-01`;
      fetchEndExclusive =
        month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    } else if (year) {
      fetchStart = `${year}-01-01`;
      fetchEndExclusive = `${year + 1}-01-01`;
    }
    if (fetchStart) {
      waterLogQb = waterLogQb.andWhere('log.log_date >= :start', {
        start: fetchStart,
      });
    }
    if (fetchEndExclusive) {
      waterLogQb = waterLogQb.andWhere('log.log_date < :end', {
        end: fetchEndExclusive,
      });
    }

    const waterLogRows = waterIds.length
      ? await waterLogQb.getRawMany<{
          system_id: string;
          logs_count: string;
          days_logged: string;
          last_log_date: string | Date | null;
        }>()
      : [];
    const waterStatsBySystem = new Map(
      waterLogRows.map((r) => [
        String(r.system_id),
        {
          logs_count: parseInt(r.logs_count || '0', 10) || 0,
          days_logged: parseInt(r.days_logged || '0', 10) || 0,
          last_log_date: r.last_log_date
            ? String(r.last_log_date).slice(0, 10)
            : null,
        },
      ]),
    );

    let solarLogQb = this.solarLogRepo
      .createQueryBuilder('log')
      .select('log.solar_system_id', 'system_id')
      .addSelect('COUNT(log.id)', 'logs_count')
      .addSelect('COUNT(DISTINCT log.month)', 'months_logged')
      .where('log.solar_system_id IN (:...ids)', {
        ids: solarIds.length ? solarIds : [''],
      })
      .groupBy('log.solar_system_id');
    if (year) {
      solarLogQb = solarLogQb.andWhere('log.year = :year', { year });
    }
    if (month) {
      solarLogQb = solarLogQb.andWhere('log.month = :month', { month });
    }

    const solarLogRows = solarIds.length
      ? await solarLogQb.getRawMany<{
          system_id: string;
          logs_count: string;
          months_logged: string;
        }>()
      : [];
    const solarStatsBySystem = new Map(
      solarLogRows.map((r) => [
        String(r.system_id),
        {
          logs_count: parseInt(r.logs_count || '0', 10) || 0,
          months_logged: parseInt(r.months_logged || '0', 10) || 0,
        },
      ]),
    );

    // Lifetime last water log (any period) for actionable "Last log received"
    const waterLifetimeRows = waterIds.length
      ? await this.waterLogRepo
          .createQueryBuilder('log')
          .select('log.water_system_id', 'system_id')
          .addSelect('MAX(log.log_date)', 'last_log_date')
          .where(this.logNotRejectedQb('log'))
          .andWhere('log.water_system_id IN (:...ids)', { ids: waterIds })
          .groupBy('log.water_system_id')
          .getRawMany<{
            system_id: string;
            last_log_date: string | Date | null;
          }>()
      : [];
    const waterLifetimeLast = new Map(
      waterLifetimeRows.map((r) => [
        String(r.system_id),
        r.last_log_date ? String(r.last_log_date).slice(0, 10) : null,
      ]),
    );

    // Lifetime last solar month (any year)
    const solarLifetimeRows = solarIds.length
      ? await this.solarLogRepo
          .createQueryBuilder('log')
          .select('log.solar_system_id', 'system_id')
          .addSelect('MAX(log.year * 100 + log.month)', 'last_ym')
          .where('log.solar_system_id IN (:...ids)', { ids: solarIds })
          .groupBy('log.solar_system_id')
          .getRawMany<{ system_id: string; last_ym: string | null }>()
      : [];
    const solarLifetimeLast = new Map(
      solarLifetimeRows.map((r) => {
        const ym = parseInt(String(r.last_ym || '0'), 10) || 0;
        return [
          String(r.system_id),
          {
            last_year: ym > 0 ? Math.floor(ym / 100) : null,
            last_month: ym > 0 ? ym % 100 : null,
          },
        ] as const;
      }),
    );

    const operatorsByWaterId = new Map<
      string,
      { id: string; name: string; email: string; phone: string | null }[]
    >();
    for (const id of waterIds) operatorsByWaterId.set(id, []);
    if (waterIds.length) {
      const opRows = await this.userWaterSystemRepo
        .createQueryBuilder('uws')
        .innerJoinAndSelect('uws.user', 'user')
        .where('uws.water_system_id IN (:...ids)', { ids: waterIds })
        .orderBy('user.name', 'ASC')
        .getMany();
      for (const row of opRows) {
        const wid = String(row.waterSystemId);
        const list = operatorsByWaterId.get(wid) ?? [];
        if (row.user) {
          list.push({
            id: String(row.user.id),
            name: row.user.name,
            email: row.user.email,
            phone: row.user.phone || null,
          });
        }
        operatorsByWaterId.set(wid, list);
      }
    }

    type AssignedOperator = {
      id: string;
      name: string;
      email: string;
      phone: string | null;
    };
    type WaterSystemCoverage = {
      id: string;
      unique_identifier: string;
      tehsil: string;
      village: string;
      settlement: string | null;
      bulk_meter_installed: boolean;
      logs_count: number;
      days_logged: number;
      last_log_date: string | null;
      lifetime_last_log_date: string | null;
      logged: boolean;
      assigned_operators: AssignedOperator[];
    };
    type SolarSystemCoverage = {
      id: string;
      unique_identifier: string;
      tehsil: string;
      village: string;
      settlement: string | null;
      logs_count: number;
      months_logged: number;
      lifetime_last_log_year: number | null;
      lifetime_last_log_month: number | null;
      logged: boolean;
    };

    const waterSystemsCoverage: WaterSystemCoverage[] = waterSystems
      .map((ws) => {
        const stats = waterStatsBySystem.get(String(ws.id));
        const logs = stats?.logs_count ?? 0;
        return {
          id: String(ws.id),
          unique_identifier: ws.uniqueIdentifier,
          tehsil: ws.tehsil || 'Unknown',
          village: ws.village || '—',
          settlement: ws.settlement ?? null,
          bulk_meter_installed: Boolean(ws.bulkMeterInstalled),
          logs_count: logs,
          days_logged: stats?.days_logged ?? 0,
          last_log_date: stats?.last_log_date ?? null,
          lifetime_last_log_date: waterLifetimeLast.get(String(ws.id)) ?? null,
          logged: logs > 0,
          assigned_operators: operatorsByWaterId.get(String(ws.id)) ?? [],
        };
      })
      .sort((a, b) => {
        if (a.logged !== b.logged) return a.logged ? 1 : -1;
        return (
          a.tehsil.localeCompare(b.tehsil) ||
          a.village.localeCompare(b.village) ||
          a.unique_identifier.localeCompare(b.unique_identifier)
        );
      });

    const solarSystemsCoverage: SolarSystemCoverage[] = solarSystems
      .map((ss) => {
        const stats = solarStatsBySystem.get(String(ss.id));
        const logs = stats?.logs_count ?? 0;
        const life = solarLifetimeLast.get(String(ss.id));
        return {
          id: String(ss.id),
          unique_identifier: ss.uniqueIdentifier,
          tehsil: ss.tehsil || 'Unknown',
          village: ss.village || '—',
          settlement: ss.settlement ?? null,
          logs_count: logs,
          months_logged: stats?.months_logged ?? 0,
          lifetime_last_log_year: life?.last_year ?? null,
          lifetime_last_log_month: life?.last_month ?? null,
          logged: logs > 0,
        };
      })
      .sort((a, b) => {
        if (a.logged !== b.logged) return a.logged ? 1 : -1;
        return (
          a.tehsil.localeCompare(b.tehsil) ||
          a.village.localeCompare(b.village) ||
          a.unique_identifier.localeCompare(b.unique_identifier)
        );
      });

    let waterLogsCount = 0;
    let waterSitesLogged = 0;
    for (const row of waterSystemsCoverage) {
      waterLogsCount += row.logs_count;
      if (row.logged) waterSitesLogged += 1;
    }

    let solarLogsCount = 0;
    let solarSitesLogged = 0;
    for (const row of solarSystemsCoverage) {
      solarLogsCount += row.logs_count;
      if (row.logged) solarSitesLogged += 1;
    }

    type TehsilAgg = {
      tehsil: string;
      water_sites: number;
      solar_sites: number;
      water_logs: number;
      solar_logs: number;
      water_sites_logged: number;
      solar_sites_logged: number;
    };
    const byTehsilMap = new Map<string, TehsilAgg>();

    const ensureTehsil = (name: string): TehsilAgg => {
      const key = name || 'Unknown';
      let row = byTehsilMap.get(key);
      if (!row) {
        row = {
          tehsil: key,
          water_sites: 0,
          solar_sites: 0,
          water_logs: 0,
          solar_logs: 0,
          water_sites_logged: 0,
          solar_sites_logged: 0,
        };
        byTehsilMap.set(key, row);
      }
      return row;
    };

    for (const ws of waterSystemsCoverage) {
      const row = ensureTehsil(ws.tehsil);
      row.water_sites += 1;
      row.water_logs += ws.logs_count;
      if (ws.logged) row.water_sites_logged += 1;
    }
    for (const ss of solarSystemsCoverage) {
      const row = ensureTehsil(ss.tehsil);
      row.solar_sites += 1;
      row.solar_logs += ss.logs_count;
      if (ss.logged) row.solar_sites_logged += 1;
    }

    const byTehsil = [...byTehsilMap.values()].sort((a, b) =>
      a.tehsil.localeCompare(b.tehsil),
    );

    return {
      ohr_count: ohrCount,
      solar_facilities: solarFacilities,
      bulk_meters: bulkMeters,
      water_logs_count: waterLogsCount,
      solar_logs_count: solarLogsCount,
      water_sites_logged: waterSitesLogged,
      solar_sites_logged: solarSitesLogged,
      by_tehsil: byTehsil,
      water_systems: waterSystemsCoverage,
      solar_systems: solarSystemsCoverage,
    };
  }

  async getWaterSupplied(
    tehsil?: string,
    village?: string,
    month?: number,
    year?: number,
  ) {
    let qb = this.waterLogRepo
      .createQueryBuilder('log')
      .where(this.logNotRejectedQb('log'));

    if (
      (tehsil && tehsil !== 'All Tehsils') ||
      (village && village !== 'All Villages')
    ) {
      qb = qb.innerJoin(WaterSystem, 'ws', 'ws.id = log.water_system_id');
      if (tehsil && tehsil !== 'All Tehsils') {
        qb = qb.andWhere('ws.tehsil = :tehsil', { tehsil });
      }
      if (village && village !== 'All Villages') {
        qb = qb.andWhere('ws.village = :village', { village });
      }
    }

    let fetchEndExclusive: string | null = null;
    if (year && month) {
      fetchEndExclusive =
        month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    } else if (year) {
      fetchEndExclusive = `${year + 1}-01-01`;
    }

    if (fetchEndExclusive) {
      qb = qb.andWhere('log.log_date < :end', { end: fetchEndExclusive });
    }

    const logs = await qb.getMany();
    const monthlyTotals = this.aggregateMonthlyTotals(logs);

    if (year && month) {
      return [
        {
          month,
          total_water_pumped: monthlyTotals.get(`${year}-${month}`) ?? 0,
        },
      ];
    }
    if (year) {
      return Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        total_water_pumped: monthlyTotals.get(`${year}-${i + 1}`) ?? 0,
      }));
    }
    if (month) {
      let total = 0;
      for (const [key, v] of monthlyTotals) {
        const [, m] = key.split('-').map(Number);
        if (m === month) {
          total += v;
        }
      }
      return [{ month, total_water_pumped: total }];
    }

    const byMonth = new Map<number, number>();
    for (const [key, v] of monthlyTotals) {
      const [, m] = key.split('-').map(Number);
      byMonth.set(m, (byMonth.get(m) ?? 0) + v);
    }
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      total_water_pumped: byMonth.get(i + 1) ?? 0,
    }));
  }

  private aggregateMonthlyTotals(
    logs: WaterEnergyLoggingDaily[],
  ): Map<string, number> {
    const bySystem = new Map<string, WaterEnergyLoggingDaily[]>();
    for (const log of logs) {
      const sid = String(log.waterSystemId);
      if (!bySystem.has(sid)) {
        bySystem.set(sid, []);
      }
      bySystem.get(sid)!.push(log);
    }

    const monthly = new Map<string, number>();
    for (const systemLogs of bySystem.values()) {
      const volumes = this.waterMeterVolume.computeIntervalVolumes(systemLogs);
      for (const log of systemLogs) {
        const vol = volumes[String(log.id)];
        if (vol != null && log.logDate) {
          const y = getCalendarYear(log.logDate);
          const m = getCalendarMonth(log.logDate);
          if (y == null || m == null) {
            continue;
          }
          const key = `${y}-${m}`;
          monthly.set(key, (monthly.get(key) ?? 0) + vol);
        }
      }
    }
    return monthly;
  }

  async getPumpHours(
    tehsil?: string,
    village?: string,
    month?: number,
    year?: number,
  ) {
    let qb = this.waterLogRepo
      .createQueryBuilder('log')
      .select('EXTRACT(MONTH FROM log.log_date)', 'month')
      .addSelect('SUM(COALESCE(log.pump_operating_hours, 0))', 'total')
      .where(this.logNotRejectedQb('log'))
      .groupBy('EXTRACT(MONTH FROM log.log_date)')
      .orderBy('month');

    if (
      (tehsil && tehsil !== 'All Tehsils') ||
      (village && village !== 'All Villages')
    ) {
      qb = qb.innerJoin(WaterSystem, 'ws', 'ws.id = log.water_system_id');
      if (tehsil && tehsil !== 'All Tehsils') {
        qb = qb.andWhere('ws.tehsil = :tehsil', { tehsil });
      }
      if (village && village !== 'All Villages') {
        qb = qb.andWhere('ws.village = :village', { village });
      }
    }

    if (year && month) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end =
        month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      qb = qb.andWhere('log.log_date >= :start AND log.log_date < :end', {
        start,
        end,
      });
    } else if (year) {
      qb = qb
        .andWhere('log.log_date >= :start', { start: `${year}-01-01` })
        .andWhere('log.log_date < :end', { end: `${year + 1}-01-01` });
    } else if (month) {
      qb = qb.andWhere('EXTRACT(MONTH FROM log.log_date) = :month', { month });
    }

    const results = await qb.getRawMany<{ month: string; total: string }>();
    const dataDict = new Map<number, number>();
    for (const r of results) {
      dataDict.set(parseInt(r.month, 10), parseFloat(r.total || '0'));
    }
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      pump_operating_hours: dataDict.get(i + 1) ?? 0,
    }));
  }

  async getSolarGeneration(
    tehsil?: string,
    village?: string,
    month?: number,
    year?: number,
  ) {
    return this.aggregateSolarMonthly(
      tehsil,
      village,
      month,
      year,
      'export',
      'solar_generation_kwh',
    );
  }

  async getGridImport(
    tehsil?: string,
    village?: string,
    month?: number,
    year?: number,
  ) {
    return this.aggregateSolarMonthly(
      tehsil,
      village,
      month,
      year,
      'import',
      'grid_import_kwh',
    );
  }

  private async aggregateSolarMonthly(
    tehsil?: string,
    village?: string,
    month?: number,
    year?: number,
    field: 'export' | 'import' = 'export',
    label = 'total',
  ) {
    const offPeak =
      field === 'export' ? 'log.export_off_peak' : 'log.import_off_peak';
    const peak = field === 'export' ? 'log.export_peak' : 'log.import_peak';

    let qb = this.solarLogRepo
      .createQueryBuilder('log')
      .select('log.month', 'month')
      .addSelect(`SUM(COALESCE(${offPeak}, 0) + COALESCE(${peak}, 0))`, 'total')
      .groupBy('log.month')
      .orderBy('log.month');

    if (
      (tehsil && tehsil !== 'All Tehsils') ||
      (village && village !== 'All Villages')
    ) {
      qb = qb.innerJoin(SolarSystem, 'ss', 'ss.id = log.solar_system_id');
      if (tehsil && tehsil !== 'All Tehsils') {
        qb = qb.andWhere('ss.tehsil = :tehsil', { tehsil });
      }
      if (village && village !== 'All Villages') {
        qb = qb.andWhere('ss.village = :village', { village });
      }
    }
    if (month) {
      qb = qb.andWhere('log.month = :month', { month });
    }
    if (year) {
      qb = qb.andWhere('log.year = :year', { year });
    }

    const results = await qb.getRawMany<{ month: number; total: string }>();
    const dataDict = new Map<number, number>();
    for (const r of results) {
      dataDict.set(Number(r.month), parseFloat(r.total || '0'));
    }
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      [label]: dataDict.get(i + 1) ?? 0,
    }));
  }

  async getWaterSystemsDetail(
    tehsil?: string,
    village?: string,
    month?: number,
    year?: number,
    settlement?: string,
  ) {
    let rangeStart: string | null = null;
    let rangeEndExclusive: string | null = null;
    let fetchEndExclusive: string | null = null;

    if (year && month) {
      rangeStart = `${year}-${String(month).padStart(2, '0')}-01`;
      rangeEndExclusive =
        month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      fetchEndExclusive = rangeEndExclusive;
    } else if (year) {
      rangeStart = `${year}-01-01`;
      rangeEndExclusive = `${year + 1}-01-01`;
      fetchEndExclusive = rangeEndExclusive;
    }

    let systems = await this.waterSystemRepo.find({
      order: { tehsil: 'ASC', village: 'ASC', uniqueIdentifier: 'ASC' },
    });
    systems = this.applyLocationFilters(systems, tehsil, village, settlement);

    if (!systems.length) {
      return { rows: [], meta: { month, year } };
    }

    const systemIds = systems.map((s) => s.id);
    let logsQb = this.waterLogRepo
      .createQueryBuilder('log')
      .where('log.water_system_id IN (:...ids)', { ids: systemIds })
      .andWhere(this.logNotRejectedQb('log'));

    if (fetchEndExclusive) {
      logsQb = logsQb.andWhere('log.log_date < :end', {
        end: fetchEndExclusive,
      });
    }
    const allLogs = await logsQb.getMany();

    const waterBySystem =
      this.waterMeterVolume.aggregateSystemEffectiveVolumesInRange(allLogs, {
        startDate: rangeStart,
        endDateExclusive: rangeEndExclusive,
      });
    const meterBySystem =
      this.waterMeterVolume.aggregateSystemMeterSnapshotsInRange(allLogs, {
        startDate: rangeStart,
        endDateExclusive: rangeEndExclusive,
      });

    const hoursQb = this.waterLogRepo
      .createQueryBuilder('log')
      .select('log.water_system_id', 'water_system_id')
      .addSelect(
        'SUM(COALESCE(log.pump_operating_hours, 0))',
        'total_pump_hours',
      )
      .addSelect('COUNT(DISTINCT log.log_date)', 'days_logged')
      .addSelect('COUNT(log.id)', 'logs_count')
      .where('log.water_system_id IN (:...ids)', { ids: systemIds })
      .andWhere(this.logNotRejectedQb('log'))
      .groupBy('log.water_system_id');

    if (rangeStart) {
      hoursQb.andWhere('log.log_date >= :start', { start: rangeStart });
    }
    if (rangeEndExclusive) {
      hoursQb.andWhere('log.log_date < :end', { end: rangeEndExclusive });
    }

    const hoursRows = await hoursQb.getRawMany<{
      water_system_id: string;
      total_pump_hours: string;
      days_logged: string;
      logs_count: string;
    }>();
    const hoursBySystem = new Map(
      hoursRows.map((r) => [String(r.water_system_id), r]),
    );

    const rows = [];
    for (const system of systems) {
      const sid = String(system.id);
      const water = waterBySystem[sid] ?? 0;
      const meter = meterBySystem[sid] ?? {
        latest_meter_reading_end: null,
        period_meter_net_m3: null,
      };
      const stats = hoursBySystem.get(sid);
      const hours = stats ? parseFloat(stats.total_pump_hours || '0') : 0;
      const dLogged = stats ? parseInt(stats.days_logged || '0', 10) : 0;
      const lCount = stats ? parseInt(stats.logs_count || '0', 10) : 0;
      if (lCount === 0) {
        continue;
      }
      rows.push({
        water_system_id: system.id,
        unique_identifier: system.uniqueIdentifier,
        tehsil: system.tehsil,
        village: system.village,
        settlement: system.settlement,
        bulk_meter_installed: Boolean(system.bulkMeterInstalled),
        total_water_pumped_m3: water,
        latest_meter_reading_end_m3: meter.latest_meter_reading_end,
        period_meter_net_m3: meter.period_meter_net_m3,
        total_pump_hours_h: hours,
        days_logged: dLogged,
        logs_count: lCount,
        avg_m3_per_hour: hours > 0 ? water / hours : null,
        avg_m3_per_day_logged: dLogged > 0 ? water / dLogged : null,
        avg_hours_per_day_logged: dLogged > 0 ? hours / dLogged : null,
      });
    }

    return { rows, meta: { month, year } };
  }

  async getSolarSystemsDetail(
    tehsil?: string,
    village?: string,
    month?: number,
    year?: number,
    settlement?: string,
  ) {
    let qb = this.solarLogRepo
      .createQueryBuilder('log')
      .innerJoin(SolarSystem, 'ss', 'ss.id = log.solar_system_id')
      .select('ss.id', 'solar_system_id')
      .addSelect('ss.unique_identifier', 'unique_identifier')
      .addSelect('ss.tehsil', 'tehsil')
      .addSelect('ss.village', 'village')
      .addSelect('ss.settlement', 'settlement')
      .addSelect('ss.disco_info', 'disco_info')
      .addSelect('ss.bill_reference_number', 'bill_reference_number')
      .addSelect(
        'SUM(COALESCE(log.export_off_peak, 0) + COALESCE(log.export_peak, 0))',
        'total_export_kwh',
      )
      .addSelect(
        'SUM(COALESCE(log.import_off_peak, 0) + COALESCE(log.import_peak, 0))',
        'total_import_kwh',
      )
      .addSelect(
        'SUM(COALESCE(log.net_off_peak, 0) + COALESCE(log.net_peak, 0))',
        'total_net_kwh',
      )
      .addSelect('COUNT(DISTINCT log.month)', 'months_logged')
      .addSelect('COUNT(log.id)', 'records_count')
      .groupBy('ss.id')
      .addGroupBy('ss.unique_identifier')
      .addGroupBy('ss.tehsil')
      .addGroupBy('ss.village')
      .addGroupBy('ss.settlement')
      .addGroupBy('ss.disco_info')
      .addGroupBy('ss.bill_reference_number')
      .orderBy('ss.tehsil')
      .addOrderBy('ss.village')
      .addOrderBy('ss.unique_identifier');

    if (tehsil && tehsil !== 'All Tehsils') {
      qb = qb.andWhere('ss.tehsil = :tehsil', { tehsil });
    }
    if (village && village !== 'All Villages') {
      qb = qb.andWhere('ss.village = :village', { village });
    }
    if (settlement && settlement !== 'All Settlements') {
      qb = qb.andWhere('ss.settlement = :settlement', { settlement });
    }
    if (month) {
      qb = qb.andWhere('log.month = :month', { month });
    }
    if (year) {
      qb = qb.andWhere('log.year = :year', { year });
    }

    const results = await qb.getRawMany<Record<string, string>>();
    const rows = results.map((r) => {
      const expKwh = parseFloat(r.total_export_kwh || '0');
      const impKwh = parseFloat(r.total_import_kwh || '0');
      const netTotal = parseFloat(r.total_net_kwh || '0');
      const mLogged = parseInt(r.months_logged || '0', 10);
      const recs = parseInt(r.records_count || '0', 10);
      return {
        solar_system_id: r.solar_system_id,
        unique_identifier: r.unique_identifier,
        tehsil: r.tehsil,
        village: r.village,
        settlement: r.settlement,
        disco_info: r.disco_info,
        bill_reference_number: r.bill_reference_number,
        total_export_kwh: expKwh,
        total_import_kwh: impKwh,
        total_net_kwh: netTotal,
        months_logged: mLogged,
        records_count: recs,
        avg_export_kwh_per_month: mLogged > 0 ? expKwh / mLogged : null,
        avg_import_kwh_per_month: mLogged > 0 ? impKwh / mLogged : null,
        avg_net_kwh_per_month: mLogged > 0 ? netTotal / mLogged : null,
      };
    });

    return { rows, meta: { month, year } };
  }
}
