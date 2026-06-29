import { SolarSystem } from './solar-system.entity';
import { WaterSystem } from './water-system.entity';
export declare class SystemMeter {
    id: string;
    meterType: string;
    waterSystemId: string | null;
    solarSystemId: string | null;
    meterModel: string | null;
    meterSerialNumber: string | null;
    meterAccuracyClass: string | null;
    installationDate: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    waterSystem: WaterSystem | null;
    solarSystem: SolarSystem | null;
}
