import type { Request } from 'express';
import { TehsilManagerService } from '../../application/services/tehsil-manager.service';
export declare class TehsilManagerController {
    private readonly tehsilManagerService;
    constructor(tehsilManagerService: TehsilManagerService);
    private jwtFromRequest;
    private respond;
    getWaterAnomalies(req: Request, query: {
        days?: string;
        end_date?: string;
        tehsil?: string;
        village?: string;
    }): Promise<Record<string, unknown>>;
    getLoggingCompliance(req: Request, query: {
        water_date?: string;
        solar_year?: string;
        solar_month?: string;
    }): Promise<Record<string, unknown>>;
    getWaterDailyLoggingRange(req: Request, query: {
        water_system_id?: string;
        date_from?: string;
        date_to?: string;
    }): Promise<Record<string, unknown>>;
    getSolarMonthlyYearRange(req: Request, query: {
        solar_system_id?: string;
        year?: string;
    }): Promise<Record<string, unknown>>;
    listWaterOperatorAssignments(req: Request): Promise<Record<string, unknown>>;
    replaceWaterOperatorAssignments(req: Request, operatorId: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    getTehsilManagerWaterSubmissionDetail(req: Request, submissionId: string): Promise<Record<string, unknown>>;
    addWaterSystem(req: Request, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    addSolarSystem(req: Request, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    submitSolarData(req: Request, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    updateWaterSystem(req: Request, systemId: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    getWaterSystem(req: Request, systemId: string): Promise<Record<string, unknown>>;
    getWaterSystemCalibrationCertificate(req: Request, systemId: string): Promise<Record<string, unknown>>;
    putWaterSystemCalibrationCertificate(req: Request, systemId: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    listActiveWaterSystemCalibrationCertificates(req: Request): Promise<Record<string, unknown>>;
    deleteWaterSystem(req: Request, systemId: string): Promise<Record<string, unknown>>;
    getSolarSystems(req: Request, query: {
        tehsil?: string;
        village?: string;
    }): Promise<Record<string, unknown>>;
    deleteSolarSystem(req: Request, systemId: string): Promise<Record<string, unknown>>;
    getSolarSystem(req: Request, systemId: string): Promise<Record<string, unknown>>;
    updateSolarSystem(req: Request, systemId: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    getSolarSystemConfig(req: Request, query: {
        tehsil?: string;
        village?: string;
        settlement?: string;
    }): Promise<Record<string, unknown>>;
    getSolarSupplyData(req: Request, query: {
        tehsil?: string;
        village?: string;
        settlement?: string;
        year?: string;
    }): Promise<Record<string, unknown>>;
    getSolarSupplyDataRecord(req: Request, recordId: string): Promise<Record<string, unknown>>;
    updateSolarSupplyDataRecord(req: Request, recordId: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    deleteSolarSupplyDataRecord(req: Request, recordId: string): Promise<Record<string, unknown>>;
    saveSolarSupplyData(req: Request, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    getPendingSubmissions(req: Request): Promise<Record<string, unknown>>;
    acceptSubmission(req: Request, submissionId: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    rejectSubmission(req: Request, submissionId: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    revertSubmission(req: Request, submissionId: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
    getVerificationAuditLogs(req: Request, query: {
        submission_id?: string;
        action_type?: string;
        user_id?: string;
    }): Promise<Record<string, unknown>>;
    getVerificationStats(req: Request): Promise<Record<string, unknown>>;
    getNotifications(req: Request): Promise<Record<string, unknown>>;
    markNotificationRead(req: Request, notificationId: string): Promise<Record<string, unknown>>;
    markAllNotificationsRead(req: Request): Promise<Record<string, unknown>>;
}
