import { DataSource, Repository } from 'typeorm';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import { SolarSystem } from '../../infrastructure/database/entities/solar-system.entity';
import { SolarEnergyLoggingMonthly } from '../../infrastructure/database/entities/solar-energy-logging-monthly.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { Submission } from '../../infrastructure/database/entities/submission.entity';
import { UserService } from './user.service';
import { StorageService } from './storage.service';
import { WorkflowService } from './workflow.service';
import { NotificationsService } from './notifications.service';
import { WaterSubmissionDetailService } from './water-submission-detail.service';
import { WaterMeterVolumeService } from './water-meter-volume.service';
import { PumpTimesService } from './pump-times.service';
import { OperatorHelpersService } from './operator-helpers.service';
import { TehsilAccessService } from './tehsil-access.service';
import { RbacService } from './rbac.service';
export declare class TubewellOperatorService {
    private readonly waterSystemRepo;
    private readonly waterLogRepo;
    private readonly solarSystemRepo;
    private readonly solarLogRepo;
    private readonly userRepo;
    private readonly submissionRepo;
    private readonly dataSource;
    private readonly userService;
    private readonly storageService;
    private readonly workflowService;
    private readonly notificationsService;
    private readonly waterSubmissionDetailService;
    private readonly waterMeterVolumeService;
    private readonly pumpTimesService;
    private readonly operatorHelpers;
    private readonly tehsilAccess;
    private readonly rbac;
    constructor(waterSystemRepo: Repository<WaterSystem>, waterLogRepo: Repository<WaterEnergyLoggingDaily>, solarSystemRepo: Repository<SolarSystem>, solarLogRepo: Repository<SolarEnergyLoggingMonthly>, userRepo: Repository<User>, submissionRepo: Repository<Submission>, dataSource: DataSource, userService: UserService, storageService: StorageService, workflowService: WorkflowService, notificationsService: NotificationsService, waterSubmissionDetailService: WaterSubmissionDetailService, waterMeterVolumeService: WaterMeterVolumeService, pumpTimesService: PumpTimesService, operatorHelpers: OperatorHelpersService, tehsilAccess: TehsilAccessService, rbac: RbacService);
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
    markNotificationRead(userId: string, notificationId: string): Promise<{
        message: string;
    }>;
    markAllNotificationsRead(userId: string): Promise<{
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
    uploadImage(userId: string, file: Express.Multer.File | undefined, recordType: string, recordId?: string): Promise<{
        message: string;
        image_url: string;
        path: string;
        bucket: string;
        object_key: string;
    }>;
    getWaterSystems(userId: string, filterTehsil?: string, filterVillage?: string): Promise<{
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
    getWaterMeterContext(userId: string, query: {
        tehsil?: string;
        village?: string;
        settlement?: string;
        system_id?: string;
        exclude_record_id?: string;
        log_date?: string;
        pump_end_time?: string;
    }): Promise<{
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
    updateWaterDraft(userId: string, recordId: string, data: Record<string, unknown>): Promise<{
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
    getWaterSupplyData(userId: string, query: {
        tehsil?: string;
        village?: string;
        settlement?: string;
        system_id?: string;
        year?: number;
    }): Promise<{
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
    private throwBulkMeterError;
    private applyWaterLogYearFilter;
    private findWaterSystemByLocation;
    private waterLogToJson;
    private signaturePayloadOk;
    private requireOperatorSignature;
    private signatureSvgOrNone;
    private meterHistoryPayload;
    private getActiveMeter;
    private waterSystemToJson;
    private daysInMonth;
    private parseIsoDate;
}
