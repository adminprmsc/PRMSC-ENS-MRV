"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaterSubmissionDetailService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const submission_constants_1 = require("../../domain/constants/submission.constants");
const submission_entity_1 = require("../../infrastructure/database/entities/submission.entity");
const user_entity_1 = require("../../infrastructure/database/entities/user.entity");
const verification_log_entity_1 = require("../../infrastructure/database/entities/verification-log.entity");
const water_energy_logging_daily_entity_1 = require("../../infrastructure/database/entities/water-energy-logging-daily.entity");
const water_system_entity_1 = require("../../infrastructure/database/entities/water-system.entity");
const operator_helpers_service_1 = require("./operator-helpers.service");
const water_meter_volume_service_1 = require("./water-meter-volume.service");
let WaterSubmissionDetailService = class WaterSubmissionDetailService {
    submissionRepo;
    userRepo;
    waterLogRepo;
    waterSystemRepo;
    verificationLogRepo;
    operatorHelpers;
    waterMeterVolume;
    constructor(submissionRepo, userRepo, waterLogRepo, waterSystemRepo, verificationLogRepo, operatorHelpers, waterMeterVolume) {
        this.submissionRepo = submissionRepo;
        this.userRepo = userRepo;
        this.waterLogRepo = waterLogRepo;
        this.waterSystemRepo = waterSystemRepo;
        this.verificationLogRepo = verificationLogRepo;
        this.operatorHelpers = operatorHelpers;
        this.waterMeterVolume = waterMeterVolume;
    }
    async buildWaterSubmissionDetailResponse(submission) {
        const operator = await this.userRepo.findOne({
            where: { id: submission.operatorId },
        });
        const reviewer = submission.reviewedBy
            ? await this.userRepo.findOne({ where: { id: submission.reviewedBy } })
            : null;
        const approver = submission.approvedBy
            ? await this.userRepo.findOne({ where: { id: submission.approvedBy } })
            : null;
        let recordData = {};
        const record = await this.waterLogRepo.findOne({
            where: { id: submission.recordId },
        });
        if (record) {
            const system = await this.waterSystemRepo.findOne({
                where: { id: record.waterSystemId },
                relations: { meters: true },
            });
            const activeMeter = system?.activeMeter;
            const meterHistory = [];
            if (system?.meters) {
                const rows = system.meters
                    .filter((m) => m.meterType === submission_constants_1.METER_TYPE_TUBEWELL)
                    .sort((a, b) => {
                    const ak = (a.createdAt?.toISOString() ?? '') + String(a.id);
                    const bk = (b.createdAt?.toISOString() ?? '') + String(b.id);
                    return bk.localeCompare(ak);
                });
                for (const m of rows) {
                    const payload = this.operatorHelpers.meterToDict(m);
                    if (payload) {
                        meterHistory.push(payload);
                    }
                }
            }
            const logDateParts = record.logDate
                ? [
                    record.logDate.getFullYear(),
                    record.logDate.getMonth() + 1,
                    record.logDate.getDate(),
                ]
                : [];
            recordData = {
                year: logDateParts[0] ?? null,
                month: logDateParts[1] ?? null,
                day: logDateParts[2] ?? null,
                log_date: record.logDate?.toISOString().slice(0, 10) ?? null,
                last_edited_at: record.updatedAt?.toISOString() ?? null,
                pump_start_time: record.pumpStartTime
                    ? record.pumpStartTime.slice(0, 8)
                    : null,
                pump_end_time: record.pumpEndTime
                    ? record.pumpEndTime.slice(0, 8)
                    : null,
                pump_operating_hours: record.pumpOperatingHours,
                meter_reading_start: record.meterReadingStart,
                meter_reading_end: record.meterReadingEnd,
                previous_meter_reading_end: record.waterSystemId
                    ? await this.waterMeterVolume.getLatestSubmittedMeterReadingEnd(String(record.waterSystemId), { excludeRecordId: String(record.id) })
                    : null,
                total_water_pumped: record.totalWaterPumped,
                bulk_meter_image_url: record.bulkMeterImageUrl,
                signed: record.signed ?? false,
                signature_svg_snapshot: record.signatureSvgSnapshot ?? null,
                system: {
                    id: system?.id ?? null,
                    unique_identifier: system?.uniqueIdentifier ?? null,
                    village: system?.village ?? null,
                    tehsil: system?.tehsil ?? null,
                    settlement: system?.settlement ?? null,
                    pump_model: system?.pumpModel ?? null,
                    pump_serial_number: system?.pumpSerialNumber ?? null,
                    start_of_operation: system?.startOfOperation ?? null,
                    depth_of_water_intake: system?.depthOfWaterIntake ?? null,
                    height_to_ohr: system?.heightToOhr ?? null,
                    pump_flow_rate: system?.pumpFlowRate ?? null,
                    bulk_meter_installed: system?.bulkMeterInstalled ?? null,
                    meter_model: activeMeter?.meterModel ?? null,
                    meter_serial_number: activeMeter?.meterSerialNumber ?? null,
                    meter_accuracy_class: activeMeter?.meterAccuracyClass ?? null,
                    installation_date: activeMeter?.installationDate ?? null,
                    current_meter: this.operatorHelpers.meterToDict(activeMeter),
                    meters: meterHistory,
                },
            };
        }
        const logs = await this.verificationLogRepo.find({
            where: { submissionId: submission.id },
            order: { createdAt: 'ASC' },
        });
        const auditTrail = [];
        for (const log of logs) {
            const u = await this.userRepo.findOne({ where: { id: log.performedBy } });
            auditTrail.push({
                action_type: log.actionType,
                performed_by: u?.name ?? 'Unknown',
                role: log.role,
                comment: log.comment,
                created_at: log.createdAt?.toISOString() ?? null,
            });
        }
        return {
            submission: {
                id: submission.id,
                submission_type: submission.submissionType,
                status: submission.status,
                operator_name: operator?.name ?? 'Unknown',
                operator_email: operator?.email ?? 'Unknown',
                submitted_at: submission.submittedAt?.toISOString() ?? null,
                reviewed_at: submission.reviewedAt?.toISOString() ?? null,
                approved_at: submission.approvedAt?.toISOString() ?? null,
                reviewed_by_name: reviewer?.name ?? null,
                approved_by_name: approver?.name ?? null,
                remarks: submission.remarks,
            },
            record_data: recordData,
            audit_trail: auditTrail,
        };
    }
};
exports.WaterSubmissionDetailService = WaterSubmissionDetailService;
exports.WaterSubmissionDetailService = WaterSubmissionDetailService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, typeorm_1.InjectRepository)(water_energy_logging_daily_entity_1.WaterEnergyLoggingDaily)),
    __param(3, (0, typeorm_1.InjectRepository)(water_system_entity_1.WaterSystem)),
    __param(4, (0, typeorm_1.InjectRepository)(verification_log_entity_1.VerificationLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        operator_helpers_service_1.OperatorHelpersService,
        water_meter_volume_service_1.WaterMeterVolumeService])
], WaterSubmissionDetailService);
//# sourceMappingURL=water-submission-detail.service.js.map