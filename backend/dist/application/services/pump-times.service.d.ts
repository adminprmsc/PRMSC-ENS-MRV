import { OperatorHelpersService } from './operator-helpers.service';
export declare class PumpTimesService {
    private readonly operatorHelpers;
    constructor(operatorHelpers: OperatorHelpersService);
    parseTimeOfDay(value: unknown): string | null;
    pumpHoursFromStartEnd(start: string, end: string): number;
    timeToJson(t: string | null | undefined): string | null;
    applyPumpTimeFieldsFromPayload(record: {
        pumpStartTime?: string | null;
        pumpEndTime?: string | null;
        pumpOperatingHours?: number | null;
    }, data: Record<string, unknown>): void;
}
