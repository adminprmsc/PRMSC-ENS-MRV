import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import {
  METER_TYPE_TUBEWELL,
  SUBMISSION_STATUS_REJECTED,
} from '../../domain/constants/submission.constants';
import {
  getCalendarMonth,
  getCalendarYear,
  toIsoDateString,
} from '../../domain/utils/date.util';
import {
  DashboardPeriod,
  monthBucketsForPeriod,
  periodMeta,
} from '../../domain/utils/dashboard-period.util';
import { SolarEnergyLoggingMonthly } from '../../infrastructure/database/entities/solar-energy-logging-monthly.entity';
import { SolarSystem } from '../../infrastructure/database/entities/solar-system.entity';
import { SystemMeter } from '../../infrastructure/database/entities/system-meter.entity';
import { UserWaterSystem } from '../../infrastructure/database/entities/user-water-system.entity';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import {
  logSource,
  resolveCutoverKey,
  summarizeBySource,
  wallClockKey,
} from '../../domain/utils/water-source.util';
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
  >(
    items: T[],
    tehsil?: string,
    village?: string,
    settlement?: string,
    tehsilsCsv?: string,
  ): T[] {
    let result = items;
    const tehsilScope = this.resolveTehsilScope(tehsil, tehsilsCsv);
    if (tehsilScope?.length) {
      const allowed = new Set(tehsilScope);
      result = result.filter((i) => i.tehsil != null && allowed.has(i.tehsil));
    } else if (tehsil && tehsil !== 'All Tehsils') {
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

  /** Single tehsil, explicit multi-tehsil list (CSV), or undefined = all tehsils. */
  private resolveTehsilScope(
    tehsil?: string,
    tehsilsCsv?: string,
  ): string[] | undefined {
    const t = tehsil?.trim();
    if (t && t !== 'All Tehsils') return [t];
    const csv = tehsilsCsv?.trim();
    if (!csv) return undefined;
    return [
      ...new Set(
        csv
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
  }

  private applyTehsilScopeToQb<T extends object>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    tehsil?: string,
    tehsilsCsv?: string,
  ): void {
    const scope = this.resolveTehsilScope(tehsil, tehsilsCsv);
    if (scope?.length === 1) {
      qb.andWhere(`${alias}.tehsil = :_dashScopeTehsil`, {
        _dashScopeTehsil: scope[0],
      });
    } else if (scope && scope.length > 1) {
      qb.andWhere(`${alias}.tehsil IN (:..._dashScopeTehsils)`, {
        _dashScopeTehsils: scope,
      });
    }
  }

  private needsSystemJoinForScope(
    tehsil?: string,
    village?: string,
    tehsilsCsv?: string,
  ): boolean {
    const scope = this.resolveTehsilScope(tehsil, tehsilsCsv);
    return (
      (scope?.length ?? 0) > 0 || Boolean(village && village !== 'All Villages')
    );
  }

  private logNotRejectedQb(alias = 'log') {
    return `(${alias}.status IS NULL OR ${alias}.status != '${SUBMISSION_STATUS_REJECTED}')`;
  }

  /**
   * Restrict monthly solar logs to the period. A custom range includes every
   * month it touches; a legacy month-without-year matches that month in any year.
   */
  private applySolarPeriodToQb<T extends object>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    period: DashboardPeriod,
  ): void {
    if (period.ymStart != null && period.ymEnd != null) {
      qb.andWhere(
        `(${alias}.year * 100 + ${alias}.month) BETWEEN :_ymStart AND :_ymEnd`,
        { _ymStart: period.ymStart, _ymEnd: period.ymEnd },
      );
    } else if (period.month) {
      qb.andWhere(`${alias}.month = :_solarMonth`, {
        _solarMonth: period.month,
      });
    }
  }

  /** Restrict daily water logs to the period's day bounds. */
  private applyWaterPeriodToQb<T extends object>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    period: DashboardPeriod,
  ): void {
    if (period.start) {
      qb.andWhere(`${alias}.log_date >= :_periodStart`, {
        _periodStart: period.start,
      });
    }
    if (period.endExclusive) {
      qb.andWhere(`${alias}.log_date < :_periodEnd`, {
        _periodEnd: period.endExclusive,
      });
    }
  }

  /** Build a TypeORM `where` object for location filtering pushed to the DB. */
  private locationWhere(
    tehsil?: string,
    village?: string,
    settlement?: string,
  ): { tehsil?: string; village?: string; settlement?: string } | undefined {
    const where: { tehsil?: string; village?: string; settlement?: string } =
      {};
    if (tehsil && tehsil !== 'All Tehsils') where.tehsil = tehsil;
    if (village && village !== 'All Villages') where.village = village;
    if (settlement && settlement !== 'All Settlements')
      where.settlement = settlement;
    return Object.keys(where).length ? where : undefined;
  }

  async getProgramSummary(
    tehsil: string | undefined,
    village: string | undefined,
    period: DashboardPeriod,
    settlement?: string,
    tehsils?: string,
  ) {
    // Load systems then filter in-memory (same proven path as before).
    // Keep full entity rows — partial `select` previously omitted uniqueIdentifier
    // and crashed sort via `.localeCompare` on undefined.
    let waterSystems = await this.waterSystemRepo.find();
    let solarSystems = await this.solarSystemRepo.find();
    waterSystems = this.applyLocationFilters(
      waterSystems,
      tehsil,
      village,
      settlement,
      tehsils,
    );
    solarSystems = this.applyLocationFilters(
      solarSystems,
      tehsil,
      village,
      settlement,
      tehsils,
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

    const waterLogQb = this.waterLogRepo
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

    this.applyWaterPeriodToQb(waterLogQb, 'log', period);

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

    const solarLogQb = this.solarLogRepo
      .createQueryBuilder('log')
      .select('log.solar_system_id', 'system_id')
      .addSelect('COUNT(log.id)', 'logs_count')
      // Distinct calendar months (year-aware) so multi-year ranges count correctly.
      .addSelect('COUNT(DISTINCT log.year * 100 + log.month)', 'months_logged')
      .where('log.solar_system_id IN (:...ids)', {
        ids: solarIds.length ? solarIds : [''],
      })
      .groupBy('log.solar_system_id');
    this.applySolarPeriodToQb(solarLogQb, 'log', period);

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
      site_type: string | null;
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
          unique_identifier: ws.uniqueIdentifier ?? '',
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
          (a.unique_identifier || '').localeCompare(b.unique_identifier || '')
        );
      });

    const solarSystemsCoverage: SolarSystemCoverage[] = solarSystems
      .map((ss) => {
        const stats = solarStatsBySystem.get(String(ss.id));
        const logs = stats?.logs_count ?? 0;
        const life = solarLifetimeLast.get(String(ss.id));
        const siteType: string | null =
          (ss as { siteType?: string | null }).siteType ?? null;
        return {
          id: String(ss.id),
          unique_identifier: ss.uniqueIdentifier ?? '',
          tehsil: ss.tehsil || 'Unknown',
          village: ss.village || '—',
          settlement: ss.settlement ?? null,
          site_type: siteType,
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
          (a.unique_identifier || '').localeCompare(b.unique_identifier || '')
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
    tehsil: string | undefined,
    village: string | undefined,
    period: DashboardPeriod,
    tehsils?: string,
  ) {
    const { year, month } = period;
    let qb = this.waterLogRepo
      .createQueryBuilder('log')
      .where(this.logNotRejectedQb('log'));

    if (this.needsSystemJoinForScope(tehsil, village, tehsils)) {
      qb = qb.innerJoin(WaterSystem, 'ws', 'ws.id = log.water_system_id');
      this.applyTehsilScopeToQb(qb, 'ws', tehsil, tehsils);
      if (village && village !== 'All Villages') {
        qb = qb.andWhere('ws.village = :village', { village });
      }
    }

    // Only bound the end: earlier logs are the baseline for meter intervals.
    if (period.endExclusive) {
      qb = qb.andWhere('log.log_date < :end', { end: period.endExclusive });
    }

    const logs = await qb.getMany();
    const cutovers = await this.bulkCutovers(logs);

    if (period.isRange) {
      const monthlyTotals = this.aggregateMonthlyTotals(
        logs,
        cutovers,
        period.start,
      );
      return monthBucketsForPeriod(period).map((b) => ({
        year: b.year,
        month: b.month,
        total_water_pumped: monthlyTotals.get(`${b.year}-${b.month}`) ?? 0,
      }));
    }

    const monthlyTotals = this.aggregateMonthlyTotals(logs, cutovers);

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

  /**
   * Sum interval volumes per calendar month. When `countFrom` is set, logs
   * before that day still seed meter baselines but are not counted.
   */
  /** Bulk cutover key per site that appears in `logs` (null = never bulk). */
  private async bulkCutovers(
    logs: WaterEnergyLoggingDaily[],
  ): Promise<Map<string, string | null>> {
    const ids = [...new Set(logs.map((l) => String(l.waterSystemId)))];
    const out = new Map<string, string | null>();
    if (!ids.length) return out;
    const [systems, earliest] = await Promise.all([
      this.waterSystemRepo.find({
        where: { id: In(ids) },
        select: {
          id: true,
          bulkMeterInstalled: true,
          bulkMeterSinceDate: true,
          bulkMeterSinceTime: true,
        },
      }),
      this.waterMeterVolume.earliestMeterLogKeys(ids),
    ]);
    for (const ws of systems) {
      const sid = String(ws.id);
      out.set(
        sid,
        resolveCutoverKey({
          bulkMeterInstalled: Boolean(ws.bulkMeterInstalled),
          bulkMeterSinceDate: ws.bulkMeterSinceDate,
          bulkMeterSinceTime: ws.bulkMeterSinceTime,
          earliestMeterLogKey: earliest.get(sid) ?? null,
        }),
      );
    }
    return out;
  }

  private aggregateMonthlyTotals(
    logs: WaterEnergyLoggingDaily[],
    cutovers: Map<string, string | null>,
    countFrom?: string | null,
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
    for (const [sid, systemLogs] of bySystem) {
      const volumes = this.waterMeterVolume.computeIntervalVolumes(systemLogs);
      const cutover = cutovers.get(sid) ?? null;
      for (const log of systemLogs) {
        // Meter volume counts only from the site's bulk cutover onward.
        if (logSource(log, cutover) !== 'bulk') continue;
        const vol = volumes[String(log.id)];
        if (vol != null && log.logDate) {
          if (countFrom) {
            const day = toIsoDateString(log.logDate);
            if (!day || day < countFrom) continue;
          }
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
    tehsil: string | undefined,
    village: string | undefined,
    period: DashboardPeriod,
    tehsils?: string,
  ) {
    let qb = this.waterLogRepo
      .createQueryBuilder('log')
      .select('EXTRACT(YEAR FROM log.log_date)', 'year')
      .addSelect('EXTRACT(MONTH FROM log.log_date)', 'month')
      .addSelect('SUM(COALESCE(log.pump_operating_hours, 0))', 'total')
      .where(this.logNotRejectedQb('log'))
      .groupBy('EXTRACT(YEAR FROM log.log_date)')
      .addGroupBy('EXTRACT(MONTH FROM log.log_date)');

    if (this.needsSystemJoinForScope(tehsil, village, tehsils)) {
      qb = qb.innerJoin(WaterSystem, 'ws', 'ws.id = log.water_system_id');
      this.applyTehsilScopeToQb(qb, 'ws', tehsil, tehsils);
      if (village && village !== 'All Villages') {
        qb = qb.andWhere('ws.village = :village', { village });
      }
    }

    if (period.start || period.endExclusive) {
      this.applyWaterPeriodToQb(qb, 'log', period);
    } else if (period.month) {
      qb = qb.andWhere('EXTRACT(MONTH FROM log.log_date) = :month', {
        month: period.month,
      });
    }

    const results = await qb.getRawMany<{
      year: string;
      month: string;
      total: string;
    }>();

    if (period.isRange) {
      const byYm = new Map<string, number>();
      for (const r of results) {
        byYm.set(
          `${parseInt(r.year, 10)}-${parseInt(r.month, 10)}`,
          parseFloat(r.total || '0'),
        );
      }
      return monthBucketsForPeriod(period).map((b) => ({
        year: b.year,
        month: b.month,
        pump_operating_hours: byYm.get(`${b.year}-${b.month}`) ?? 0,
      }));
    }

    // Year / month / all-time: fold into 12 month-of-year slots.
    const dataDict = new Map<number, number>();
    for (const r of results) {
      const m = parseInt(r.month, 10);
      dataDict.set(m, (dataDict.get(m) ?? 0) + parseFloat(r.total || '0'));
    }
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      pump_operating_hours: dataDict.get(i + 1) ?? 0,
    }));
  }

  /**
   * Calendar years that actually have logged data in scope — drives every
   * year filter so users only see years they can pick something from.
   */
  async getDataYears(tehsil?: string, tehsils?: string) {
    const scoped = this.needsSystemJoinForScope(tehsil, undefined, tehsils);

    let wq = this.waterLogRepo
      .createQueryBuilder('log')
      .select('DISTINCT EXTRACT(YEAR FROM log.log_date)::int', 'year')
      .where('log.log_date IS NOT NULL');
    if (scoped) {
      wq = wq.innerJoin(WaterSystem, 'ws', 'ws.id = log.water_system_id');
      this.applyTehsilScopeToQb(wq, 'ws', tehsil, tehsils);
    }

    let sq = this.solarLogRepo
      .createQueryBuilder('log')
      .select('DISTINCT log.year', 'year')
      .where('log.year IS NOT NULL');
    if (scoped) {
      sq = sq.innerJoin(SolarSystem, 'ss', 'ss.id = log.solar_system_id');
      this.applyTehsilScopeToQb(sq, 'ss', tehsil, tehsils);
    }

    const [w, so] = await Promise.all([
      wq.getRawMany<{ year: number | string }>(),
      sq.getRawMany<{ year: number | string }>(),
    ]);
    const clean = (rows: Array<{ year: number | string }>) =>
      [...new Set(rows.map((r) => Number(r.year)))]
        .filter((y) => Number.isInteger(y) && y >= 2000 && y <= 2100)
        .sort((a, b) => b - a);
    const water = clean(w);
    const solar = clean(so);
    return {
      years: [...new Set([...water, ...solar])].sort((a, b) => b - a),
      water_years: water,
      solar_years: solar,
    };
  }

  async getSolarGeneration(
    tehsil: string | undefined,
    village: string | undefined,
    period: DashboardPeriod,
    tehsils?: string,
  ) {
    return this.aggregateSolarMonthly(
      tehsil,
      village,
      period,
      'export',
      'solar_generation_kwh',
      tehsils,
    );
  }

  async getGridImport(
    tehsil: string | undefined,
    village: string | undefined,
    period: DashboardPeriod,
    tehsils?: string,
  ) {
    return this.aggregateSolarMonthly(
      tehsil,
      village,
      period,
      'import',
      'grid_import_kwh',
      tehsils,
    );
  }

  private async aggregateSolarMonthly(
    tehsil: string | undefined,
    village: string | undefined,
    period: DashboardPeriod,
    field: 'export' | 'import' = 'export',
    label = 'total',
    tehsils?: string,
  ) {
    const offPeak =
      field === 'export' ? 'log.export_off_peak' : 'log.import_off_peak';
    const peak = field === 'export' ? 'log.export_peak' : 'log.import_peak';

    let qb = this.solarLogRepo
      .createQueryBuilder('log')
      .select('log.year', 'year')
      .addSelect('log.month', 'month')
      .addSelect(`SUM(COALESCE(${offPeak}, 0) + COALESCE(${peak}, 0))`, 'total')
      // Green-meter logs only: pre-green months have no export and their
      // consumption is a baseline, reported separately (pre_green_* fields).
      .where('log.meter_phase = :_greenPhase', { _greenPhase: 'green' })
      .groupBy('log.year')
      .addGroupBy('log.month');

    if (this.needsSystemJoinForScope(tehsil, village, tehsils)) {
      qb = qb.innerJoin(SolarSystem, 'ss', 'ss.id = log.solar_system_id');
      this.applyTehsilScopeToQb(qb, 'ss', tehsil, tehsils);
      if (village && village !== 'All Villages') {
        qb = qb.andWhere('ss.village = :village', { village });
      }
    }
    this.applySolarPeriodToQb(qb, 'log', period);

    const results = await qb.getRawMany<{
      year: number;
      month: number;
      total: string;
    }>();

    if (period.isRange) {
      const byYm = new Map<string, number>();
      for (const r of results) {
        byYm.set(
          `${Number(r.year)}-${Number(r.month)}`,
          parseFloat(r.total || '0'),
        );
      }
      return monthBucketsForPeriod(period).map((b) => ({
        year: b.year,
        month: b.month,
        [label]: byYm.get(`${b.year}-${b.month}`) ?? 0,
      }));
    }

    const dataDict = new Map<number, number>();
    for (const r of results) {
      const m = Number(r.month);
      dataDict.set(m, (dataDict.get(m) ?? 0) + parseFloat(r.total || '0'));
    }
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      [label]: dataDict.get(i + 1) ?? 0,
    }));
  }

  async getWaterSystemsDetail(
    tehsil: string | undefined,
    village: string | undefined,
    period: DashboardPeriod,
    settlement?: string,
    tehsils?: string,
  ) {
    const rangeStart = period.start;
    const rangeEndExclusive = period.endExclusive;
    const fetchEndExclusive = rangeEndExclusive;

    let systemsQb = this.waterSystemRepo
      .createQueryBuilder('ws')
      .orderBy('ws.tehsil', 'ASC')
      .addOrderBy('ws.village', 'ASC')
      .addOrderBy('ws.uniqueIdentifier', 'ASC');
    this.applyTehsilScopeToQb(systemsQb, 'ws', tehsil, tehsils);
    if (village && village !== 'All Villages') {
      systemsQb = systemsQb.andWhere('ws.village = :village', { village });
    }
    if (settlement && settlement !== 'All Settlements') {
      systemsQb = systemsQb.andWhere('ws.settlement = :settlement', {
        settlement,
      });
    }
    const systems = await systemsQb.getMany();

    if (!systems.length) {
      return { rows: [], meta: periodMeta(period) };
    }

    const systemIds = systems.map((s) => s.id);
    let logsQb = this.waterLogRepo
      .createQueryBuilder('log')
      .where('log.water_system_id IN (:...ids)', { ids: systemIds })
      .andWhere(this.logNotRejectedQb('log'));

    if (rangeStart) {
      logsQb = logsQb.andWhere('log.log_date >= :start', {
        start: rangeStart,
      });
    }
    if (fetchEndExclusive) {
      logsQb = logsQb.andWhere('log.log_date < :end', {
        end: fetchEndExclusive,
      });
    }
    const allLogs = await logsQb.getMany();

    // Fallback bulk cutover per site = earliest submitted metered log.
    const earliestMeter =
      await this.waterMeterVolume.earliestMeterLogKeys(systemIds);
    const logsBySystem = new Map<string, WaterEnergyLoggingDaily[]>();
    for (const log of allLogs) {
      const sid = String(log.waterSystemId);
      const list = logsBySystem.get(sid) ?? [];
      list.push(log);
      logsBySystem.set(sid, list);
    }

    const rows = [];
    for (const system of systems) {
      const sid = String(system.id);
      const systemLogs = logsBySystem.get(sid) ?? [];
      if (!systemLogs.length) continue;

      const bulkMeter = Boolean(system.bulkMeterInstalled);
      const configuredCutover = wallClockKey(
        system.bulkMeterSinceDate,
        system.bulkMeterSinceTime,
      );
      const cutoverKey = resolveCutoverKey({
        bulkMeterInstalled: bulkMeter,
        bulkMeterSinceDate: system.bulkMeterSinceDate,
        bulkMeterSinceTime: system.bulkMeterSinceTime,
        earliestMeterLogKey: earliestMeter.get(sid) ?? null,
      });

      // Estimated water = η × Q × t, with η = design fill time / actual fill time.
      const designFill = Number(system.ohrFillRequired);
      const actualFill = Number(system.timeToFill);
      const flow = Number(system.pumpFlowRate);
      const efficiency =
        designFill > 0 && actualFill > 0 ? designFill / actualFill : null;
      const flowRate = flow > 0 ? flow : null;

      // One source per log: meter at/after the cutover, estimate before it.
      const src = summarizeBySource(systemLogs, {
        cutoverKey,
        intervalVolumes:
          this.waterMeterVolume.computeIntervalVolumes(systemLogs),
        efficiency,
        flowRate,
      });
      // Snapshot from metered bulk-era logs only (an unmetered log there
      // must not blank the latest reading).
      const bulkEraLogs = systemLogs.filter(
        (l) => logSource(l, cutoverKey) === 'bulk' && l.meterReadingEnd != null,
      );
      const meter = bulkEraLogs.length
        ? (this.waterMeterVolume.aggregateSystemMeterSnapshotsInRange(
            bulkEraLogs,
            { startDate: rangeStart, endDateExclusive: rangeEndExclusive },
          )[sid] ?? null)
        : null;

      const meterM3 = src.bulk.logs > 0 ? src.bulk.m3 : null;
      const estimatedM3 = src.hourly.logs > 0 ? src.hourly.m3 : null;
      const calculatedTotalM3 =
        meterM3 == null && estimatedM3 == null
          ? null
          : (meterM3 ?? 0) + (estimatedM3 ?? 0);
      const volumeBasis =
        src.bulk.logs > 0 && src.hourly.logs > 0
          ? 'mixed'
          : src.bulk.logs > 0
            ? 'bulk_meter'
            : 'estimated';

      rows.push({
        water_system_id: system.id,
        unique_identifier: system.uniqueIdentifier,
        tehsil: system.tehsil,
        village: system.village,
        settlement: system.settlement,
        /** Site start of operation (YYYY-MM-DD). */
        start_of_operation: system.startOfOperation
          ? system.startOfOperation.toISOString().slice(0, 10)
          : null,
        bulk_meter_installed: bulkMeter,
        /** "YYYY-MM-DD HH:MM" from which only meter readings count. */
        bulk_meter_since: cutoverKey ? cutoverKey.slice(0, 16) : null,
        bulk_meter_since_source: !cutoverKey
          ? null
          : configuredCutover
            ? 'configured'
            : 'first_meter_reading',
        /** Metered volume of logs at/after the cutover. */
        total_water_pumped_m3: meterM3,
        latest_meter_reading_end_m3: meter?.latest_meter_reading_end ?? null,
        period_meter_net_m3: meter?.period_meter_net_m3 ?? null,
        total_pump_hours_h: src.hours,
        days_logged: src.days,
        logs_count: src.logs,
        bulk_pump_hours_h: src.bulk.hours,
        bulk_days_logged: src.bulk.days,
        bulk_logs_count: src.bulk.logs,
        /** Bulk-era logs with no meter reading — no volume counted. */
        unmetered_bulk_logs: src.bulk.unmeteredLogs,
        hourly_pump_hours_h: src.hourly.hours,
        hourly_days_logged: src.hourly.days,
        hourly_logs_count: src.hourly.logs,
        // Meter averages use meter-era hours/days only.
        avg_m3_per_hour:
          meterM3 != null && src.bulk.hours > 0
            ? meterM3 / src.bulk.hours
            : null,
        avg_m3_per_day_logged:
          meterM3 != null && src.bulk.days > 0 ? meterM3 / src.bulk.days : null,
        avg_hours_per_day_logged: src.days > 0 ? src.hours / src.days : null,
        pumping_efficiency: efficiency,
        /** η × Q × hours for logs before the cutover (or all, if no meter). */
        estimated_water_m3: estimatedM3,
        /** Estimate-era logs exist but η or flow rate is missing. */
        estimate_inputs_missing: src.hourly.logs > 0 && estimatedM3 == null,
        estimated_avg_daily_m3:
          estimatedM3 != null && src.hourly.days > 0
            ? estimatedM3 / src.hourly.days
            : null,
        estimated_avg_hourly_m3:
          estimatedM3 != null && src.hourly.hours > 0
            ? estimatedM3 / src.hourly.hours
            : null,
        calculated_total_m3: calculatedTotalM3,
        calculated_avg_daily_m3:
          calculatedTotalM3 != null && src.days > 0
            ? calculatedTotalM3 / src.days
            : null,
        calculated_avg_hourly_m3:
          calculatedTotalM3 != null && src.hours > 0
            ? calculatedTotalM3 / src.hours
            : null,
        volume_basis: volumeBasis,
      });
    }

    return { rows, meta: periodMeta(period) };
  }

  async getSolarSystemsDetail(
    tehsil: string | undefined,
    village: string | undefined,
    period: DashboardPeriod,
    settlement?: string,
    tehsils?: string,
  ) {
    let qb = this.solarLogRepo
      .createQueryBuilder('log')
      .innerJoin(SolarSystem, 'ss', 'ss.id = log.solar_system_id')
      .select('ss.id', 'solar_system_id')
      .addSelect('ss.unique_identifier', 'unique_identifier')
      .addSelect('ss.tehsil', 'tehsil')
      .addSelect('ss.village', 'village')
      .addSelect('ss.settlement', 'settlement')
      .addSelect('ss.site_type', 'site_type')
      .addSelect('ss.disco_info', 'disco_info')
      .addSelect('ss.bill_reference_number', 'bill_reference_number')
      // Text form avoids the pg driver turning `date` into a local-midnight Date.
      .addSelect(
        "TO_CHAR(ss.solar_connection_date, 'YYYY-MM-DD')",
        'solar_connection_date',
      )
      .addSelect(
        `SUM(CASE WHEN log.meter_phase = 'green' THEN COALESCE(log.export_off_peak, 0) + COALESCE(log.export_peak, 0) ELSE 0 END)`,
        'total_export_kwh',
      )
      .addSelect(
        `SUM(CASE WHEN log.meter_phase = 'green' THEN COALESCE(log.export_off_peak, 0) ELSE 0 END)`,
        'total_export_off_peak_kwh',
      )
      .addSelect(
        `SUM(CASE WHEN log.meter_phase = 'green' THEN COALESCE(log.export_peak, 0) ELSE 0 END)`,
        'total_export_peak_kwh',
      )
      .addSelect(
        `SUM(CASE WHEN log.meter_phase = 'green' THEN COALESCE(log.import_off_peak, 0) + COALESCE(log.import_peak, 0) ELSE 0 END)`,
        'total_import_kwh',
      )
      .addSelect(
        `SUM(CASE WHEN log.meter_phase = 'green' THEN COALESCE(log.import_off_peak, 0) ELSE 0 END)`,
        'total_import_off_peak_kwh',
      )
      .addSelect(
        `SUM(CASE WHEN log.meter_phase = 'green' THEN COALESCE(log.import_peak, 0) ELSE 0 END)`,
        'total_import_peak_kwh',
      )
      .addSelect(
        `SUM(CASE WHEN log.meter_phase = 'green' THEN COALESCE(log.net_off_peak, 0) + COALESCE(log.net_peak, 0) ELSE 0 END)`,
        'total_net_kwh',
      )
      .addSelect(
        `SUM(CASE WHEN log.meter_phase = 'green' THEN COALESCE(log.net_off_peak, 0) ELSE 0 END)`,
        'total_net_off_peak_kwh',
      )
      .addSelect(
        `SUM(CASE WHEN log.meter_phase = 'green' THEN COALESCE(log.net_peak, 0) ELSE 0 END)`,
        'total_net_peak_kwh',
      )
      // Before green meter: units consumed only (stored in import_*).
      .addSelect(
        `SUM(CASE WHEN log.meter_phase = 'pre_green' THEN COALESCE(log.import_off_peak, 0) + COALESCE(log.import_peak, 0) ELSE 0 END)`,
        'pre_green_consumed_kwh',
      )
      .addSelect(
        `SUM(CASE WHEN log.meter_phase = 'pre_green' THEN COALESCE(log.import_off_peak, 0) ELSE 0 END)`,
        'pre_green_consumed_off_peak_kwh',
      )
      .addSelect(
        `SUM(CASE WHEN log.meter_phase = 'pre_green' THEN COALESCE(log.import_peak, 0) ELSE 0 END)`,
        'pre_green_consumed_peak_kwh',
      )
      // tou_required is not a DB column — derive from peak fields (green logs)
      .addSelect(
        `BOOL_OR(
          log.meter_phase = 'green' AND (
            log.export_peak IS NOT NULL
            OR log.import_peak IS NOT NULL
            OR log.net_peak IS NOT NULL
          )
        )`,
        'any_tou_required',
      )
      // Distinct calendar months (year-aware) so multi-year ranges average correctly.
      .addSelect(
        `COUNT(DISTINCT CASE WHEN log.meter_phase = 'green' THEN log.year * 100 + log.month END)`,
        'months_logged',
      )
      .addSelect(
        `COUNT(DISTINCT CASE WHEN log.meter_phase = 'pre_green' THEN log.year * 100 + log.month END)`,
        'pre_green_months_logged',
      )
      .addSelect('COUNT(log.id)', 'records_count')
      .addSelect(
        "TO_CHAR(ss.green_meter_connection_date, 'YYYY-MM-DD')",
        'green_meter_connection_date',
      )
      .groupBy('ss.id')
      .addGroupBy('ss.unique_identifier')
      .addGroupBy('ss.tehsil')
      .addGroupBy('ss.village')
      .addGroupBy('ss.settlement')
      .addGroupBy('ss.site_type')
      .addGroupBy('ss.disco_info')
      .addGroupBy('ss.bill_reference_number')
      .addGroupBy('ss.solar_connection_date')
      .addGroupBy('ss.green_meter_connection_date')
      .orderBy('ss.tehsil')
      .addOrderBy('ss.village')
      .addOrderBy('ss.unique_identifier');

    this.applyTehsilScopeToQb(qb, 'ss', tehsil, tehsils);
    if (village && village !== 'All Villages') {
      qb = qb.andWhere('ss.village = :village', { village });
    }
    if (settlement && settlement !== 'All Settlements') {
      qb = qb.andWhere('ss.settlement = :settlement', { settlement });
    }
    this.applySolarPeriodToQb(qb, 'log', period);

    const results = await qb.getRawMany<Record<string, unknown>>();
    const rows = results.map((r) => {
      const str = (v: unknown): string => {
        if (v == null) return '0';
        if (typeof v === 'string') return v;
        if (typeof v === 'number' || typeof v === 'boolean') return `${v}`;
        return '0';
      };
      const expKwh = parseFloat(str(r.total_export_kwh));
      const expOffPeak = parseFloat(str(r.total_export_off_peak_kwh));
      const expPeak = parseFloat(str(r.total_export_peak_kwh));
      const impKwh = parseFloat(str(r.total_import_kwh));
      const impOffPeak = parseFloat(str(r.total_import_off_peak_kwh));
      const impPeak = parseFloat(str(r.total_import_peak_kwh));
      const netTotal = parseFloat(str(r.total_net_kwh));
      const netOffPeak = parseFloat(str(r.total_net_off_peak_kwh));
      const netPeak = parseFloat(str(r.total_net_peak_kwh));
      const mLogged = parseInt(str(r.months_logged), 10);
      const preMonths = parseInt(str(r.pre_green_months_logged), 10);
      const preTotal = parseFloat(str(r.pre_green_consumed_kwh));
      const preAvg = preMonths > 0 ? preTotal / preMonths : null;
      const recs = parseInt(str(r.records_count), 10);
      const touRaw = r.any_tou_required;
      const anyTou =
        touRaw === true ||
        touRaw === 'true' ||
        touRaw === 't' ||
        touRaw === 1 ||
        touRaw === '1';
      return {
        solar_system_id: r.solar_system_id,
        unique_identifier: r.unique_identifier,
        tehsil: r.tehsil,
        village: r.village,
        settlement: r.settlement,
        site_type: (r.site_type as string | null) ?? null,
        disco_info: r.disco_info,
        bill_reference_number: r.bill_reference_number,
        solar_connection_date:
          (r.solar_connection_date as string | null) ?? null,
        total_export_kwh: expKwh,
        total_export_off_peak_kwh: expOffPeak,
        total_export_peak_kwh: expPeak,
        total_import_kwh: impKwh,
        total_import_off_peak_kwh: impOffPeak,
        total_import_peak_kwh: impPeak,
        total_net_kwh: netTotal,
        total_net_off_peak_kwh: netOffPeak,
        total_net_peak_kwh: netPeak,
        any_tou_required: anyTou,
        months_logged: mLogged,
        records_count: recs,
        avg_export_kwh_per_month: mLogged > 0 ? expKwh / mLogged : null,
        avg_import_kwh_per_month: mLogged > 0 ? impKwh / mLogged : null,
        avg_net_kwh_per_month: mLogged > 0 ? netTotal / mLogged : null,
        green_meter_connection_date:
          (r.green_meter_connection_date as string | null) ?? null,
        // Before-green-meter baseline (units consumed, nothing exported).
        pre_green_months_logged: preMonths,
        pre_green_consumed_kwh: preTotal,
        pre_green_consumed_peak_kwh: parseFloat(
          str(r.pre_green_consumed_peak_kwh),
        ),
        pre_green_consumed_off_peak_kwh: parseFloat(
          str(r.pre_green_consumed_off_peak_kwh),
        ),
        avg_pre_green_consumed_kwh_per_month: preAvg,
        // % drop in monthly grid draw after the green meter vs the baseline.
        grid_draw_change_pct:
          preAvg && preAvg > 0 && mLogged > 0
            ? ((impKwh / mLogged - preAvg) / preAvg) * 100
            : null,
      };
    });

    return { rows, meta: periodMeta(period) };
  }
}
