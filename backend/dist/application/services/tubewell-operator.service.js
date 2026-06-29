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
exports.TubewellOperatorService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const water_system_entity_1 = require("../../infrastructure/database/entities/water-system.entity");
const water_energy_logging_daily_entity_1 = require("../../infrastructure/database/entities/water-energy-logging-daily.entity");
const solar_system_entity_1 = require("../../infrastructure/database/entities/solar-system.entity");
const solar_energy_logging_monthly_entity_1 = require("../../infrastructure/database/entities/solar-energy-logging-monthly.entity");
const user_entity_1 = require("../../infrastructure/database/entities/user.entity");
const submission_entity_1 = require("../../infrastructure/database/entities/submission.entity");
const submission_constants_1 = require("../../domain/constants/submission.constants");
const tehsils_1 = require("../../domain/constants/tehsils");
const date_util_1 = require("../../domain/utils/date.util");
const user_service_1 = require("./user.service");
const storage_service_1 = require("./storage.service");
const workflow_service_1 = require("./workflow.service");
const notifications_service_1 = require("./notifications.service");
const water_submission_detail_service_1 = require("./water-submission-detail.service");
const water_meter_volume_service_1 = require("./water-meter-volume.service");
const pump_times_service_1 = require("./pump-times.service");
const operator_helpers_service_1 = require("./operator-helpers.service");
const tehsil_access_service_1 = require("./tehsil-access.service");
const rbac_service_1 = require("./rbac.service");
let TubewellOperatorService = class TubewellOperatorService {
    waterSystemRepo;
    waterLogRepo;
    solarSystemRepo;
    solarLogRepo;
    userRepo;
    submissionRepo;
    dataSource;
    userService;
    storageService;
    workflowService;
    notificationsService;
    waterSubmissionDetailService;
    waterMeterVolumeService;
    pumpTimesService;
    operatorHelpers;
    tehsilAccess;
    rbac;
    constructor(waterSystemRepo, waterLogRepo, solarSystemRepo, solarLogRepo, userRepo, submissionRepo, dataSource, userService, storageService, workflowService, notificationsService, waterSubmissionDetailService, waterMeterVolumeService, pumpTimesService, operatorHelpers, tehsilAccess, rbac) {
        this.waterSystemRepo = waterSystemRepo;
        this.waterLogRepo = waterLogRepo;
        this.solarSystemRepo = solarSystemRepo;
        this.solarLogRepo = solarLogRepo;
        this.userRepo = userRepo;
        this.submissionRepo = submissionRepo;
        this.dataSource = dataSource;
        this.userService = userService;
        this.storageService = storageService;
        this.workflowService = workflowService;
        this.notificationsService = notificationsService;
        this.waterSubmissionDetailService = waterSubmissionDetailService;
        this.waterMeterVolumeService = waterMeterVolumeService;
        this.pumpTimesService = pumpTimesService;
        this.operatorHelpers = operatorHelpers;
        this.tehsilAccess = tehsilAccess;
        this.rbac = rbac;
    }
    getNotifications(userId) {
        return this.notificationsService.getNotificationsResponse(userId);
    }
    markNotificationRead(userId, notificationId) {
        return this.notificationsService.markNotificationReadResponse(userId, notificationId);
    }
    markAllNotificationsRead(userId) {
        return this.notificationsService.markAllNotificationsReadResponse(userId);
    }
    async submitDataForVerification(userId, body) {
        const currentUser = await this.userRepo.findOne({ where: { id: userId } });
        if (!currentUser) {
            throw new common_1.NotFoundException({ error: 'User not found' });
        }
        if (this.rbac.userRoleCode(currentUser) !== this.rbac.USER) {
            throw new common_1.ForbiddenException({
                error: 'Only tubewell operators can submit data',
            });
        }
        this.requireOperatorSignature(currentUser);
        const recordId = body?.record_id;
        if (!recordId) {
            throw new common_1.BadRequestException({ error: 'record_id is required' });
        }
        const submissionType = 'water_system';
        const record = await this.waterLogRepo.findOne({ where: { id: recordId } });
        if (!record) {
            throw new common_1.NotFoundException({ error: 'Water data record not found' });
        }
        record.signed = true;
        record.signatureSvgSnapshot = this.signatureSvgOrNone(currentUser);
        let submission = await this.submissionRepo.findOne({
            where: { recordId },
        });
        if (submission) {
            if (submission.status === submission_constants_1.SUBMISSION_STATUS_SUBMITTED) {
                throw new common_1.BadRequestException({
                    error: 'This record is already submitted',
                });
            }
            if (submission.status === submission_constants_1.SUBMISSION_STATUS_ACCEPTED) {
                throw new common_1.BadRequestException({
                    error: 'This record is already accepted',
                });
            }
            if (![
                submission_constants_1.SUBMISSION_STATUS_REJECTED,
                submission_constants_1.SUBMISSION_STATUS_REVERTED_BACK,
                submission_constants_1.SUBMISSION_STATUS_DRAFTED,
            ].includes(submission.status)) {
                throw new common_1.BadRequestException({
                    error: `Cannot resubmit from status ${submission.status}`,
                });
            }
            submission.status = submission_constants_1.SUBMISSION_STATUS_SUBMITTED;
            submission.submittedAt = new Date();
            submission.reviewedAt = null;
            submission.reviewedBy = null;
            submission.remarks = null;
            await this.submissionRepo.save(submission);
        }
        else {
            submission = this.submissionRepo.create({
                operatorId: userId,
                submissionType,
                recordId,
                status: submission_constants_1.SUBMISSION_STATUS_SUBMITTED,
                submittedAt: new Date(),
            });
            submission = await this.submissionRepo.save(submission);
        }
        record.status = submission_constants_1.SUBMISSION_STATUS_SUBMITTED;
        await this.waterLogRepo.save(record);
        await this.workflowService.logVerificationAction(submission.id, 'submit', userId, this.rbac.userRoleCode(currentUser), 'Data submitted for verification');
        const system = await this.waterSystemRepo.findOne({
            where: { id: record.waterSystemId },
        });
        const details = `New Monthly Water Report (${(0, date_util_1.getCalendarMonth)(record.logDate)}/${(0, date_util_1.getCalendarYear)(record.logDate)}) submitted by ${currentUser.name}.\n` +
            `Location: ${system?.tehsil}, ${system?.village} ${system?.settlement || ''}\n` +
            `Pump Operating Hours: ${record.pumpOperatingHours ?? 'N/A'}\n` +
            `Total Water Pumped: ${record.totalWaterPumped ?? 'N/A'}`;
        await this.workflowService.notifyAnalysts('New Detailed Water Submission', details, submission.id, system?.tehsil);
        return {
            message: 'Data submitted successfully',
            submission: {
                id: submission.id,
                submission_type: submission.submissionType,
                status: submission.status,
                submitted_at: (0, date_util_1.toIsoDateTimeString)(submission.submittedAt),
            },
        };
    }
    async getMySubmissions(userId, status) {
        const where = {
            operatorId: userId,
            submissionType: 'water_system',
        };
        if (status) {
            where.status = status;
        }
        const submissions = await this.submissionRepo.find({
            where,
            order: { createdAt: 'DESC' },
        });
        const result = [];
        for (const sub of submissions) {
            let systemInfo = {};
            const record = await this.waterLogRepo.findOne({
                where: { id: sub.recordId },
            });
            if (record) {
                const system = await this.waterSystemRepo.findOne({
                    where: { id: record.waterSystemId },
                });
                if (system) {
                    systemInfo = {
                        village: system.village,
                        tehsil: system.tehsil,
                        year: (0, date_util_1.getCalendarYear)(record.logDate),
                        month: (0, date_util_1.getCalendarMonth)(record.logDate),
                    };
                }
            }
            result.push({
                id: sub.id,
                record_id: sub.recordId,
                submission_type: sub.submissionType,
                status: sub.status,
                submitted_at: (0, date_util_1.toIsoDateTimeString)(sub.submittedAt),
                reviewed_at: (0, date_util_1.toIsoDateTimeString)(sub.reviewedAt),
                approved_at: (0, date_util_1.toIsoDateTimeString)(sub.approvedAt),
                remarks: sub.remarks,
                system_info: systemInfo,
            });
        }
        return { submissions: result };
    }
    async getOperatorSignature(userId) {
        const u = await this.userService.getUserById(userId);
        if (!u) {
            throw new common_1.NotFoundException({ message: 'User not found' });
        }
        if (this.rbac.userRoleCode(u) !== this.rbac.USER) {
            throw new common_1.ForbiddenException({
                message: 'Only tubewell operators can access signature',
            });
        }
        return { signature_svg: u.signatureSvg };
    }
    async putOperatorSignature(userId, body) {
        const u = await this.userService.getUserById(userId);
        if (!u) {
            throw new common_1.NotFoundException({ message: 'User not found' });
        }
        if (this.rbac.userRoleCode(u) !== this.rbac.USER) {
            throw new common_1.ForbiddenException({
                message: 'Only tubewell operators can edit signature',
            });
        }
        const svg = body?.signature_svg;
        if (!this.signaturePayloadOk(svg)) {
            throw new common_1.BadRequestException({ message: 'Invalid signature_svg' });
        }
        u.signatureSvg = String(svg).trim();
        await this.userRepo.save(u);
        return { message: 'Signature saved' };
    }
    async deleteOperatorSignature(userId) {
        const u = await this.userService.getUserById(userId);
        if (!u) {
            throw new common_1.NotFoundException({ message: 'User not found' });
        }
        if (this.rbac.userRoleCode(u) !== this.rbac.USER) {
            throw new common_1.ForbiddenException({
                message: 'Only tubewell operators can delete signature',
            });
        }
        u.signatureSvg = null;
        await this.userRepo.save(u);
        return { message: 'Signature deleted' };
    }
    async getTubewellWaterSubmissionDetail(userId, submissionId) {
        const currentUser = await this.userRepo.findOne({ where: { id: userId } });
        if (!currentUser) {
            throw new common_1.NotFoundException({ error: 'User not found' });
        }
        if (this.rbac.userRoleCode(currentUser) !== this.rbac.USER) {
            throw new common_1.ForbiddenException({
                error: 'Only tubewell operators can use this endpoint',
            });
        }
        const submission = await this.submissionRepo.findOne({
            where: { id: submissionId },
        });
        if (!submission) {
            throw new common_1.NotFoundException({ error: 'Submission not found' });
        }
        if (submission.submissionType !== 'water_system') {
            throw new common_1.BadRequestException({
                error: 'Only water submissions are supported',
            });
        }
        if (String(submission.operatorId) !== String(userId)) {
            throw new common_1.ForbiddenException({ error: 'Access denied' });
        }
        const record = await this.waterLogRepo.findOne({
            where: { id: submission.recordId },
        });
        if (!record) {
            throw new common_1.NotFoundException({ error: 'Record not found' });
        }
        const assignedIds = this.tehsilAccess.assignedWaterSystemIdSet(currentUser);
        if (!assignedIds.has(String(record.waterSystemId))) {
            throw new common_1.ForbiddenException({ error: 'Access denied' });
        }
        return this.waterSubmissionDetailService.buildWaterSubmissionDetailResponse(submission);
    }
    async uploadImage(userId, file, recordType, recordId) {
        const user = await this.userService.getUserById(userId);
        if (!user) {
            throw new common_1.NotFoundException({ message: 'User not found' });
        }
        const rt = recordType || 'water';
        if (rt === 'solar' || rt === 'water_calibration') {
            if (this.rbac.userRoleCode(user) !== this.rbac.ADMIN) {
                throw new common_1.ForbiddenException({
                    message: 'This evidence upload requires tehsil manager role',
                });
            }
        }
        else {
            if (this.rbac.userRoleCode(user) !== this.rbac.USER) {
                throw new common_1.ForbiddenException({
                    message: 'Water evidence upload requires tubewell operator role',
                });
            }
            if (!user.assignedWaterSystemIds?.length) {
                throw new common_1.ForbiddenException({
                    message: 'No water systems assigned — contact your tehsil manager',
                });
            }
        }
        if (!file) {
            throw new common_1.BadRequestException({ message: 'No file provided' });
        }
        if (!file.originalname) {
            throw new common_1.BadRequestException({ message: 'No file selected' });
        }
        if (!this.operatorHelpers.allowedFile(file.originalname)) {
            throw new common_1.BadRequestException({
                message: 'File type not allowed. Use PNG, JPG, JPEG, GIF, or PDF.',
            });
        }
        let folder;
        if (rt === 'solar') {
            folder = 'solar-images';
        }
        else if (rt === 'water_calibration') {
            folder = 'water-calibration-certificates';
        }
        else {
            folder = 'water-images';
        }
        let uploadResult;
        try {
            uploadResult = await this.storageService.uploadFileStorage(file, folder);
        }
        catch (exc) {
            throw new common_1.InternalServerErrorException({
                message: 'Image upload failed',
                error: String(exc),
            });
        }
        const imageUrl = uploadResult.public_url;
        if (recordId) {
            if (rt === 'water') {
                const record = await this.waterLogRepo.findOne({
                    where: { id: recordId },
                });
                if (record) {
                    const ws = await this.waterSystemRepo.findOne({
                        where: { id: record.waterSystemId },
                    });
                    try {
                        await this.tehsilAccess.assertUserMayLogWaterSystem(user, ws);
                    }
                    catch {
                        throw new common_1.ForbiddenException({
                            message: 'Access denied for this record',
                        });
                    }
                    record.bulkMeterImageUrl = imageUrl;
                    await this.waterLogRepo.save(record);
                }
            }
            else if (rt === 'solar') {
                const record = await this.solarLogRepo.findOne({
                    where: { id: recordId },
                });
                if (record) {
                    const ss = await this.solarSystemRepo.findOne({
                        where: { id: record.solarSystemId },
                    });
                    try {
                        await this.tehsilAccess.assertUserMayAccessSolarSystem(user, ss, {
                            forWrite: true,
                        });
                    }
                    catch {
                        throw new common_1.ForbiddenException({
                            message: 'Access denied for this record',
                        });
                    }
                    if ((record.electricityBillImageUrl || '') !== imageUrl) {
                        await this.storageService.tryDeletePublicObject(record.electricityBillImageUrl);
                        record.electricityBillImageUrl = imageUrl;
                    }
                    await this.solarLogRepo.save(record);
                }
            }
        }
        return {
            message: 'File uploaded successfully',
            image_url: imageUrl,
            path: imageUrl,
            bucket: uploadResult.bucket,
            object_key: uploadResult.object_key,
        };
    }
    async getWaterSystems(userId, filterTehsil, filterVillage) {
        const user = await this.userService.getUserById(userId);
        if (!user) {
            throw new common_1.NotFoundException({ message: 'User not found' });
        }
        const rk = this.rbac.userRank(user);
        const ts = [...(await this.rbac.userAssignedTehsils(user))];
        let systems;
        if (rk >= this.rbac.ROLE_RANK[this.rbac.SUPER_ADMIN]) {
            systems = await this.waterSystemRepo.find({
                relations: { meters: true },
            });
        }
        else if (this.rbac.userRoleCode(user) === this.rbac.USER) {
            const wids = user.assignedWaterSystemIds;
            if (!wids?.length) {
                return [];
            }
            systems = await this.waterSystemRepo.find({
                where: { id: (0, typeorm_2.In)(wids) },
                relations: { meters: true },
            });
        }
        else if (ts.length) {
            systems = await this.waterSystemRepo.find({
                where: { tehsil: (0, typeorm_2.In)(ts) },
                relations: { meters: true },
            });
        }
        else {
            return [];
        }
        if (filterTehsil && filterTehsil !== 'All Tehsils') {
            systems = systems.filter((s) => s.tehsil === filterTehsil);
        }
        if (filterVillage && filterVillage !== 'All Villages') {
            systems = systems.filter((s) => s.village === filterVillage);
        }
        return systems.map((s) => this.waterSystemToJson(s));
    }
    async getWaterSystemConfig(userId, tehsil, village, settlement = '') {
        const user = await this.userService.getUserById(userId);
        if (!tehsil || !village) {
            throw new common_1.BadRequestException({
                message: 'Tehsil and village are required',
            });
        }
        const ct = (0, tehsils_1.canonicalTehsil)(tehsil);
        if (!ct) {
            throw new common_1.BadRequestException({ message: 'Invalid tehsil' });
        }
        try {
            await this.tehsilAccess.assertUserMayAccessTehsil(user, ct);
        }
        catch {
            throw new common_1.ForbiddenException({
                message: 'Access denied for this tehsil',
            });
        }
        let system;
        if (settlement) {
            system = await this.waterSystemRepo.findOne({
                where: { tehsil: ct, village, settlement },
                relations: { meters: true },
            });
        }
        else {
            system = await this.waterSystemRepo
                .createQueryBuilder('ws')
                .leftJoinAndSelect('ws.meters', 'meters')
                .where('ws.tehsil = :ct', { ct })
                .andWhere('ws.village = :village', { village })
                .andWhere('(ws.settlement IS NULL OR ws.settlement = :empty)', {
                empty: '',
            })
                .getOne();
        }
        if (system) {
            try {
                await this.tehsilAccess.assertUserMayViewOrLogWaterSystem(user, system);
            }
            catch {
                throw new common_1.ForbiddenException({
                    message: 'Access denied for this water system',
                });
            }
            const activeMeter = this.getActiveMeter(system);
            return {
                exists: true,
                config: {
                    pump_model: system.pumpModel,
                    pump_serial_number: system.pumpSerialNumber,
                    start_of_operation: (0, date_util_1.toIsoDateString)(system.startOfOperation),
                    depth_of_water_intake: system.depthOfWaterIntake,
                    height_to_ohr: system.heightToOhr,
                    pump_flow_rate: system.pumpFlowRate,
                    meter_model: activeMeter?.meterModel ?? null,
                    meter_serial_number: activeMeter?.meterSerialNumber ?? null,
                    meter_accuracy_class: activeMeter?.meterAccuracyClass ?? null,
                    installation_date: (0, date_util_1.toIsoDateString)(activeMeter?.installationDate),
                    current_meter: this.operatorHelpers.meterToDict(activeMeter),
                    meters: this.meterHistoryPayload(system.meters, submission_constants_1.METER_TYPE_TUBEWELL),
                },
            };
        }
        return { exists: false, config: null };
    }
    async getWaterMeterContext(userId, query) {
        const user = await this.userService.getUserById(userId);
        const { tehsil, village, settlement = '', system_id: systemId, exclude_record_id: excludeRecordIdRaw, log_date: logDateRaw, pump_end_time: pumpEndRaw, } = query;
        const excludeRecordId = (excludeRecordIdRaw || '').trim() || undefined;
        let system = null;
        if (systemId) {
            system = await this.waterSystemRepo.findOne({ where: { id: systemId } });
        }
        else if (tehsil && village) {
            const ct = (0, tehsils_1.canonicalTehsil)(tehsil);
            if (!ct) {
                throw new common_1.BadRequestException({ message: 'Invalid tehsil' });
            }
            system = await this.findWaterSystemByLocation(ct, village, settlement || undefined);
        }
        else {
            throw new common_1.BadRequestException({
                message: 'system_id or tehsil+village required',
            });
        }
        if (!system) {
            throw new common_1.NotFoundException({ message: 'Water system not found' });
        }
        try {
            await this.tehsilAccess.assertUserMayViewOrLogWaterSystem(user, system);
        }
        catch {
            throw new common_1.ForbiddenException({
                message: 'Access denied for this water system',
            });
        }
        const bulkMeter = system.bulkMeterInstalled !== false;
        if (!bulkMeter) {
            return {
                bulk_meter_installed: false,
                previous_meter_reading_end: null,
                is_first_bulk_meter_log: false,
                prior_log_count: 0,
            };
        }
        if (logDateRaw) {
            const parsed = this.parseIsoDate(logDateRaw);
            if (!parsed) {
                throw new common_1.BadRequestException({
                    message: 'Invalid log_date; use YYYY-MM-DD',
                });
            }
        }
        if (pumpEndRaw) {
            const parsedEnd = this.pumpTimesService.parseTimeOfDay(pumpEndRaw);
            if (parsedEnd === null) {
                throw new common_1.BadRequestException({ message: 'Invalid pump_end_time' });
            }
        }
        const prevEnd = await this.waterMeterVolumeService.getLatestSubmittedMeterReadingEnd(String(system.id), excludeRecordId);
        const priorCount = await this.waterMeterVolumeService.countMeterChainLogs(String(system.id), excludeRecordId);
        return {
            bulk_meter_installed: true,
            previous_meter_reading_end: prevEnd,
            has_submitted_meter_end: prevEnd !== null,
            is_first_bulk_meter_log: priorCount === 0,
            prior_log_count: priorCount,
            water_system_id: String(system.id),
        };
    }
    async getWaterDrafts(userId) {
        const user = await this.userService.getUserById(userId);
        const rk = this.rbac.userRank(user);
        const ts = [...(await this.rbac.userAssignedTehsils(user))];
        let systemIds;
        if (rk >= this.rbac.ROLE_RANK[this.rbac.SUPER_ADMIN]) {
            const all = await this.waterSystemRepo.find({ select: { id: true } });
            systemIds = all.map((s) => s.id);
        }
        else if (this.rbac.userRoleCode(user) === this.rbac.USER) {
            const wids = user.assignedWaterSystemIds;
            if (!wids?.length) {
                return { drafts: [] };
            }
            systemIds = wids;
        }
        else if (ts.length) {
            const scoped = await this.waterSystemRepo.find({
                where: { tehsil: (0, typeorm_2.In)(ts) },
                select: { id: true },
            });
            systemIds = scoped.map((s) => s.id);
        }
        else {
            return { drafts: [] };
        }
        const drafts = await this.waterLogRepo.find({
            where: {
                waterSystemId: (0, typeorm_2.In)(systemIds),
                status: submission_constants_1.SUBMISSION_STATUS_DRAFTED,
            },
            order: { createdAt: 'DESC' },
        });
        const result = [];
        for (const draft of drafts) {
            const system = await this.waterSystemRepo.findOne({
                where: { id: draft.waterSystemId },
            });
            result.push({
                id: String(draft.id),
                system_id: String(draft.waterSystemId),
                village: system?.village ?? 'Unknown',
                tehsil: system?.tehsil ?? 'Unknown',
                year: (0, date_util_1.getCalendarYear)(draft.logDate),
                month: (0, date_util_1.getCalendarMonth)(draft.logDate),
                day: (0, date_util_1.getCalendarDay)(draft.logDate),
                bulk_meter_image_url: draft.bulkMeterImageUrl,
                signed: draft.signed,
                status: draft.status,
                created_at: (0, date_util_1.toIsoDateTimeString)(draft.createdAt),
            });
        }
        return { drafts: result };
    }
    async getWaterDraft(userId, recordId) {
        const record = await this.waterLogRepo.findOne({ where: { id: recordId } });
        if (!record) {
            throw new common_1.NotFoundException({ error: 'Record not found' });
        }
        const u = await this.userService.getUserById(userId);
        const system = await this.waterSystemRepo.findOne({
            where: { id: record.waterSystemId },
        });
        try {
            await this.tehsilAccess.assertUserMayViewOrLogWaterSystem(u, system);
        }
        catch {
            throw new common_1.ForbiddenException({ error: 'Access denied' });
        }
        return {
            id: String(record.id),
            water_system_id: String(record.waterSystemId),
            year: (0, date_util_1.getCalendarYear)(record.logDate),
            month: (0, date_util_1.getCalendarMonth)(record.logDate),
            day: (0, date_util_1.getCalendarDay)(record.logDate),
            pump_start_time: this.pumpTimesService.timeToJson(record.pumpStartTime),
            pump_end_time: this.pumpTimesService.timeToJson(record.pumpEndTime),
            pump_operating_hours: record.pumpOperatingHours,
            meter_reading_start: record.meterReadingStart,
            meter_reading_end: record.meterReadingEnd,
            total_water_pumped: record.totalWaterPumped,
            bulk_meter_image_url: record.bulkMeterImageUrl,
            signed: record.signed,
            signature_svg_snapshot: record.signatureSvgSnapshot,
            status: record.status,
            tehsil: system?.tehsil ?? null,
            village: system?.village ?? null,
            settlement: system?.settlement ?? null,
            bulk_meter_installed: system?.bulkMeterInstalled ?? null,
        };
    }
    async updateWaterDraft(userId, recordId, data) {
        const record = await this.waterLogRepo.findOne({ where: { id: recordId } });
        if (!record) {
            throw new common_1.NotFoundException({ error: 'Record not found' });
        }
        const u = await this.userService.getUserById(userId);
        if (this.rbac.userRoleCode(u) !== this.rbac.USER) {
            throw new common_1.ForbiddenException({
                error: 'Only tubewell operators can edit water logs',
            });
        }
        if (!submission_constants_1.WATER_LOG_OPERATOR_EDITABLE.has(record.status)) {
            throw new common_1.BadRequestException({
                error: 'Only drafted or reverted_back rows can be edited',
            });
        }
        const system = await this.waterSystemRepo.findOne({
            where: { id: record.waterSystemId },
        });
        try {
            await this.tehsilAccess.assertUserMayViewOrLogWaterSystem(u, system);
        }
        catch {
            throw new common_1.ForbiddenException({ error: 'Access denied' });
        }
        this.pumpTimesService.applyPumpTimeFieldsFromPayload(record, data);
        const noBulkMeter = system.bulkMeterInstalled === false;
        let meterEnd;
        let meterStart;
        let legacyTotal;
        try {
            meterEnd = this.operatorHelpers.coerceOptionalFloat(data.meter_reading_end);
        }
        catch (ve) {
            throw new common_1.BadRequestException({
                error: `Invalid meter_reading_end: ${ve}`,
            });
        }
        try {
            meterStart = this.operatorHelpers.coerceOptionalFloat(data.meter_reading_start);
        }
        catch (ve) {
            throw new common_1.BadRequestException({
                error: `Invalid meter_reading_start: ${ve}`,
            });
        }
        try {
            legacyTotal = this.operatorHelpers.coerceOptionalFloat(data.total_water_pumped);
        }
        catch (ve) {
            throw new common_1.BadRequestException({
                error: `Invalid total_water_pumped: ${ve}`,
            });
        }
        if ('meter_reading_end' in data ||
            'meter_reading_start' in data ||
            'total_water_pumped' in data) {
            try {
                await this.waterMeterVolumeService.applyBulkMeterFields({
                    record,
                    waterSystemId: String(system.id),
                    noBulkMeterInstalled: noBulkMeter,
                    meterReadingEnd: meterEnd,
                    meterReadingStart: meterStart,
                    legacyTotalWaterPumped: legacyTotal,
                    excludeRecordId: String(record.id),
                });
            }
            catch (ve) {
                this.throwBulkMeterError(ve);
            }
        }
        if ('year' in data || 'month' in data || 'day' in data) {
            const y = data.year ?? (0, date_util_1.getCalendarYear)(record.logDate);
            const m = data.month ?? (0, date_util_1.getCalendarMonth)(record.logDate);
            const d = data.day ?? (0, date_util_1.getCalendarDay)(record.logDate);
            if (y === null || y === undefined || m === null || m === undefined) {
                throw new common_1.BadRequestException({
                    error: 'year and month are required to update period',
                });
            }
            try {
                const yi = Number(y);
                const mi = Number(m);
                let di;
                if (d === null || d === undefined) {
                    const today = new Date();
                    if (yi === today.getFullYear() && mi === today.getMonth() + 1) {
                        di = Math.min(today.getDate(), this.daysInMonth(yi, mi));
                    }
                    else {
                        di = 1;
                    }
                }
                else {
                    di = Number(d);
                }
                const last = this.daysInMonth(yi, mi);
                if (di < 1 || di > last) {
                    throw new common_1.BadRequestException({
                        error: `day must be between 1 and ${last}`,
                    });
                }
                record.logDate = new Date(yi, mi - 1, di);
            }
            catch (e) {
                if (e instanceof common_1.HttpException)
                    throw e;
                throw new common_1.BadRequestException({
                    error: 'Invalid year, month, or day',
                });
            }
        }
        if (record.pumpStartTime != null && record.pumpEndTime != null) {
            const conflict = await this.waterLogRepo.findOne({
                where: {
                    id: (0, typeorm_2.Not)(record.id),
                    waterSystemId: record.waterSystemId,
                    logDate: record.logDate,
                    pumpStartTime: record.pumpStartTime,
                    pumpEndTime: record.pumpEndTime,
                },
            });
            if (conflict) {
                throw new common_1.BadRequestException({
                    error: 'Duplicate interval',
                    message: 'A log already exists for this day with the same pump start/end time.',
                });
            }
        }
        await this.waterLogRepo.save(record);
        return { message: 'Draft updated successfully', id: String(record.id) };
    }
    async submitWaterDraft(userId, recordId) {
        const record = await this.waterLogRepo.findOne({ where: { id: recordId } });
        if (!record) {
            throw new common_1.NotFoundException({ error: 'Record not found' });
        }
        const u = await this.userService.getUserById(userId);
        if (this.rbac.userRoleCode(u) !== this.rbac.USER) {
            throw new common_1.ForbiddenException({
                error: 'Only tubewell operators can submit water logs',
            });
        }
        this.requireOperatorSignature(u);
        if (!submission_constants_1.WATER_LOG_OPERATOR_EDITABLE.has(record.status)) {
            throw new common_1.BadRequestException({
                error: 'Only drafted or reverted_back rows can be submitted',
            });
        }
        const system = await this.waterSystemRepo.findOne({
            where: { id: record.waterSystemId },
        });
        try {
            await this.tehsilAccess.assertUserMayViewOrLogWaterSystem(u, system);
        }
        catch {
            throw new common_1.ForbiddenException({ error: 'Access denied' });
        }
        const noBulkMeter = system.bulkMeterInstalled === false;
        if (!noBulkMeter) {
            if (record.logDate == null || record.pumpEndTime == null) {
                throw new common_1.BadRequestException({
                    error: 'log_date and pump_end_time are required before submit',
                });
            }
            try {
                await this.waterMeterVolumeService.applyBulkMeterFields({
                    record,
                    waterSystemId: String(system.id),
                    noBulkMeterInstalled: false,
                    meterReadingEnd: record.meterReadingEnd,
                    meterReadingStart: record.meterReadingStart,
                    legacyTotalWaterPumped: record.totalWaterPumped,
                    excludeRecordId: String(record.id),
                });
            }
            catch (ve) {
                this.throwBulkMeterError(ve);
            }
        }
        record.status = submission_constants_1.SUBMISSION_STATUS_SUBMITTED;
        record.signed = true;
        record.signatureSvgSnapshot = this.signatureSvgOrNone(u);
        const existingSub = await this.submissionRepo.findOne({
            where: { recordId: String(record.id) },
        });
        const currentUser = await this.userRepo.findOne({ where: { id: userId } });
        if (!existingSub) {
            const submission = await this.submissionRepo.save(this.submissionRepo.create({
                operatorId: userId,
                submissionType: 'water_system',
                recordId: String(record.id),
                status: submission_constants_1.SUBMISSION_STATUS_SUBMITTED,
                submittedAt: new Date(),
            }));
            await this.workflowService.logVerificationAction(submission.id, 'submit', userId, this.rbac.userRoleCode(currentUser), `Water data for ${(0, date_util_1.getCalendarMonth)(record.logDate)}/${(0, date_util_1.getCalendarYear)(record.logDate)} submitted from draft`);
            const details = `New Monthly Water Report (${(0, date_util_1.getCalendarMonth)(record.logDate)}/${(0, date_util_1.getCalendarYear)(record.logDate)}) submitted by ${currentUser.name}.\n` +
                `Location: ${system.tehsil}, ${system.village} ${system.settlement || ''}\n` +
                `Pump Operating Hours: ${record.pumpOperatingHours ?? 'N/A'}\n` +
                `Total Water Pumped: ${record.totalWaterPumped ?? 'N/A'}`;
            await this.workflowService.notifyAnalysts('New Detailed Water Submission', details, submission.id, system.tehsil);
        }
        else {
            if ([
                submission_constants_1.SUBMISSION_STATUS_REJECTED,
                submission_constants_1.SUBMISSION_STATUS_REVERTED_BACK,
                submission_constants_1.SUBMISSION_STATUS_DRAFTED,
            ].includes(existingSub.status)) {
                existingSub.status = submission_constants_1.SUBMISSION_STATUS_SUBMITTED;
                existingSub.submittedAt = new Date();
                await this.submissionRepo.save(existingSub);
            }
            else if (existingSub.status === submission_constants_1.SUBMISSION_STATUS_SUBMITTED) {
                throw new common_1.BadRequestException({
                    error: 'This record is already submitted',
                });
            }
            else if (existingSub.status === submission_constants_1.SUBMISSION_STATUS_ACCEPTED) {
                throw new common_1.BadRequestException({
                    error: 'This record is already accepted',
                });
            }
        }
        await this.waterLogRepo.save(record);
        return {
            message: 'Data submitted for verification',
            id: String(record.id),
            status: record.status,
        };
    }
    async deleteWaterDraft(userId, recordId) {
        const u = await this.userService.getUserById(userId);
        if (this.rbac.userRoleCode(u) !== this.rbac.USER) {
            throw new common_1.ForbiddenException({
                error: 'Only tubewell operators can delete water drafts',
            });
        }
        const record = await this.waterLogRepo.findOne({ where: { id: recordId } });
        if (!record) {
            throw new common_1.NotFoundException({ error: 'Record not found' });
        }
        if (record.status !== submission_constants_1.SUBMISSION_STATUS_DRAFTED) {
            throw new common_1.BadRequestException({
                error: 'Only drafted rows can be deleted',
            });
        }
        const system = await this.waterSystemRepo.findOne({
            where: { id: record.waterSystemId },
        });
        if (!system) {
            throw new common_1.ForbiddenException({ error: 'Access denied' });
        }
        try {
            await this.tehsilAccess.assertUserMayViewOrLogWaterSystem(u, system);
        }
        catch {
            throw new common_1.ForbiddenException({ error: 'Access denied' });
        }
        await this.waterLogRepo.remove(record);
        return { message: 'Draft deleted successfully' };
    }
    async getWaterSupplyData(userId, query) {
        const user = await this.userService.getUserById(userId);
        const { tehsil, village, settlement = '', system_id: systemIdRaw, year, } = query;
        const systemId = (systemIdRaw || '').trim() || undefined;
        let system = null;
        if (systemId) {
            system = await this.waterSystemRepo.findOne({ where: { id: systemId } });
        }
        else {
            if (!tehsil || !village) {
                throw new common_1.BadRequestException({
                    message: 'system_id or tehsil+village is required',
                });
            }
            const ct = (0, tehsils_1.canonicalTehsil)(tehsil);
            if (!ct) {
                throw new common_1.BadRequestException({ message: 'Invalid tehsil' });
            }
            try {
                await this.tehsilAccess.assertUserMayAccessTehsil(user, ct);
            }
            catch {
                throw new common_1.ForbiddenException({
                    message: 'Access denied for this tehsil',
                });
            }
            if (settlement) {
                system = await this.waterSystemRepo.findOne({
                    where: { tehsil: ct, village, settlement },
                });
            }
            else {
                system = await this.waterSystemRepo
                    .createQueryBuilder('ws')
                    .where('ws.tehsil = :ct', { ct })
                    .andWhere('ws.village = :village', { village })
                    .andWhere('(ws.settlement IS NULL OR ws.settlement = :empty)', {
                    empty: '',
                })
                    .getOne();
            }
        }
        if (!system) {
            return [];
        }
        try {
            await this.tehsilAccess.assertUserMayLogWaterSystem(user, system);
        }
        catch {
            throw new common_1.ForbiddenException({
                message: 'Access denied for this water system',
            });
        }
        let qb = this.waterLogRepo
            .createQueryBuilder('log')
            .where('log.waterSystemId = :sid', { sid: system.id });
        qb = this.applyWaterLogYearFilter(qb, year);
        const records = await qb.orderBy('log.logDate', 'ASC').getMany();
        return records.map((r) => this.waterLogToJson(r));
    }
    async saveWaterSupplyData(userId, body) {
        const rawRows = body?.data;
        let rows;
        if (rawRows === undefined || rawRows === null) {
            rows = [];
        }
        else if (!Array.isArray(rawRows)) {
            throw new common_1.BadRequestException({
                message: 'Invalid payload',
                errors: ['data must be a JSON array'],
            });
        }
        else {
            rows = rawRows;
        }
        const yearRaw = body?.year ?? new Date().getFullYear();
        let year;
        try {
            year = Number(yearRaw);
            if (!Number.isFinite(year))
                throw new Error('not finite');
        }
        catch {
            throw new common_1.BadRequestException({
                message: 'Invalid year',
                errors: ['year must be an integer'],
            });
        }
        const status = (0, submission_constants_1.normalizeWaterSubmissionStatus)(body?.status);
        const imageUrl = body?.image_url || body?.image_path;
        if (!rows.length) {
            throw new common_1.BadRequestException({ message: 'No data provided' });
        }
        const savedRecordIds = [];
        const savedIds = [];
        const errors = [];
        const opUser = await this.userService.getUserById(userId);
        if (status === submission_constants_1.SUBMISSION_STATUS_SUBMITTED) {
            this.requireOperatorSignature(opUser);
        }
        await this.dataSource.transaction(async (manager) => {
            const waterLogRepo = manager.getRepository(water_energy_logging_daily_entity_1.WaterEnergyLoggingDaily);
            const waterSystemRepo = manager.getRepository(water_system_entity_1.WaterSystem);
            const submissionRepo = manager.getRepository(submission_entity_1.Submission);
            const userRepo = manager.getRepository(user_entity_1.User);
            for (let i = 0; i < rows.length; i++) {
                try {
                    const row = rows[i];
                    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
                        errors.push(`Row ${i + 1}: each data item must be an object`);
                        continue;
                    }
                    const rowObj = row;
                    const tehsilRaw = rowObj.tehsil;
                    let village;
                    if (typeof rowObj.village === 'string') {
                        village = rowObj.village.trim();
                    }
                    else if (typeof rowObj.village === 'number') {
                        village = String(rowObj.village).trim();
                    }
                    else if (rowObj.village != null) {
                        errors.push(`Row ${i + 1}: village must be a string`);
                        continue;
                    }
                    let settlement = rowObj.settlement ?? '';
                    if (typeof settlement === 'string') {
                        settlement = settlement.trim();
                    }
                    else if (settlement != null) {
                        settlement = String(settlement).trim();
                    }
                    else {
                        settlement = '';
                    }
                    const monthlyData = rowObj.monthlyData;
                    if (!Array.isArray(monthlyData)) {
                        errors.push(`Row ${i + 1}: monthlyData must be an array`);
                        continue;
                    }
                    if (!village) {
                        errors.push(`Row ${i + 1}: missing village`);
                        continue;
                    }
                    let tehsilStr = '';
                    if (typeof tehsilRaw === 'string') {
                        tehsilStr = tehsilRaw.trim();
                    }
                    else if (typeof tehsilRaw === 'number') {
                        tehsilStr = String(tehsilRaw);
                    }
                    else {
                        errors.push(`Row ${i + 1}: invalid tehsil`);
                        continue;
                    }
                    const ct = (0, tehsils_1.canonicalTehsil)(tehsilStr);
                    if (!ct) {
                        errors.push(`Row ${i + 1}: invalid tehsil`);
                        continue;
                    }
                    try {
                        await this.tehsilAccess.assertUserMayAccessTehsil(opUser, ct, {
                            forWrite: true,
                        });
                    }
                    catch {
                        errors.push(`Row ${i + 1}: tehsil not permitted for your account`);
                        continue;
                    }
                    let system;
                    if (settlement) {
                        system = await waterSystemRepo.findOne({
                            where: { tehsil: ct, village, settlement },
                        });
                    }
                    else {
                        system = await waterSystemRepo
                            .createQueryBuilder('ws')
                            .where('ws.tehsil = :ct', { ct })
                            .andWhere('ws.village = :village', { village })
                            .andWhere('(ws.settlement IS NULL OR ws.settlement = :empty)', {
                            empty: '',
                        })
                            .getOne();
                    }
                    if (!system) {
                        errors.push(`Row ${i + 1}: No water system for this location — your tehsil manager must register it first`);
                        continue;
                    }
                    try {
                        await this.tehsilAccess.assertUserMayLogWaterSystem(opUser, system);
                    }
                    catch {
                        errors.push(`Row ${i + 1}: this water system is not assigned to your account`);
                        continue;
                    }
                    const noBulkMeterInstalled = system.bulkMeterInstalled === false;
                    for (const monthRecord of monthlyData) {
                        if (typeof monthRecord !== 'object' ||
                            monthRecord === null ||
                            Array.isArray(monthRecord)) {
                            errors.push(`Row ${i + 1}: each monthlyData item must be an object`);
                            continue;
                        }
                        const mr = monthRecord;
                        const month = mr.month;
                        let pumpHours;
                        let meterEnd;
                        let meterStart;
                        let totalWater;
                        try {
                            pumpHours = this.operatorHelpers.coerceOptionalFloat(mr.pump_operating_hours);
                            meterEnd = this.operatorHelpers.coerceOptionalFloat(mr.meter_reading_end);
                            meterStart = this.operatorHelpers.coerceOptionalFloat(mr.meter_reading_start);
                            totalWater = this.operatorHelpers.coerceOptionalFloat(mr.total_water_pumped);
                        }
                        catch (ve) {
                            errors.push(`Row ${i + 1}: invalid number in monthlyData (${ve})`);
                            continue;
                        }
                        if (month === null || month === undefined) {
                            errors.push(`Row ${i + 1}: missing month in monthlyData`);
                            throw new Error('missing month');
                        }
                        let yi;
                        let mi;
                        try {
                            yi = Number(year);
                            mi = Number(month);
                        }
                        catch {
                            errors.push(`Row ${i + 1}: invalid year or month in monthlyData`);
                            throw new Error('invalid date');
                        }
                        const dayRaw = mr.day;
                        const today = new Date();
                        let day;
                        if (dayRaw === null ||
                            dayRaw === undefined ||
                            (typeof dayRaw === 'string' && !dayRaw.trim())) {
                            if (yi === today.getFullYear() && mi === today.getMonth() + 1) {
                                day = Math.min(today.getDate(), this.daysInMonth(yi, mi));
                            }
                            else {
                                day = 1;
                            }
                        }
                        else {
                            try {
                                day = Number(dayRaw);
                            }
                            catch {
                                errors.push(`Row ${i + 1}: invalid day in monthlyData`);
                                throw new Error('invalid day');
                            }
                        }
                        const last = this.daysInMonth(yi, mi);
                        if (day < 1 || day > last) {
                            errors.push(`Row ${i + 1}: day must be between 1 and ${last} for this month`);
                            throw new Error('invalid day range');
                        }
                        let logD;
                        try {
                            logD = new Date(yi, mi - 1, day);
                        }
                        catch {
                            errors.push(`Row ${i + 1}: invalid log date`);
                            throw new Error('invalid date');
                        }
                        const startTime = this.pumpTimesService.parseTimeOfDay(mr.pump_start_time);
                        const endTime = this.pumpTimesService.parseTimeOfDay(mr.pump_end_time);
                        if (startTime === null || endTime === null) {
                            errors.push(`Row ${i + 1}: pump_start_time and pump_end_time are required and must be valid times`);
                            continue;
                        }
                        if (noBulkMeterInstalled) {
                            totalWater = null;
                            meterEnd = null;
                            meterStart = null;
                        }
                        const duplicateInterval = await waterLogRepo.findOne({
                            where: {
                                waterSystemId: system.id,
                                logDate: logD,
                                pumpStartTime: startTime,
                                pumpEndTime: endTime,
                            },
                        });
                        if (duplicateInterval) {
                            errors.push(`Row ${i + 1}: duplicate log interval for this system/day (same pump_start_time and pump_end_time)`);
                            continue;
                        }
                        const newRecord = waterLogRepo.create({
                            waterSystemId: system.id,
                            logDate: logD,
                            status,
                            bulkMeterImageUrl: noBulkMeterInstalled ? null : imageUrl,
                            signed: status === submission_constants_1.SUBMISSION_STATUS_SUBMITTED,
                            signatureSvgSnapshot: status === submission_constants_1.SUBMISSION_STATUS_SUBMITTED
                                ? this.signatureSvgOrNone(opUser)
                                : null,
                        });
                        this.pumpTimesService.applyPumpTimeFieldsFromPayload(newRecord, mr);
                        if (newRecord.pumpStartTime == null &&
                            newRecord.pumpEndTime == null &&
                            pumpHours != null) {
                            newRecord.pumpOperatingHours = pumpHours;
                        }
                        try {
                            await this.waterMeterVolumeService.applyBulkMeterFields({
                                record: newRecord,
                                waterSystemId: String(system.id),
                                noBulkMeterInstalled,
                                meterReadingEnd: meterEnd,
                                meterReadingStart: meterStart,
                                legacyTotalWaterPumped: totalWater,
                            });
                        }
                        catch (ve) {
                            errors.push(`Row ${i + 1}: ${ve}`);
                            continue;
                        }
                        const saved = await waterLogRepo.save(newRecord);
                        savedRecordIds.push(String(saved.id));
                        if (status === submission_constants_1.SUBMISSION_STATUS_SUBMITTED) {
                            const rec = saved;
                            const recordIdToLink = String(rec.id);
                            const existingSub = await submissionRepo.findOne({
                                where: { recordId: recordIdToLink },
                            });
                            if (!existingSub) {
                                const currentUser = await userRepo.findOne({
                                    where: { id: userId },
                                });
                                const submission = await submissionRepo.save(submissionRepo.create({
                                    operatorId: userId,
                                    submissionType: 'water_system',
                                    recordId: recordIdToLink,
                                    status: submission_constants_1.SUBMISSION_STATUS_SUBMITTED,
                                    submittedAt: new Date(),
                                }));
                                await this.workflowService.logVerificationAction(submission.id, 'submit', userId, this.rbac.userRoleCode(currentUser), `Water data for ${mi}/${yi} submitted via form`);
                                const details = `New Monthly Water Report (${mi}/${yi}) submitted by ${currentUser.name}.\n` +
                                    `Location: ${system.tehsil}, ${system.village} ${system.settlement || ''}\n` +
                                    `Pump Operating Hours: ${rec.pumpOperatingHours ?? 'N/A'}\n` +
                                    `Meter reading (stop): ${rec.meterReadingEnd ?? 'N/A'}\n` +
                                    `Water pumped this interval: ${rec.totalWaterPumped ?? 'N/A'} m³`;
                                await this.workflowService.notifyAnalysts('New Detailed Water Submission', details, submission.id, system.tehsil);
                            }
                            else if ([
                                submission_constants_1.SUBMISSION_STATUS_REJECTED,
                                submission_constants_1.SUBMISSION_STATUS_REVERTED_BACK,
                                submission_constants_1.SUBMISSION_STATUS_DRAFTED,
                            ].includes(existingSub.status)) {
                                existingSub.status = submission_constants_1.SUBMISSION_STATUS_SUBMITTED;
                                existingSub.submittedAt = new Date();
                                await submissionRepo.save(existingSub);
                            }
                        }
                    }
                    if (rowObj.remarks) {
                        let remarksQb = waterLogRepo
                            .createQueryBuilder('log')
                            .where('log.waterSystemId = :sid', { sid: system.id });
                        remarksQb = this.applyWaterLogYearFilter(remarksQb, year);
                        const firstRecord = await remarksQb
                            .orderBy('log.logDate', 'ASC')
                            .getOne();
                        if (firstRecord) {
                            firstRecord.remarks = rowObj.remarks;
                            await waterLogRepo.save(firstRecord);
                        }
                    }
                    savedIds.push(String(system.id));
                }
                catch (e) {
                    errors.push(`Row ${i + 1}: ${String(e)}`);
                }
            }
            if (errors.length) {
                throw new common_1.BadRequestException({
                    message: 'Validation errors',
                    errors,
                });
            }
        });
        return {
            message: `Saved data for ${savedIds.length} location(s) as ${status}`,
            ids: savedIds,
            record_ids: savedRecordIds,
        };
    }
    throwBulkMeterError(exc) {
        if (exc instanceof water_meter_volume_service_1.MeterReadingOrderError) {
            throw new common_1.BadRequestException({
                error: exc.message,
                code: exc.code,
            });
        }
        if (exc instanceof Error) {
            throw new common_1.BadRequestException({ error: exc.message });
        }
        throw exc;
    }
    applyWaterLogYearFilter(qb, year) {
        if (year === undefined || year === null) {
            return qb;
        }
        const start = new Date(year, 0, 1);
        const end = new Date(year + 1, 0, 1);
        return qb
            .andWhere('log.logDate >= :yearStart', { yearStart: start })
            .andWhere('log.logDate < :yearEnd', { yearEnd: end });
    }
    async findWaterSystemByLocation(ct, village, settlement) {
        if (settlement) {
            return this.waterSystemRepo.findOne({
                where: { tehsil: ct, village, settlement },
            });
        }
        return this.waterSystemRepo
            .createQueryBuilder('ws')
            .where('ws.tehsil = :ct', { ct })
            .andWhere('ws.village = :village', { village })
            .andWhere('(ws.settlement IS NULL OR ws.settlement = :empty)', {
            empty: '',
        })
            .getOne();
    }
    waterLogToJson(record) {
        return {
            id: String(record.id),
            year: (0, date_util_1.getCalendarYear)(record.logDate),
            month: (0, date_util_1.getCalendarMonth)(record.logDate),
            day: (0, date_util_1.getCalendarDay)(record.logDate),
            pump_start_time: this.pumpTimesService.timeToJson(record.pumpStartTime),
            pump_end_time: this.pumpTimesService.timeToJson(record.pumpEndTime),
            pump_operating_hours: record.pumpOperatingHours,
            meter_reading_start: record.meterReadingStart,
            meter_reading_end: record.meterReadingEnd,
            total_water_pumped: record.totalWaterPumped,
            bulk_meter_image_url: record.bulkMeterImageUrl,
            status: record.status,
            remarks: record.remarks,
        };
    }
    signaturePayloadOk(value) {
        if (typeof value !== 'string') {
            return false;
        }
        const v = value.trim();
        if (!v) {
            return false;
        }
        return v.length <= 150_000;
    }
    requireOperatorSignature(user) {
        if (!user || this.rbac.userRoleCode(user) !== this.rbac.USER) {
            throw new common_1.ForbiddenException({
                error: 'Only tubewell operators can perform this action',
            });
        }
        const sig = user.signatureSvg;
        if (!sig || !String(sig).trim()) {
            throw new common_1.BadRequestException({
                error: 'Signature required',
                message: 'Please add your signature before submitting a water log.',
            });
        }
    }
    signatureSvgOrNone(user) {
        const sig = user.signatureSvg;
        if (sig && String(sig).trim()) {
            return String(sig).trim();
        }
        return null;
    }
    meterHistoryPayload(meters, meterType) {
        const rows = (meters || []).filter((m) => m.meterType === meterType);
        rows.sort((a, b) => {
            const aCreated = a.createdAt?.getTime() ?? 0;
            const bCreated = b.createdAt?.getTime() ?? 0;
            if (bCreated !== aCreated)
                return bCreated - aCreated;
            return String(b.id).localeCompare(String(a.id));
        });
        const out = [];
        for (const meter of rows) {
            const payload = this.operatorHelpers.meterToDict(meter);
            if (payload !== null) {
                out.push(payload);
            }
        }
        return out;
    }
    getActiveMeter(system) {
        const meters = system.meters || [];
        const sorted = [...meters].sort((a, b) => {
            const aCreated = a.createdAt?.getTime() ?? 0;
            const bCreated = b.createdAt?.getTime() ?? 0;
            if (bCreated !== aCreated)
                return bCreated - aCreated;
            return String(b.id).localeCompare(String(a.id));
        });
        return (sorted.find((m) => m.isActive && m.meterType === submission_constants_1.METER_TYPE_TUBEWELL) ??
            null);
    }
    waterSystemToJson(s) {
        const activeMeter = this.getActiveMeter(s);
        return {
            id: String(s.id),
            tehsil: s.tehsil,
            village: s.village,
            settlement: s.settlement,
            unique_identifier: s.uniqueIdentifier,
            latitude: s.latitude ?? null,
            longitude: s.longitude ?? null,
            pump_model: s.pumpModel,
            bulk_meter_installed: s.bulkMeterInstalled ?? null,
            meter_model: activeMeter?.meterModel ?? null,
            meter_serial_number: activeMeter?.meterSerialNumber ?? null,
            meter_accuracy_class: activeMeter?.meterAccuracyClass ?? null,
            installation_date: (0, date_util_1.toIsoDateString)(activeMeter?.installationDate),
            current_meter: this.operatorHelpers.meterToDict(activeMeter),
            meters: this.meterHistoryPayload(s.meters, submission_constants_1.METER_TYPE_TUBEWELL),
            created_at: (0, date_util_1.toIsoDateTimeString)(s.createdAt),
            updated_at: (0, date_util_1.toIsoDateTimeString)(s.updatedAt),
        };
    }
    daysInMonth(year, month) {
        return new Date(year, month, 0).getDate();
    }
    parseIsoDate(raw) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
        if (!match)
            return null;
        const y = Number(match[1]);
        const m = Number(match[2]);
        const d = Number(match[3]);
        const dt = new Date(y, m - 1, d);
        if (dt.getFullYear() !== y ||
            dt.getMonth() !== m - 1 ||
            dt.getDate() !== d) {
            return null;
        }
        return dt;
    }
};
exports.TubewellOperatorService = TubewellOperatorService;
exports.TubewellOperatorService = TubewellOperatorService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(water_system_entity_1.WaterSystem)),
    __param(1, (0, typeorm_1.InjectRepository)(water_energy_logging_daily_entity_1.WaterEnergyLoggingDaily)),
    __param(2, (0, typeorm_1.InjectRepository)(solar_system_entity_1.SolarSystem)),
    __param(3, (0, typeorm_1.InjectRepository)(solar_energy_logging_monthly_entity_1.SolarEnergyLoggingMonthly)),
    __param(4, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(5, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __param(6, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        user_service_1.UserService,
        storage_service_1.StorageService,
        workflow_service_1.WorkflowService,
        notifications_service_1.NotificationsService,
        water_submission_detail_service_1.WaterSubmissionDetailService,
        water_meter_volume_service_1.WaterMeterVolumeService,
        pump_times_service_1.PumpTimesService,
        operator_helpers_service_1.OperatorHelpersService,
        tehsil_access_service_1.TehsilAccessService,
        rbac_service_1.RbacService])
], TubewellOperatorService);
//# sourceMappingURL=tubewell-operator.service.js.map