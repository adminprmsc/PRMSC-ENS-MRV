import { WaterSystem } from './water-system.entity';
export declare class WaterEnergyLoggingDaily {
    id: string;
    waterSystemId: string;
    logDate: Date;
    pumpStartTime: string | null;
    pumpEndTime: string | null;
    pumpOperatingHours: number | null;
    totalWaterPumped: number | null;
    meterReadingStart: number | null;
    meterReadingEnd: number | null;
    bulkMeterImageUrl: string | null;
    signed: boolean;
    signatureSvgSnapshot: string | null;
    status: string;
    remarks: string | null;
    createdAt: Date;
    updatedAt: Date;
    system: WaterSystem;
}
