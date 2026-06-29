import { Repository } from 'typeorm';
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
export declare class WaterMeterBackfillService {
    private readonly waterSystemRepo;
    private readonly waterLogRepo;
    private readonly waterMeterVolume;
    constructor(waterSystemRepo: Repository<WaterSystem>, waterLogRepo: Repository<WaterEnergyLoggingDaily>, waterMeterVolume: WaterMeterVolumeService);
    private isRejected;
    private floatOrNone;
    private valuesDiffer;
    private cumulativeStopReading;
    private formatLogDate;
    planMeterCorrectionsForLogs(logs: WaterEnergyLoggingDaily[], bulkMeterInstalled: boolean): {
        corrections: MeterCorrection[];
        issues: MeterCorrectionIssue[];
    };
    planMeterCorrections(systemId?: string | null): Promise<{
        corrections: MeterCorrection[];
        issues: MeterCorrectionIssue[];
    }>;
    applyMeterCorrections(corrections: MeterCorrection[]): Promise<number>;
}
