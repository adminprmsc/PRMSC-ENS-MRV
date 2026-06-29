import { TubewellOperatorService } from '../../application/services/tubewell-operator.service';
export declare class TubewellOperatorController {
    private readonly tubewellOperatorService;
    constructor(tubewellOperatorService: TubewellOperatorService);
    getNotifications(userId: string): Promise<{
        notifications: {
            id: string;
            title: string;
            message: string;
            is_read: boolean;
            submission_id: string | null;
            created_at: string;
        }[];
        unread_count: number;
    }>;
    markAllNotificationsRead(userId: string): Promise<{
        message: string;
    }>;
    markNotificationRead(userId: string, notificationId: string): Promise<{
        message: string;
    }>;
    submitDataForVerification(userId: string, body: {
        record_id?: string;
    }): Promise<{
        message: string;
        submission: {
            id: string;
            submission_type: string;
            status: string;
            submitted_at: string | null;
        };
    }>;
    getMySubmissions(userId: string, status?: string): Promise<{
        submissions: {
            id: string;
            record_id: string;
            submission_type: string;
            status: string;
            submitted_at: string | null;
            reviewed_at: string | null;
            approved_at: string | null;
            remarks: string | null;
            system_info: Record<string, unknown>;
        }[];
    }>;
    getOperatorSignature(userId: string): Promise<{
        signature_svg: string | null;
    }>;
    putOperatorSignature(userId: string, body: {
        signature_svg?: unknown;
    }): Promise<{
        message: string;
    }>;
    deleteOperatorSignature(userId: string): Promise<{
        message: string;
    }>;
    getTubewellWaterSubmissionDetail(userId: string, submissionId: string): Promise<{
        submission: {
            id: string;
            submission_type: string;
            status: string;
            operator_name: string;
            operator_email: string;
            submitted_at: string | null;
            reviewed_at: string | null;
            approved_at: string | null;
            reviewed_by_name: string | null;
            approved_by_name: string | null;
            remarks: string | null;
        };
        record_data: Record<string, unknown>;
        audit_trail: {
            action_type: string;
            performed_by: string;
            role: string;
            comment: string | null;
            created_at: string;
        }[];
    }>;
    uploadImage(userId: string, file: Express.Multer.File | undefined, recordType?: string, recordId?: string): Promise<{
        message: string;
        image_url: string;
        path: string;
        bucket: string;
        object_key: string;
    }>;
    getWaterSystems(userId: string, tehsil?: string, village?: string): Promise<{
        id: string;
        tehsil: string;
        village: string;
        settlement: string | null;
        unique_identifier: string;
        latitude: number | null;
        longitude: number | null;
        pump_model: string | null;
        bulk_meter_installed: boolean;
        meter_model: string | null;
        meter_serial_number: string | null;
        meter_accuracy_class: string | null;
        installation_date: string | null;
        current_meter: Record<string, unknown> | null;
        meters: Record<string, unknown>[];
        created_at: string | null;
        updated_at: string | null;
    }[]>;
    getWaterSystemConfig(userId: string, tehsil?: string, village?: string, settlement?: string): Promise<{
        exists: boolean;
        config: {
            pump_model: string | null;
            pump_serial_number: string | null;
            start_of_operation: string | null;
            depth_of_water_intake: number | null;
            height_to_ohr: number | null;
            pump_flow_rate: number | null;
            meter_model: string | null;
            meter_serial_number: string | null;
            meter_accuracy_class: string | null;
            installation_date: string | null;
            current_meter: Record<string, unknown> | null;
            meters: Record<string, unknown>[];
        };
    } | {
        exists: boolean;
        config: null;
    }>;
    getWaterMeterContext(userId: string, tehsil?: string, village?: string, settlement?: string, systemId?: string, excludeRecordId?: string, logDate?: string, pumpEndTime?: string): Promise<{
        bulk_meter_installed: boolean;
        previous_meter_reading_end: null;
        is_first_bulk_meter_log: boolean;
        prior_log_count: number;
        has_submitted_meter_end?: undefined;
        water_system_id?: undefined;
    } | {
        bulk_meter_installed: boolean;
        previous_meter_reading_end: number | null;
        has_submitted_meter_end: boolean;
        is_first_bulk_meter_log: boolean;
        prior_log_count: number;
        water_system_id: string;
    }>;
    getWaterDrafts(userId: string): Promise<{
        drafts: {
            id: string;
            system_id: string;
            village: string;
            tehsil: string;
            year: number | null;
            month: number | null;
            day: number | null;
            bulk_meter_image_url: string | null;
            signed: boolean;
            status: string;
            created_at: string | null;
        }[];
    }>;
    getWaterDraft(userId: string, recordId: string): Promise<{
        id: string;
        water_system_id: string;
        year: number | null;
        month: number | null;
        day: number | null;
        pump_start_time: string | null;
        pump_end_time: string | null;
        pump_operating_hours: number | null;
        meter_reading_start: number | null;
        meter_reading_end: number | null;
        total_water_pumped: number | null;
        bulk_meter_image_url: string | null;
        signed: boolean;
        signature_svg_snapshot: string | null;
        status: string;
        tehsil: string | null;
        village: string | null;
        settlement: string | null;
        bulk_meter_installed: boolean | null;
    }>;
    updateWaterDraft(userId: string, recordId: string, body: Record<string, unknown>): Promise<{
        message: string;
        id: string;
    }>;
    submitWaterDraft(userId: string, recordId: string): Promise<{
        message: string;
        id: string;
        status: string;
    }>;
    deleteWaterDraft(userId: string, recordId: string): Promise<{
        message: string;
    }>;
    getWaterSupplyData(userId: string, tehsil?: string, village?: string, settlement?: string, systemId?: string, year?: string): Promise<{
        id: string;
        year: number | null;
        month: number | null;
        day: number | null;
        pump_start_time: string | null;
        pump_end_time: string | null;
        pump_operating_hours: number | null;
        meter_reading_start: number | null;
        meter_reading_end: number | null;
        total_water_pumped: number | null;
        bulk_meter_image_url: string | null;
        status: string;
        remarks: string | null;
    }[]>;
    saveWaterSupplyData(userId: string, body: {
        data?: unknown;
        year?: unknown;
        status?: string;
        image_url?: string;
        image_path?: string;
    }): Promise<{
        message: string;
        ids: string[];
        record_ids: string[];
    }>;
}
