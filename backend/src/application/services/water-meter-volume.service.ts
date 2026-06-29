import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SUBMISSION_STATUS_ACCEPTED,
  SUBMISSION_STATUS_REVERTED_BACK,
  SUBMISSION_STATUS_SUBMITTED,
} from '../../domain/constants/submission.constants';
import {
  getCalendarMonth,
  getCalendarYear,
} from '../../domain/utils/date.util';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';

export class MeterReadingOrderError extends Error {
  readonly code = 'meter_reading_order';
  readonly endVal: number;
  readonly baseVal: number;

  constructor(endVal: number, baseVal: number) {
    super(
      `Meter reading at pump stop (${endVal} m³) must be greater than the previous ` +
        `submitted reading (${baseVal} m³) for this water system.`,
    );
    this.name = 'MeterReadingOrderError';
    this.endVal = endVal;
    this.baseVal = baseVal;
  }
}

@Injectable()
export class WaterMeterVolumeService {
  constructor(
    @InjectRepository(WaterEnergyLoggingDaily)
    private readonly waterLogRepo: Repository<WaterEnergyLoggingDaily>,
  ) {}

  private dateToMs(value: Date | string | null | undefined): number {
    if (value == null) {
      return 0;
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  waterLogSortKey(
    record: WaterEnergyLoggingDaily,
  ): [number, string, string, number, string] {
    const logD = this.dateToMs(record.logDate);
    const endT = record.pumpEndTime ?? '00:00:00';
    const startT = record.pumpStartTime ?? '00:00:00';
    const created = this.dateToMs(record.createdAt);
    return [logD, endT, startT, created, String(record.id)];
  }

  sortWaterLogs(logs: WaterEnergyLoggingDaily[]): WaterEnergyLoggingDaily[] {
    return [...logs].sort((a, b) => {
      const ak = this.waterLogSortKey(a);
      const bk = this.waterLogSortKey(b);
      for (let i = 0; i < ak.length; i++) {
        if (ak[i] < bk[i]) return -1;
        if (ak[i] > bk[i]) return 1;
      }
      return 0;
    });
  }

  private readingEndValue(record: WaterEnergyLoggingDaily): number | null {
    if (record.meterReadingEnd != null) {
      return Number(record.meterReadingEnd);
    }
    if (record.totalWaterPumped != null) {
      return Number(record.totalWaterPumped);
    }
    return null;
  }

  intervalVolumeFromLog(
    record: WaterEnergyLoggingDaily,
    previousEnd: number | null,
  ): [number | null, number | null] {
    if (record.meterReadingEnd != null) {
      const endVal = Number(record.meterReadingEnd);
      if (record.meterReadingStart != null) {
        const delta = endVal - Number(record.meterReadingStart);
        return [delta > 0 ? delta : null, endVal];
      }
      if (previousEnd != null) {
        const delta = endVal - previousEnd;
        return [delta > 0 ? delta : null, endVal];
      }
      if (record.totalWaterPumped != null) {
        return [Number(record.totalWaterPumped), endVal];
      }
      return [null, endVal];
    }

    if (record.totalWaterPumped == null) {
      return [null, previousEnd];
    }
    const cumulative = Number(record.totalWaterPumped);
    if (previousEnd == null) {
      return [null, cumulative];
    }
    const delta = cumulative - previousEnd;
    return [delta > 0 ? delta : null, cumulative];
  }

  computeIntervalVolumes(
    logs: WaterEnergyLoggingDaily[],
  ): Record<string, number> {
    const volumes: Record<string, number> = {};
    let prevEnd: number | null = null;
    for (const record of this.sortWaterLogs(logs)) {
      const [vol, newPrev] = this.intervalVolumeFromLog(record, prevEnd);
      prevEnd = newPrev;
      if (vol != null) {
        volumes[String(record.id)] = vol;
      }
    }
    return volumes;
  }

  sumEffectivePumpedM3(logs: WaterEnergyLoggingDaily[]): number {
    return Object.values(this.computeIntervalVolumes(logs)).reduce(
      (a, b) => a + b,
      0,
    );
  }

  async getLatestSubmittedMeterReadingEnd(
    waterSystemId: string,
    excludeRecordIdOrOptions?: string | { excludeRecordId?: string | null },
  ): Promise<number | null> {
    const excludeRecordId =
      typeof excludeRecordIdOrOptions === 'string'
        ? excludeRecordIdOrOptions
        : excludeRecordIdOrOptions?.excludeRecordId;
    const qb = this.waterLogRepo
      .createQueryBuilder('log')
      .where('log.water_system_id = :waterSystemId', { waterSystemId })
      .andWhere('(log.status IS NULL OR log.status IN (:...statuses))', {
        statuses: [
          SUBMISSION_STATUS_SUBMITTED,
          SUBMISSION_STATUS_ACCEPTED,
          SUBMISSION_STATUS_REVERTED_BACK,
        ],
      })
      .andWhere('log.meter_reading_end IS NOT NULL');

    if (excludeRecordId) {
      qb.andWhere('log.id != :excludeId', { excludeId: excludeRecordId });
    }

    const rows = await qb.getMany();
    const values = rows
      .map((r) =>
        r.meterReadingEnd != null ? Number(r.meterReadingEnd) : null,
      )
      .filter((v): v is number => v != null);
    return values.length ? Math.max(...values) : null;
  }

  async countMeterChainLogs(
    waterSystemId: string,
    excludeRecordId?: string | null,
  ): Promise<number> {
    const qb = this.waterLogRepo
      .createQueryBuilder('log')
      .where('log.water_system_id = :waterSystemId', { waterSystemId })
      .andWhere('(log.status IS NULL OR log.status IN (:...statuses))', {
        statuses: [
          SUBMISSION_STATUS_SUBMITTED,
          SUBMISSION_STATUS_ACCEPTED,
          SUBMISSION_STATUS_REVERTED_BACK,
        ],
      });
    if (excludeRecordId) {
      qb.andWhere('log.id != :excludeId', { excludeId: excludeRecordId });
    }
    return qb.getCount();
  }

  async resolveBulkMeterVolumes(options: {
    waterSystemId: string;
    logDate: Date;
    pumpEndTime: string;
    meterReadingEnd?: number | null;
    meterReadingStart?: number | null;
    legacyTotalWaterPumped?: number | null;
    excludeRecordId?: string | null;
  }): Promise<{
    meter_reading_start: number;
    meter_reading_end: number;
    total_water_pumped: number;
  }> {
    let endReading = options.meterReadingEnd;
    if (endReading == null && options.legacyTotalWaterPumped != null) {
      endReading = options.legacyTotalWaterPumped;
    }
    if (endReading == null) {
      throw new Error(
        'meter_reading_end is required (cumulative bulk-meter reading at pump stop)',
      );
    }

    const prevEnd = await this.getLatestSubmittedMeterReadingEnd(
      options.waterSystemId,
      {
        excludeRecordId: options.excludeRecordId,
      },
    );

    let base: number;
    let storedStart: number;
    if (prevEnd == null) {
      if (options.meterReadingStart == null) {
        throw new Error(
          'meter_reading_start is required for the first bulk-meter log on this system',
        );
      }
      base = Number(options.meterReadingStart);
      storedStart = base;
    } else {
      base = prevEnd;
      storedStart =
        options.meterReadingStart != null
          ? Number(options.meterReadingStart)
          : base;
    }

    const endVal = Number(endReading);
    if (endVal <= base) {
      throw new MeterReadingOrderError(endVal, base);
    }

    return {
      meter_reading_start: storedStart,
      meter_reading_end: endVal,
      total_water_pumped: endVal - base,
    };
  }

  async applyBulkMeterFields(options: {
    record: WaterEnergyLoggingDaily;
    waterSystemId: string;
    noBulkMeterInstalled: boolean;
    meterReadingEnd?: number | null;
    meterReadingStart?: number | null;
    legacyTotalWaterPumped?: number | null;
    excludeRecordId?: string | null;
  }): Promise<void> {
    const { record } = options;
    if (options.noBulkMeterInstalled) {
      record.meterReadingStart = null;
      record.meterReadingEnd = null;
      record.totalWaterPumped = null;
      return;
    }
    if (!record.logDate || !record.pumpEndTime) {
      throw new Error(
        'log_date and pump_end_time are required to compute meter volume',
      );
    }
    const resolved = await this.resolveBulkMeterVolumes({
      waterSystemId: options.waterSystemId,
      logDate: record.logDate,
      pumpEndTime: record.pumpEndTime,
      meterReadingEnd: options.meterReadingEnd,
      meterReadingStart: options.meterReadingStart,
      legacyTotalWaterPumped: options.legacyTotalWaterPumped,
      excludeRecordId: options.excludeRecordId,
    });
    record.meterReadingStart = resolved.meter_reading_start;
    record.meterReadingEnd = resolved.meter_reading_end;
    record.totalWaterPumped = resolved.total_water_pumped;
  }

  aggregateMonthlyEffectiveVolumes(
    logs: WaterEnergyLoggingDaily[],
  ): Record<string, number> {
    const bySystem = new Map<string, WaterEnergyLoggingDaily[]>();
    for (const log of logs) {
      const sid = String(log.waterSystemId);
      if (!bySystem.has(sid)) {
        bySystem.set(sid, []);
      }
      bySystem.get(sid)!.push(log);
    }

    const monthly: Record<string, number> = {};
    for (const systemLogs of bySystem.values()) {
      const volumes = this.computeIntervalVolumes(systemLogs);
      for (const log of systemLogs) {
        const vol = volumes[String(log.id)];
        if (vol != null && log.logDate) {
          const year = getCalendarYear(log.logDate);
          const month = getCalendarMonth(log.logDate);
          if (year == null || month == null) {
            continue;
          }
          const key = `${year}-${month}`;
          monthly[key] = (monthly[key] ?? 0) + vol;
        }
      }
    }
    return monthly;
  }

  aggregateSystemEffectiveVolumesInRange(
    logs: WaterEnergyLoggingDaily[],
    options?: { startDate?: string | null; endDateExclusive?: string | null },
  ): Record<string, number> {
    const bySystem = new Map<string, WaterEnergyLoggingDaily[]>();
    for (const log of logs) {
      const sid = String(log.waterSystemId);
      if (!bySystem.has(sid)) {
        bySystem.set(sid, []);
      }
      bySystem.get(sid)!.push(log);
    }

    const totals: Record<string, number> = {};
    for (const [sid, systemLogs] of bySystem) {
      const volumes = this.computeIntervalVolumes(systemLogs);
      let total = 0;
      for (const log of systemLogs) {
        if (!this.logInDateRange(log, options)) {
          continue;
        }
        const vol = volumes[String(log.id)];
        if (vol != null) {
          total += vol;
        }
      }
      totals[sid] = total;
    }
    return totals;
  }

  aggregateSystemMeterSnapshotsInRange(
    logs: WaterEnergyLoggingDaily[],
    options?: { startDate?: string | null; endDateExclusive?: string | null },
  ): Record<
    string,
    {
      latest_meter_reading_end: number | null;
      period_meter_net_m3: number | null;
    }
  > {
    const bySystem = new Map<string, WaterEnergyLoggingDaily[]>();
    for (const log of logs) {
      const sid = String(log.waterSystemId);
      if (!bySystem.has(sid)) {
        bySystem.set(sid, []);
      }
      bySystem.get(sid)!.push(log);
    }

    const snapshots: Record<
      string,
      {
        latest_meter_reading_end: number | null;
        period_meter_net_m3: number | null;
      }
    > = {};

    for (const [sid, systemLogs] of bySystem) {
      const inRange = this.sortWaterLogs(systemLogs).filter((log) =>
        this.logInDateRange(log, options),
      );
      if (!inRange.length) {
        snapshots[sid] = {
          latest_meter_reading_end: null,
          period_meter_net_m3: null,
        };
        continue;
      }
      const firstLog = inRange[0];
      const lastLog = inRange[inRange.length - 1];
      const latestEnd = this.readingEndValue(lastLog);

      let firstBaseline: number | null = null;
      if (firstLog.meterReadingStart != null) {
        firstBaseline = Number(firstLog.meterReadingStart);
      } else if (firstLog.meterReadingEnd != null) {
        firstBaseline = Number(firstLog.meterReadingEnd);
      }

      let periodNet: number | null = null;
      if (
        latestEnd != null &&
        firstBaseline != null &&
        latestEnd > firstBaseline
      ) {
        periodNet = latestEnd - firstBaseline;
      }

      snapshots[sid] = {
        latest_meter_reading_end: latestEnd,
        period_meter_net_m3: periodNet,
      };
    }
    return snapshots;
  }

  private logInDateRange(
    log: WaterEnergyLoggingDaily,
    options?: {
      startDate?: Date | string | null;
      endDateExclusive?: Date | string | null;
    },
  ): boolean {
    if (!log.logDate) {
      return false;
    }
    const logTime = log.logDate.getTime();
    if (options?.startDate) {
      const start =
        options.startDate instanceof Date
          ? options.startDate.getTime()
          : new Date(options.startDate).getTime();
      if (logTime < start) {
        return false;
      }
    }
    if (options?.endDateExclusive) {
      const end =
        options.endDateExclusive instanceof Date
          ? options.endDateExclusive.getTime()
          : new Date(options.endDateExclusive).getTime();
      if (logTime >= end) {
        return false;
      }
    }
    return true;
  }
}
