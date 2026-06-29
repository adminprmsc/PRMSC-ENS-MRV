import { Repository } from 'typeorm';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
export declare class MeterReadingOrderError extends Error {
    readonly code = "meter_reading_order";
    readonly endVal: number;
    readonly baseVal: number;
    constructor(endVal: number, baseVal: number);
}
export declare class WaterMeterVolumeService {
    private readonly waterLogRepo;
    constructor(waterLogRepo: Repository<WaterEnergyLoggingDaily>);
    private dateToMs;
    waterLogSortKey(record: WaterEnergyLoggingDaily): [number, string, string, number, string];
    sortWaterLogs(logs: WaterEnergyLoggingDaily[]): WaterEnergyLoggingDaily[];
    private readingEndValue;
    intervalVolumeFromLog(record: WaterEnergyLoggingDaily, previousEnd: number | null): [number | null, number | null];
    computeIntervalVolumes(logs: WaterEnergyLoggingDaily[]): Record<string, number>;
    sumEffectivePumpedM3(logs: WaterEnergyLoggingDaily[]): number;
    getLatestSubmittedMeterReadingEnd(waterSystemId: string, excludeRecordIdOrOptions?: string | {
        excludeRecordId?: string | null;
    }): Promise<number | null>;
    countMeterChainLogs(waterSystemId: string, excludeRecordId?: string | null): Promise<number>;
    resolveBulkMeterVolumes(options: {
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
    }>;
    applyBulkMeterFields(options: {
        record: WaterEnergyLoggingDaily;
        waterSystemId: string;
        noBulkMeterInstalled: boolean;
        meterReadingEnd?: number | null;
        meterReadingStart?: number | null;
        legacyTotalWaterPumped?: number | null;
        excludeRecordId?: string | null;
    }): Promise<void>;
    aggregateMonthlyEffectiveVolumes(logs: WaterEnergyLoggingDaily[]): Record<string, number>;
    aggregateSystemEffectiveVolumesInRange(logs: WaterEnergyLoggingDaily[], options?: {
        startDate?: string | null;
        endDateExclusive?: string | null;
    }): Record<string, number>;
    aggregateSystemMeterSnapshotsInRange(logs: WaterEnergyLoggingDaily[], options?: {
        startDate?: string | null;
        endDateExclusive?: string | null;
    }): Record<string, {
        latest_meter_reading_end: number | null;
        period_meter_net_m3: number | null;
    }>;
    private logInDateRange;
}
