import { DashboardService } from '../../application/services/dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getProgramSummary(tehsil?: string, village?: string): Promise<{
        ohr_count: number;
        solar_facilities: number;
        bulk_meters: number;
    }>;
    getWaterSupplied(tehsil?: string, village?: string, month?: string, year?: string): Promise<{
        month: number;
        total_water_pumped: number;
    }[]>;
    getPumpHours(tehsil?: string, village?: string, month?: string, year?: string): Promise<{
        month: number;
        pump_operating_hours: number;
    }[]>;
    getSolarGeneration(tehsil?: string, village?: string, month?: string, year?: string): Promise<{
        [x: string]: number;
        month: number;
    }[]>;
    getGridImport(tehsil?: string, village?: string, month?: string, year?: string): Promise<{
        [x: string]: number;
        month: number;
    }[]>;
    getWaterSystemsDetail(tehsil?: string, village?: string, month?: string, year?: string): Promise<{
        rows: {
            water_system_id: string;
            unique_identifier: string;
            tehsil: string;
            village: string;
            settlement: string | null;
            bulk_meter_installed: boolean;
            total_water_pumped_m3: number;
            latest_meter_reading_end_m3: number | null;
            period_meter_net_m3: number | null;
            total_pump_hours_h: number;
            days_logged: number;
            logs_count: number;
            avg_m3_per_hour: number | null;
            avg_m3_per_day_logged: number | null;
            avg_hours_per_day_logged: number | null;
        }[];
        meta: {
            month: number | undefined;
            year: number | undefined;
        };
    }>;
    getSolarSystemsDetail(tehsil?: string, village?: string, month?: string, year?: string): Promise<{
        rows: {
            solar_system_id: string;
            unique_identifier: string;
            tehsil: string;
            village: string;
            settlement: string;
            disco_info: string;
            bill_reference_number: string;
            total_export_kwh: number;
            total_import_kwh: number;
            total_net_kwh: number;
            months_logged: number;
            records_count: number;
            avg_export_kwh_per_month: number | null;
            avg_import_kwh_per_month: number | null;
            avg_net_kwh_per_month: number | null;
        }[];
        meta: {
            month: number | undefined;
            year: number | undefined;
        };
    }>;
}
