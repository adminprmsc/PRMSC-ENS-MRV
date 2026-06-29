import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SUBMISSION_STATUS_REJECTED } from '../../domain/constants/submission.constants';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { WaterMeterVolumeService } from './water-meter-volume.service';

export interface MeterCorrection {
  logId: string;
  waterSystemId: string;
  logDate: string | null;
  oldMeterReadingStart: number | null;
  oldMeterReadingEnd: number | null;
  oldTotalWaterPumped: number | null;
  newMeterReadingStart: number | null;
  newMeterReadingEnd: number | null;
  newTotalWaterPumped: number | null;
  note: string;
}

export interface MeterCorrectionIssue {
  logId: string;
  waterSystemId: string;
  logDate: string | null;
  message: string;
}

@Injectable()
export class WaterMeterBackfillService {
  constructor(
    @InjectRepository(WaterSystem)
    private readonly waterSystemRepo: Repository<WaterSystem>,
    @InjectRepository(WaterEnergyLoggingDaily)
    private readonly waterLogRepo: Repository<WaterEnergyLoggingDaily>,
    private readonly waterMeterVolume: WaterMeterVolumeService,
  ) {}

  private isRejected(log: WaterEnergyLoggingDaily): boolean {
    return log.status === SUBMISSION_STATUS_REJECTED;
  }

  private floatOrNone(value: number | null | undefined): number | null {
    if (value == null) {
      return null;
    }
    return Number(value);
  }

  private valuesDiffer(
    a: number | null | undefined,
    b: number | null | undefined,
    epsilon = 1e-6,
  ): boolean {
    if (a == null && b == null) {
      return false;
    }
    if (a == null || b == null) {
      return true;
    }
    return Math.abs(Number(a) - Number(b)) > epsilon;
  }

  private cumulativeStopReading(log: WaterEnergyLoggingDaily): number | null {
    if (log.meterReadingEnd != null) {
      return Number(log.meterReadingEnd);
    }
    if (log.meterReadingStart != null && log.totalWaterPumped != null) {
      return Number(log.meterReadingStart) + Number(log.totalWaterPumped);
    }
    if (log.totalWaterPumped != null) {
      return Number(log.totalWaterPumped);
    }
    return null;
  }

  private formatLogDate(log: WaterEnergyLoggingDaily): string | null {
    if (!log.logDate) {
      return null;
    }
    if (log.logDate instanceof Date) {
      return log.logDate.toISOString().slice(0, 10);
    }
    return String(log.logDate).slice(0, 10);
  }

  planMeterCorrectionsForLogs(
    logs: WaterEnergyLoggingDaily[],
    bulkMeterInstalled: boolean,
  ): { corrections: MeterCorrection[]; issues: MeterCorrectionIssue[] } {
    const corrections: MeterCorrection[] = [];
    const issues: MeterCorrectionIssue[] = [];
    const ordered = this.waterMeterVolume.sortWaterLogs(logs);

    if (!bulkMeterInstalled) {
      for (const log of ordered) {
        if (this.isRejected(log)) {
          continue;
        }
        if (
          log.meterReadingStart != null ||
          log.meterReadingEnd != null ||
          log.totalWaterPumped != null
        ) {
          corrections.push({
            logId: String(log.id),
            waterSystemId: String(log.waterSystemId),
            logDate: this.formatLogDate(log),
            oldMeterReadingStart: this.floatOrNone(log.meterReadingStart),
            oldMeterReadingEnd: this.floatOrNone(log.meterReadingEnd),
            oldTotalWaterPumped: this.floatOrNone(log.totalWaterPumped),
            newMeterReadingStart: null,
            newMeterReadingEnd: null,
            newTotalWaterPumped: null,
            note: 'No bulk meter installed — clearing meter and volume fields',
          });
        }
      }
      return { corrections, issues };
    }

    let prevEnd: number | null = null;
    for (const log of ordered) {
      if (this.isRejected(log)) {
        continue;
      }

      const cumulativeEnd = this.cumulativeStopReading(log);
      if (cumulativeEnd == null) {
        continue;
      }

      const newEnd = cumulativeEnd;
      let newStart: number | null;
      let newTotal: number | null;
      let note = '';

      if (prevEnd == null) {
        if (log.meterReadingStart != null) {
          newStart = Number(log.meterReadingStart);
          newTotal = newEnd > newStart ? newEnd - newStart : null;
          if (newTotal == null) {
            issues.push({
              logId: String(log.id),
              waterSystemId: String(log.waterSystemId),
              logDate: this.formatLogDate(log),
              message: `The first log's pump-stop reading (${newEnd}) is not greater than the stored initial reading (${newStart})`,
            });
            continue;
          }
          note =
            'First log — interval calculated from the stored initial reading';
        } else {
          newStart = null;
          newTotal = null;
          note =
            'First log — only the pump-stop reading is known; interval left empty (no initial reading on record)';
        }
      } else if (newEnd <= prevEnd) {
        issues.push({
          logId: String(log.id),
          waterSystemId: String(log.waterSystemId),
          logDate: this.formatLogDate(log),
          message: `Non-monotonic cumulative reading: pump-stop reading ${newEnd} is not greater than the previous pump-stop reading ${prevEnd}`,
        });
        continue;
      } else {
        newStart = prevEnd;
        newTotal = newEnd - newStart;
        note = 'Interval calculated from the previous pump-stop reading';
      }

      if (
        this.valuesDiffer(log.meterReadingStart, newStart) ||
        this.valuesDiffer(log.meterReadingEnd, newEnd) ||
        this.valuesDiffer(log.totalWaterPumped, newTotal)
      ) {
        corrections.push({
          logId: String(log.id),
          waterSystemId: String(log.waterSystemId),
          logDate: this.formatLogDate(log),
          oldMeterReadingStart: this.floatOrNone(log.meterReadingStart),
          oldMeterReadingEnd: this.floatOrNone(log.meterReadingEnd),
          oldTotalWaterPumped: this.floatOrNone(log.totalWaterPumped),
          newMeterReadingStart: newStart,
          newMeterReadingEnd: newEnd,
          newTotalWaterPumped: newTotal,
          note,
        });
      }

      prevEnd = newEnd;
    }

    return { corrections, issues };
  }

  async planMeterCorrections(systemId?: string | null): Promise<{
    corrections: MeterCorrection[];
    issues: MeterCorrectionIssue[];
  }> {
    const qb = this.waterSystemRepo
      .createQueryBuilder('ws')
      .orderBy('ws.tehsil', 'ASC')
      .addOrderBy('ws.village', 'ASC')
      .addOrderBy('ws.unique_identifier', 'ASC');

    if (systemId) {
      qb.where('ws.id = :systemId', { systemId });
    }

    const systems = await qb.getMany();
    const allCorrections: MeterCorrection[] = [];
    const allIssues: MeterCorrectionIssue[] = [];

    for (const system of systems) {
      const logs = await this.waterLogRepo.find({
        where: { waterSystemId: system.id },
        order: { logDate: 'ASC' },
      });
      const bulk = system.bulkMeterInstalled !== false;
      const { corrections, issues } = this.planMeterCorrectionsForLogs(
        logs,
        bulk,
      );
      allCorrections.push(...corrections);
      allIssues.push(...issues);
    }

    return { corrections: allCorrections, issues: allIssues };
  }

  async applyMeterCorrections(corrections: MeterCorrection[]): Promise<number> {
    let updated = 0;
    for (const item of corrections) {
      const log = await this.waterLogRepo.findOne({
        where: { id: item.logId },
      });
      if (!log) {
        continue;
      }
      log.meterReadingStart = item.newMeterReadingStart;
      log.meterReadingEnd = item.newMeterReadingEnd;
      log.totalWaterPumped = item.newTotalWaterPumped;
      await this.waterLogRepo.save(log);
      updated += 1;
    }
    return updated;
  }
}
