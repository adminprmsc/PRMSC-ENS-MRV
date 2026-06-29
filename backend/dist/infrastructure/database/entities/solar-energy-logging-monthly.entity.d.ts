import { SolarSystem } from './solar-system.entity';
export declare class SolarEnergyLoggingMonthly {
    id: string;
    solarSystemId: string;
    year: number;
    month: number;
    exportOffPeak: number | null;
    exportPeak: number | null;
    importOffPeak: number | null;
    importPeak: number | null;
    netOffPeak: number | null;
    netPeak: number | null;
    electricityBillImageUrl: string | null;
    remarks: string | null;
    createdAt: Date;
    updatedAt: Date;
    system: SolarSystem;
}
