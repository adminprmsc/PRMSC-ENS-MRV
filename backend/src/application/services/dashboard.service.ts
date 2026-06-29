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
    private readonly waterMeterVolume: WaterMeterVolumeService,
  ) {}

  private applyLocationFilters<T extends { tehsil?: string; village?: string }>(
    items: T[],
    tehsil?: string,
    village?: string,
  ): T[] {
    let result = items;
    if (tehsil && tehsil !== 'All Tehsils') {
      result = result.filter((i) => i.tehsil === tehsil);
    }
    if (village && village !== 'All Villages') {
      result = result.filter((i) => i.village === village);
    }
    return result;
  }

  private logNotRejectedQb(alias = 'log') {
    return `(${alias}.status IS NULL OR ${alias}.status != '${SUBMISSION_STATUS_REJECTED}')`;
  }

  async getProgramSummary(tehsil?: string, village?: string) {
    let waterSystems = await this.waterSystemRepo.find();
    let solarSystems = await this.solarSystemRepo.find();
    waterSystems = this.applyLocationFilters(waterSystems, tehsil, village);
    solarSystems = this.applyLocationFilters(solarSystems, tehsil, village);

    const ohrCount = waterSystems.length;
    const solarFacilities = solarSystems.length;

    const waterIds = new Set(waterSystems.map((ws) => ws.id));
    const bulkMeters = await this.systemMeterRepo
      .createQueryBuilder('m')
      .where('m.meter_type = :type', { type: METER_TYPE_TUBEWELL })
      .andWhere('m.is_active = true')
      .andWhere('m.water_system_id IN (:...ids)', {
        ids: [...waterIds].length ? [...waterIds] : [''],
      })
      .getCount();

    return {
      ohr_count: ohrCount,
      solar_facilities: solarFacilities,
      bulk_meters: bulkMeters,
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
    systems = this.applyLocationFilters(systems, tehsil, village);

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
