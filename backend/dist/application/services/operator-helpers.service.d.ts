import { Repository } from 'typeorm';
import { SolarSystem } from '../../infrastructure/database/entities/solar-system.entity';
import { SystemMeter } from '../../infrastructure/database/entities/system-meter.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
export declare const ALLOWED_EXTENSIONS: Set<string>;
export declare class OperatorHelpersService {
    private readonly solarSystemRepo;
    private readonly systemMeterRepo;
    constructor(solarSystemRepo: Repository<SolarSystem>, systemMeterRepo: Repository<SystemMeter>);
    parseDate(dateStr: string | null | undefined): Date | null;
    allowedFile(filename: string): boolean;
    findSolarSystemByLocation(tehsilCanonical: string, village: string, settlementRaw?: string | null, repo?: Repository<SolarSystem>): Promise<SolarSystem | null>;
    coerceOptionalFloat(val: unknown): number | null;
    coerceOptionalStr(value: unknown): string | null;
    meterToDict(meter: SystemMeter | null | undefined): Record<string, unknown> | null;
    getSystemMeters(system: WaterSystem | SolarSystem, repo?: Repository<SystemMeter>): Promise<SystemMeter[]>;
    getActiveMeter(system: WaterSystem | SolarSystem, repo?: Repository<SystemMeter>): Promise<SystemMeter | null>;
    upsertActiveSystemMeter(options: {
        meterType: string;
        waterSystemId?: string | null;
        solarSystemId?: string | null;
        meterModel?: string | null;
        meterSerialNumber?: string | null;
        meterAccuracyClass?: string | null;
        installationDate?: Date | string | null;
        updateMode?: string;
    }, repo?: Repository<SystemMeter>): Promise<SystemMeter | null>;
}
