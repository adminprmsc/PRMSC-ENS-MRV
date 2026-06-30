import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import { SolarSystem } from '../../infrastructure/database/entities/solar-system.entity';
import { SolarEnergyLoggingMonthly } from '../../infrastructure/database/entities/solar-energy-logging-monthly.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { Submission } from '../../infrastructure/database/entities/submission.entity';
import { SystemMeter } from '../../infrastructure/database/entities/system-meter.entity';
import {
  METER_TYPE_TUBEWELL,
  SUBMISSION_STATUS_ACCEPTED,
  SUBMISSION_STATUS_DRAFTED,
  SUBMISSION_STATUS_REJECTED,
  SUBMISSION_STATUS_REVERTED_BACK,
  SUBMISSION_STATUS_SUBMITTED,
  WATER_LOG_OPERATOR_EDITABLE,
  normalizeWaterSubmissionStatus,
} from '../../domain/constants/submission.constants';
import { canonicalTehsil } from '../../domain/constants/tehsils';
import {
  getCalendarDay,
  getCalendarMonth,
  getCalendarYear,
  toIsoDateString,
  toIsoDateTimeString,
} from '../../domain/utils/date.util';
import { UserService } from './user.service';
import { StorageService } from './storage.service';
import { WorkflowService } from './workflow.service';
import { NotificationsService } from './notifications.service';
import { WaterSubmissionDetailService } from './water-submission-detail.service';
import {
  MeterReadingOrderError,
  WaterMeterVolumeService,
} from './water-meter-volume.service';
import { PumpTimesService } from './pump-times.service';
import { OperatorHelpersService } from './operator-helpers.service';
import { TehsilAccessService } from './tehsil-access.service';
import { RbacService } from './rbac.service';

@Injectable()
export class TubewellOperatorService {
  constructor(
    @InjectRepository(WaterSystem)
    private readonly waterSystemRepo: Repository<WaterSystem>,
    @InjectRepository(WaterEnergyLoggingDaily)
    private readonly waterLogRepo: Repository<WaterEnergyLoggingDaily>,
    @InjectRepository(SolarSystem)
    private readonly solarSystemRepo: Repository<SolarSystem>,
    @InjectRepository(SolarEnergyLoggingMonthly)
    private readonly solarLogRepo: Repository<SolarEnergyLoggingMonthly>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
    private readonly storageService: StorageService,
    private readonly workflowService: WorkflowService,
    private readonly notificationsService: NotificationsService,
    private readonly waterSubmissionDetailService: WaterSubmissionDetailService,
    private readonly waterMeterVolumeService: WaterMeterVolumeService,
    private readonly pumpTimesService: PumpTimesService,
    private readonly operatorHelpers: OperatorHelpersService,
    private readonly tehsilAccess: TehsilAccessService,
    private readonly rbac: RbacService,
  ) {}

  // ── Notifications ──────────────────────────────────────────────────────

  getNotifications(userId: string) {
    return this.notificationsService.getNotificationsResponse(userId);
  }

  markNotificationRead(userId: string, notificationId: string) {
    return this.notificationsService.markNotificationReadResponse(
      userId,
      notificationId,
    );
  }

  markAllNotificationsRead(userId: string) {
    return this.notificationsService.markAllNotificationsReadResponse(userId);
  }

  // ── Submit for verification ──────────────────────────────────────────────

  async submitDataForVerification(
    userId: string,
    body: { record_id?: string },
  ) {
    const currentUser = await this.userRepo.findOne({ where: { id: userId } });
    if (!currentUser) {
      throw new NotFoundException({ error: 'User not found' });
    }

    if (this.rbac.userRoleCode(currentUser) !== this.rbac.USER) {
      throw new ForbiddenException({
        error: 'Only tubewell operators can submit data',
      });
    }

    this.requireOperatorSignature(currentUser);

    const recordId = body?.record_id;
    if (!recordId) {
      throw new BadRequestException({ error: 'record_id is required' });
    }

    const submissionType = 'water_system';

    const record = await this.waterLogRepo.findOne({ where: { id: recordId } });
    if (!record) {
      throw new NotFoundException({ error: 'Water data record not found' });
    }

    record.signed = true;
    record.signatureSvgSnapshot = this.signatureSvgOrNone(currentUser);

    let submission = await this.submissionRepo.findOne({
      where: { recordId },
    });

    if (submission) {
      if (submission.status === SUBMISSION_STATUS_SUBMITTED) {
        throw new BadRequestException({
          error: 'This record is already submitted',
        });
      }
      if (submission.status === SUBMISSION_STATUS_ACCEPTED) {
        throw new BadRequestException({
          error: 'This record is already accepted',
        });
      }
      if (
        ![
          SUBMISSION_STATUS_REJECTED,
          SUBMISSION_STATUS_REVERTED_BACK,
          SUBMISSION_STATUS_DRAFTED,
        ].includes(submission.status)
      ) {
        throw new BadRequestException({
          error: `Cannot resubmit from status ${submission.status}`,
        });
      }
      submission.status = SUBMISSION_STATUS_SUBMITTED;
      submission.submittedAt = new Date();
      submission.reviewedAt = null;
      submission.reviewedBy = null;
      submission.remarks = null;
      await this.submissionRepo.save(submission);
    } else {
      submission = this.submissionRepo.create({
        operatorId: userId,
        submissionType,
        recordId,
        status: SUBMISSION_STATUS_SUBMITTED,
        submittedAt: new Date(),
      });
      submission = await this.submissionRepo.save(submission);
    }

    record.status = SUBMISSION_STATUS_SUBMITTED;
    await this.waterLogRepo.save(record);

    await this.workflowService.logVerificationAction(
      submission.id,
      'submit',
      userId,
      this.rbac.userRoleCode(currentUser),
      'Data submitted for verification',
    );

    const system = await this.waterSystemRepo.findOne({
      where: { id: record.waterSystemId },
    });

    const details =
      `New Monthly Water Report (${getCalendarMonth(record.logDate)}/${getCalendarYear(record.logDate)}) submitted by ${currentUser.name}.\n` +
      `Location: ${system?.tehsil}, ${system?.village} ${system?.settlement || ''}\n` +
      `Pump Operating Hours: ${record.pumpOperatingHours ?? 'N/A'}\n` +
      `Total Water Pumped: ${record.totalWaterPumped ?? 'N/A'}`;

    await this.workflowService.notifyAnalysts(
      'New Detailed Water Submission',
      details,
      submission.id,
      system?.tehsil,
    );

    return {
      message: 'Data submitted successfully',
      submission: {
        id: submission.id,
        submission_type: submission.submissionType,
        status: submission.status,
        submitted_at: toIsoDateTimeString(submission.submittedAt),
      },
    };
  }

  // ── My submissions ─────────────────────────────────────────────────────

  async getMySubmissions(userId: string, status?: string) {
    const where: Record<string, unknown> = {
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
      let systemInfo: Record<string, unknown> = {};
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
            year: getCalendarYear(record.logDate),
            month: getCalendarMonth(record.logDate),
          };
        }
      }

      result.push({
        id: sub.id,
        record_id: sub.recordId,
        submission_type: sub.submissionType,
        status: sub.status,
        submitted_at: toIsoDateTimeString(sub.submittedAt),
        reviewed_at: toIsoDateTimeString(sub.reviewedAt),
        approved_at: toIsoDateTimeString(sub.approvedAt),
        remarks: sub.remarks,
        system_info: systemInfo,
      });
    }

    return { submissions: result };
  }

  // ── Signature ──────────────────────────────────────────────────────────

  async getOperatorSignature(userId: string) {
    const u = await this.userService.getUserById(userId);
    if (!u) {
      throw new NotFoundException({ message: 'User not found' });
    }
    if (this.rbac.userRoleCode(u) !== this.rbac.USER) {
      throw new ForbiddenException({
        message: 'Only tubewell operators can access signature',
      });
    }
    return { signature_svg: u.signatureSvg };
  }

  async putOperatorSignature(
    userId: string,
    body: { signature_svg?: unknown },
  ) {
    const u = await this.userService.getUserById(userId);
    if (!u) {
      throw new NotFoundException({ message: 'User not found' });
    }
    if (this.rbac.userRoleCode(u) !== this.rbac.USER) {
      throw new ForbiddenException({
        message: 'Only tubewell operators can edit signature',
      });
    }
    const svg = body?.signature_svg;
    if (!this.signaturePayloadOk(svg)) {
      throw new BadRequestException({ message: 'Invalid signature_svg' });
    }
    u.signatureSvg = String(svg).trim();
    await this.userRepo.save(u);
    return { message: 'Signature saved' };
  }

  async deleteOperatorSignature(userId: string) {
    const u = await this.userService.getUserById(userId);
    if (!u) {
      throw new NotFoundException({ message: 'User not found' });
    }
    if (this.rbac.userRoleCode(u) !== this.rbac.USER) {
      throw new ForbiddenException({
        message: 'Only tubewell operators can delete signature',
      });
    }
    u.signatureSvg = null;
    await this.userRepo.save(u);
    return { message: 'Signature deleted' };
  }

  // ── Tubewell submission detail ─────────────────────────────────────────

  async getTubewellWaterSubmissionDetail(userId: string, submissionId: string) {
    const currentUser = await this.userRepo.findOne({ where: { id: userId } });
    if (!currentUser) {
      throw new NotFoundException({ error: 'User not found' });
    }
    if (this.rbac.userRoleCode(currentUser) !== this.rbac.USER) {
      throw new ForbiddenException({
        error: 'Only tubewell operators can use this endpoint',
      });
    }

    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
    });
    if (!submission) {
      throw new NotFoundException({ error: 'Submission not found' });
    }
    if (submission.submissionType !== 'water_system') {
      throw new BadRequestException({
        error: 'Only water submissions are supported',
      });
    }
    if (String(submission.operatorId) !== String(userId)) {
      throw new ForbiddenException({ error: 'Access denied' });
    }

    const record = await this.waterLogRepo.findOne({
      where: { id: submission.recordId },
    });
    if (!record) {
      throw new NotFoundException({ error: 'Record not found' });
    }

    const assignedIds = this.tehsilAccess.assignedWaterSystemIdSet(currentUser);
    if (!assignedIds.has(String(record.waterSystemId))) {
      throw new ForbiddenException({ error: 'Access denied' });
    }

    return this.waterSubmissionDetailService.buildWaterSubmissionDetailResponse(
      submission,
    );
  }

  // ── Upload ─────────────────────────────────────────────────────────────

  async uploadImage(
    userId: string,
    file: Express.Multer.File | undefined,
    recordType: string,
    recordId?: string,
  ) {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new NotFoundException({ message: 'User not found' });
    }

    const rt = recordType || 'water';

    if (rt === 'solar' || rt === 'water_calibration') {
      if (this.rbac.userRoleCode(user) !== this.rbac.ADMIN) {
        throw new ForbiddenException({
          message: 'This evidence upload requires tehsil manager role',
        });
      }
    } else {
      if (this.rbac.userRoleCode(user) !== this.rbac.USER) {
        throw new ForbiddenException({
          message: 'Water evidence upload requires tubewell operator role',
        });
      }
      if (!user.assignedWaterSystemIds?.length) {
        throw new ForbiddenException({
          message: 'No water systems assigned — contact your tehsil manager',
        });
      }
    }

    if (!file) {
      throw new BadRequestException({ message: 'No file provided' });
    }

    if (!file.originalname) {
      throw new BadRequestException({ message: 'No file selected' });
    }

    if (!this.operatorHelpers.allowedFile(file.originalname)) {
      throw new BadRequestException({
        message: 'File type not allowed. Use PNG, JPG, JPEG, GIF, or PDF.',
      });
    }

    let folder: string;
    if (rt === 'solar') {
      folder = 'solar-images';
    } else if (rt === 'water_calibration') {
      folder = 'water-calibration-certificates';
    } else {
      folder = 'water-images';
    }

    let uploadResult: {
      public_url: string;
      bucket: string;
      object_key: string;
    };
    try {
      uploadResult = await this.storageService.uploadFileStorage(file, folder);
    } catch (exc) {
      throw new InternalServerErrorException({
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
          } catch {
            throw new ForbiddenException({
              message: 'Access denied for this record',
            });
          }
          record.bulkMeterImageUrl = imageUrl;
          await this.waterLogRepo.save(record);
        }
      } else if (rt === 'solar') {
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
          } catch {
            throw new ForbiddenException({
              message: 'Access denied for this record',
            });
          }
          if ((record.electricityBillImageUrl || '') !== imageUrl) {
            await this.storageService.tryDeletePublicObject(
              record.electricityBillImageUrl,
            );
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

  // ── Water systems ──────────────────────────────────────────────────────

  async getWaterSystems(
    userId: string,
    filterTehsil?: string,
    filterVillage?: string,
  ) {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new NotFoundException({ message: 'User not found' });
    }

    const rk = this.rbac.userRank(user);
    const ts = [...(await this.rbac.userAssignedTehsils(user))];

    let systems: WaterSystem[];

    if (rk >= this.rbac.ROLE_RANK[this.rbac.SUPER_ADMIN]) {
      systems = await this.waterSystemRepo.find({
        relations: { meters: true },
      });
    } else if (this.rbac.userRoleCode(user) === this.rbac.USER) {
      const wids = user.assignedWaterSystemIds;
      if (!wids?.length) {
        return [];
      }
      systems = await this.waterSystemRepo.find({
        where: { id: In(wids) },
        relations: { meters: true },
      });
    } else if (ts.length) {
      systems = await this.waterSystemRepo.find({
        where: { tehsil: In(ts) },
        relations: { meters: true },
      });
    } else {
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

  // ── Water system config ────────────────────────────────────────────────

  async getWaterSystemConfig(
    userId: string,
    tehsil?: string,
    village?: string,
    settlement = '',
  ) {
    const user = await this.userService.getUserById(userId);

    if (!tehsil || !village) {
      throw new BadRequestException({
        message: 'Tehsil and village are required',
      });
    }

    const ct = canonicalTehsil(tehsil);
    if (!ct) {
      throw new BadRequestException({ message: 'Invalid tehsil' });
    }

    try {
      await this.tehsilAccess.assertUserMayAccessTehsil(user!, ct);
    } catch {
      throw new ForbiddenException({
        message: 'Access denied for this tehsil',
      });
    }

    let system: WaterSystem | null;
    if (settlement) {
      system = await this.waterSystemRepo.findOne({
        where: { tehsil: ct, village, settlement },
        relations: { meters: true },
      });
    } else {
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
        await this.tehsilAccess.assertUserMayViewOrLogWaterSystem(
          user!,
          system,
        );
      } catch {
        throw new ForbiddenException({
          message: 'Access denied for this water system',
        });
      }

      const activeMeter = this.getActiveMeter(system);
      return {
        exists: true,
        config: {
          pump_model: system.pumpModel,
          pump_serial_number: system.pumpSerialNumber,
          start_of_operation: toIsoDateString(system.startOfOperation),
          depth_of_water_intake: system.depthOfWaterIntake,
          height_to_ohr: system.heightToOhr,
          pump_flow_rate: system.pumpFlowRate,
          meter_model: activeMeter?.meterModel ?? null,
          meter_serial_number: activeMeter?.meterSerialNumber ?? null,
          meter_accuracy_class: activeMeter?.meterAccuracyClass ?? null,
          installation_date: toIsoDateString(activeMeter?.installationDate),
          current_meter: this.operatorHelpers.meterToDict(activeMeter),
          meters: this.meterHistoryPayload(system.meters, METER_TYPE_TUBEWELL),
        },
      };
    }

    return { exists: false, config: null };
  }

  // ── Water meter context ────────────────────────────────────────────────

  async getWaterMeterContext(
    userId: string,
    query: {
      tehsil?: string;
      village?: string;
      settlement?: string;
      system_id?: string;
      exclude_record_id?: string;
      log_date?: string;
      pump_end_time?: string;
    },
  ) {
    const user = await this.userService.getUserById(userId);
    const {
      tehsil,
      village,
      settlement = '',
      system_id: systemId,
      exclude_record_id: excludeRecordIdRaw,
      log_date: logDateRaw,
      pump_end_time: pumpEndRaw,
    } = query;

    const excludeRecordId = (excludeRecordIdRaw || '').trim() || undefined;

    let system: WaterSystem | null = null;

    if (systemId) {
      system = await this.waterSystemRepo.findOne({ where: { id: systemId } });
    } else if (tehsil && village) {
      const ct = canonicalTehsil(tehsil);
      if (!ct) {
        throw new BadRequestException({ message: 'Invalid tehsil' });
      }
      system = await this.findWaterSystemByLocation(
        ct,
        village,
        settlement || undefined,
      );
    } else {
      throw new BadRequestException({
        message: 'system_id or tehsil+village required',
      });
    }

    if (!system) {
      throw new NotFoundException({ message: 'Water system not found' });
    }

    try {
      await this.tehsilAccess.assertUserMayViewOrLogWaterSystem(user!, system);
    } catch {
      throw new ForbiddenException({
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
        throw new BadRequestException({
          message: 'Invalid log_date; use YYYY-MM-DD',
        });
      }
    }

    if (pumpEndRaw) {
      const parsedEnd = this.pumpTimesService.parseTimeOfDay(pumpEndRaw);
      if (parsedEnd === null) {
        throw new BadRequestException({ message: 'Invalid pump_end_time' });
      }
    }

    const prevEnd =
      await this.waterMeterVolumeService.getLatestSubmittedMeterReadingEnd(
        String(system.id),
        excludeRecordId,
      );

    const priorCount = await this.waterMeterVolumeService.countMeterChainLogs(
      String(system.id),
      excludeRecordId,
    );

    return {
      bulk_meter_installed: true,
      previous_meter_reading_end: prevEnd,
      has_submitted_meter_end: prevEnd !== null,
      is_first_bulk_meter_log: priorCount === 0,
      prior_log_count: priorCount,
      water_system_id: String(system.id),
    };
  }

  // ── Water drafts ───────────────────────────────────────────────────────

  async getWaterDrafts(userId: string) {
    const user = await this.userService.getUserById(userId);
    const rk = this.rbac.userRank(user!);
    const ts = [...(await this.rbac.userAssignedTehsils(user!))];

    let systemIds: string[];

    if (rk >= this.rbac.ROLE_RANK[this.rbac.SUPER_ADMIN]) {
      const all = await this.waterSystemRepo.find({ select: { id: true } });
      systemIds = all.map((s) => s.id);
    } else if (this.rbac.userRoleCode(user!) === this.rbac.USER) {
      const wids = user!.assignedWaterSystemIds;
      if (!wids?.length) {
        return { drafts: [] };
      }
      systemIds = wids;
    } else if (ts.length) {
      const scoped = await this.waterSystemRepo.find({
        where: { tehsil: In(ts) },
        select: { id: true },
      });
      systemIds = scoped.map((s) => s.id);
    } else {
      return { drafts: [] };
    }

    const drafts = await this.waterLogRepo.find({
      where: {
        waterSystemId: In(systemIds),
        status: SUBMISSION_STATUS_DRAFTED,
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
        year: getCalendarYear(draft.logDate),
        month: getCalendarMonth(draft.logDate),
        day: getCalendarDay(draft.logDate),
        bulk_meter_image_url: draft.bulkMeterImageUrl,
        signed: draft.signed,
        status: draft.status,
        created_at: toIsoDateTimeString(draft.createdAt),
      });
    }

    return { drafts: result };
  }

  async getWaterDraft(userId: string, recordId: string) {
    const record = await this.waterLogRepo.findOne({ where: { id: recordId } });
    if (!record) {
      throw new NotFoundException({ error: 'Record not found' });
    }

    const u = await this.userService.getUserById(userId);
    const system = await this.waterSystemRepo.findOne({
      where: { id: record.waterSystemId },
    });

    try {
      await this.tehsilAccess.assertUserMayViewOrLogWaterSystem(u!, system);
    } catch {
      throw new ForbiddenException({ error: 'Access denied' });
    }

    return {
      id: String(record.id),
      water_system_id: String(record.waterSystemId),
      year: getCalendarYear(record.logDate),
      month: getCalendarMonth(record.logDate),
      day: getCalendarDay(record.logDate),
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

  async updateWaterDraft(
    userId: string,
    recordId: string,
    data: Record<string, unknown>,
  ) {
    const record = await this.waterLogRepo.findOne({ where: { id: recordId } });
    if (!record) {
      throw new NotFoundException({ error: 'Record not found' });
    }

    const u = await this.userService.getUserById(userId);
    if (this.rbac.userRoleCode(u!) !== this.rbac.USER) {
      throw new ForbiddenException({
        error: 'Only tubewell operators can edit water logs',
      });
    }

    if (!WATER_LOG_OPERATOR_EDITABLE.has(record.status)) {
      throw new BadRequestException({
        error: 'Only drafted or reverted_back rows can be edited',
      });
    }

    const system = await this.waterSystemRepo.findOne({
      where: { id: record.waterSystemId },
    });

    try {
      await this.tehsilAccess.assertUserMayViewOrLogWaterSystem(u!, system);
    } catch {
      throw new ForbiddenException({ error: 'Access denied' });
    }

    this.pumpTimesService.applyPumpTimeFieldsFromPayload(record, data);

    const noBulkMeter = system!.bulkMeterInstalled === false;

    let meterEnd: number | null | undefined;
    let meterStart: number | null | undefined;
    let legacyTotal: number | null | undefined;

    try {
      meterEnd = this.operatorHelpers.coerceOptionalFloat(
        data.meter_reading_end,
      );
    } catch (ve) {
      throw new BadRequestException({
        error: `Invalid meter_reading_end: ${ve}`,
      });
    }
    try {
      meterStart = this.operatorHelpers.coerceOptionalFloat(
        data.meter_reading_start,
      );
    } catch (ve) {
      throw new BadRequestException({
        error: `Invalid meter_reading_start: ${ve}`,
      });
    }
    try {
      legacyTotal = this.operatorHelpers.coerceOptionalFloat(
        data.total_water_pumped,
      );
    } catch (ve) {
      throw new BadRequestException({
        error: `Invalid total_water_pumped: ${ve}`,
      });
    }

    if (
      'meter_reading_end' in data ||
      'meter_reading_start' in data ||
      'total_water_pumped' in data
    ) {
      try {
        await this.waterMeterVolumeService.applyBulkMeterFields({
          record,
          waterSystemId: String(system!.id),
          noBulkMeterInstalled: noBulkMeter,
          meterReadingEnd: meterEnd,
          meterReadingStart: meterStart,
          legacyTotalWaterPumped: legacyTotal,
          excludeRecordId: String(record.id),
        });
      } catch (ve) {
        this.throwBulkMeterError(ve);
      }
    }

    if ('year' in data || 'month' in data || 'day' in data) {
      const y = data.year ?? getCalendarYear(record.logDate);
      const m = data.month ?? getCalendarMonth(record.logDate);
      const d = data.day ?? getCalendarDay(record.logDate);

      if (y === null || y === undefined || m === null || m === undefined) {
        throw new BadRequestException({
          error: 'year and month are required to update period',
        });
      }

      try {
        const yi = Number(y);
        const mi = Number(m);
        let di: number;
        if (d === null || d === undefined) {
          const today = new Date();
          if (yi === today.getFullYear() && mi === today.getMonth() + 1) {
            di = Math.min(today.getDate(), this.daysInMonth(yi, mi));
          } else {
            di = 1;
          }
        } else {
          di = Number(d);
        }
        const last = this.daysInMonth(yi, mi);
        if (di < 1 || di > last) {
          throw new BadRequestException({
            error: `day must be between 1 and ${last}`,
          });
        }
        record.logDate = new Date(yi, mi - 1, di);
      } catch (e) {
        if (e instanceof HttpException) throw e;
        throw new BadRequestException({
          error: 'Invalid year, month, or day',
        });
      }
    }

    if (record.pumpStartTime != null && record.pumpEndTime != null) {
      const conflict = await this.waterLogRepo.findOne({
        where: {
          id: Not(record.id),
          waterSystemId: record.waterSystemId,
          logDate: record.logDate,
          pumpStartTime: record.pumpStartTime,
          pumpEndTime: record.pumpEndTime,
        },
      });
      if (conflict) {
        throw new BadRequestException({
          error: 'Duplicate interval',
          message:
            'A log already exists for this day with the same pump start/end time.',
        });
      }
    }

    await this.waterLogRepo.save(record);
    return { message: 'Draft updated successfully', id: String(record.id) };
  }

  async submitWaterDraft(userId: string, recordId: string) {
    const record = await this.waterLogRepo.findOne({ where: { id: recordId } });
    if (!record) {
      throw new NotFoundException({ error: 'Record not found' });
    }

    const u = await this.userService.getUserById(userId);
    if (this.rbac.userRoleCode(u!) !== this.rbac.USER) {
      throw new ForbiddenException({
        error: 'Only tubewell operators can submit water logs',
      });
    }

    this.requireOperatorSignature(u!);

    if (!WATER_LOG_OPERATOR_EDITABLE.has(record.status)) {
      throw new BadRequestException({
        error: 'Only drafted or reverted_back rows can be submitted',
      });
    }

    const system = await this.waterSystemRepo.findOne({
      where: { id: record.waterSystemId },
    });

    try {
      await this.tehsilAccess.assertUserMayViewOrLogWaterSystem(u!, system);
    } catch {
      throw new ForbiddenException({ error: 'Access denied' });
    }

    const noBulkMeter = system!.bulkMeterInstalled === false;
    if (!noBulkMeter) {
      if (record.logDate == null || record.pumpEndTime == null) {
        throw new BadRequestException({
          error: 'log_date and pump_end_time are required before submit',
        });
      }
      try {
        await this.waterMeterVolumeService.applyBulkMeterFields({
          record,
          waterSystemId: String(system!.id),
          noBulkMeterInstalled: false,
          meterReadingEnd: record.meterReadingEnd,
          meterReadingStart: record.meterReadingStart,
          legacyTotalWaterPumped: record.totalWaterPumped,
          excludeRecordId: String(record.id),
        });
      } catch (ve) {
        this.throwBulkMeterError(ve);
      }
    }

    record.status = SUBMISSION_STATUS_SUBMITTED;
    record.signed = true;
    record.signatureSvgSnapshot = this.signatureSvgOrNone(u!);

    const existingSub = await this.submissionRepo.findOne({
      where: { recordId: String(record.id) },
    });

    const currentUser = await this.userRepo.findOne({ where: { id: userId } });

    if (!existingSub) {
      const submission = await this.submissionRepo.save(
        this.submissionRepo.create({
          operatorId: userId,
          submissionType: 'water_system',
          recordId: String(record.id),
          status: SUBMISSION_STATUS_SUBMITTED,
          submittedAt: new Date(),
        }),
      );

      await this.workflowService.logVerificationAction(
        submission.id,
        'submit',
        userId,
        this.rbac.userRoleCode(currentUser!),
        `Water data for ${getCalendarMonth(record.logDate)}/${getCalendarYear(record.logDate)} submitted from draft`,
      );

      const details =
        `New Monthly Water Report (${getCalendarMonth(record.logDate)}/${getCalendarYear(record.logDate)}) submitted by ${currentUser!.name}.\n` +
        `Location: ${system!.tehsil}, ${system!.village} ${system!.settlement || ''}\n` +
        `Pump Operating Hours: ${record.pumpOperatingHours ?? 'N/A'}\n` +
        `Total Water Pumped: ${record.totalWaterPumped ?? 'N/A'}`;

      await this.workflowService.notifyAnalysts(
        'New Detailed Water Submission',
        details,
        submission.id,
        system!.tehsil,
      );
    } else {
      if (
        [
          SUBMISSION_STATUS_REJECTED,
          SUBMISSION_STATUS_REVERTED_BACK,
          SUBMISSION_STATUS_DRAFTED,
        ].includes(existingSub.status)
      ) {
        existingSub.status = SUBMISSION_STATUS_SUBMITTED;
        existingSub.submittedAt = new Date();
        await this.submissionRepo.save(existingSub);
      } else if (existingSub.status === SUBMISSION_STATUS_SUBMITTED) {
        throw new BadRequestException({
          error: 'This record is already submitted',
        });
      } else if (existingSub.status === SUBMISSION_STATUS_ACCEPTED) {
        throw new BadRequestException({
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

  async deleteWaterDraft(userId: string, recordId: string) {
    const u = await this.userService.getUserById(userId);
    if (this.rbac.userRoleCode(u!) !== this.rbac.USER) {
      throw new ForbiddenException({
        error: 'Only tubewell operators can delete water drafts',
      });
    }

    const record = await this.waterLogRepo.findOne({ where: { id: recordId } });
    if (!record) {
      throw new NotFoundException({ error: 'Record not found' });
    }

    if (record.status !== SUBMISSION_STATUS_DRAFTED) {
      throw new BadRequestException({
        error: 'Only drafted rows can be deleted',
      });
    }

    const system = await this.waterSystemRepo.findOne({
      where: { id: record.waterSystemId },
    });
    if (!system) {
      throw new ForbiddenException({ error: 'Access denied' });
    }

    try {
      await this.tehsilAccess.assertUserMayViewOrLogWaterSystem(u!, system);
    } catch {
      throw new ForbiddenException({ error: 'Access denied' });
    }

    await this.waterLogRepo.remove(record);
    return { message: 'Draft deleted successfully' };
  }

  // ── Water supply data ────────────────────────────────────────────────────

  async getWaterSupplyData(
    userId: string,
    query: {
      tehsil?: string;
      village?: string;
      settlement?: string;
      system_id?: string;
      year?: number;
    },
  ) {
    const user = await this.userService.getUserById(userId);
    const {
      tehsil,
      village,
      settlement = '',
      system_id: systemIdRaw,
      year,
    } = query;

    const systemId = (systemIdRaw || '').trim() || undefined;

    let system: WaterSystem | null = null;

    if (systemId) {
      system = await this.waterSystemRepo.findOne({ where: { id: systemId } });
    } else {
      if (!tehsil || !village) {
        throw new BadRequestException({
          message: 'system_id or tehsil+village is required',
        });
      }

      const ct = canonicalTehsil(tehsil);
      if (!ct) {
        throw new BadRequestException({ message: 'Invalid tehsil' });
      }

      try {
        await this.tehsilAccess.assertUserMayAccessTehsil(user!, ct);
      } catch {
        throw new ForbiddenException({
          message: 'Access denied for this tehsil',
        });
      }

      if (settlement) {
        system = await this.waterSystemRepo.findOne({
          where: { tehsil: ct, village, settlement },
        });
      } else {
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
      await this.tehsilAccess.assertUserMayLogWaterSystem(user!, system);
    } catch {
      throw new ForbiddenException({
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

  async saveWaterSupplyData(
    userId: string,
    body: {
      data?: unknown;
      year?: unknown;
      status?: string;
      image_url?: string;
      image_path?: string;
    },
  ) {
    const rawRows = body?.data;
    let rows: unknown[];
    if (rawRows === undefined || rawRows === null) {
      rows = [];
    } else if (!Array.isArray(rawRows)) {
      throw new BadRequestException({
        message: 'Invalid payload',
        errors: ['data must be a JSON array'],
      });
    } else {
      rows = rawRows;
    }

    const yearRaw = body?.year ?? new Date().getFullYear();
    let year: number;
    try {
      year = Number(yearRaw);
      if (!Number.isFinite(year)) throw new Error('not finite');
    } catch {
      throw new BadRequestException({
        message: 'Invalid year',
        errors: ['year must be an integer'],
      });
    }

    const status = normalizeWaterSubmissionStatus(body?.status);
    const imageUrl = body?.image_url || body?.image_path;

    if (!rows.length) {
      throw new BadRequestException({ message: 'No data provided' });
    }

    const savedRecordIds: string[] = [];
    const savedIds: string[] = [];
    const errors: string[] = [];
    const postSubmitWorkflows: Array<{
      submissionId: string;
      userId: string;
      role: string;
      comment: string;
      notifyTitle: string;
      notifyDetails: string;
      tehsil: string;
    }> = [];

    const opUser = await this.userService.getUserById(userId);

    if (status === SUBMISSION_STATUS_SUBMITTED) {
      this.requireOperatorSignature(opUser!);
    }

    await this.dataSource.transaction(async (manager) => {
      const waterLogRepo = manager.getRepository(WaterEnergyLoggingDaily);
      const waterSystemRepo = manager.getRepository(WaterSystem);
      const submissionRepo = manager.getRepository(Submission);
      const userRepo = manager.getRepository(User);

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          if (typeof row !== 'object' || row === null || Array.isArray(row)) {
            errors.push(`Row ${i + 1}: each data item must be an object`);
            continue;
          }

          const rowObj = row as Record<string, unknown>;
          const tehsilRaw = rowObj.tehsil;
          let village: string | undefined;
          if (typeof rowObj.village === 'string') {
            village = rowObj.village.trim();
          } else if (typeof rowObj.village === 'number') {
            village = String(rowObj.village).trim();
          } else if (rowObj.village != null) {
            errors.push(`Row ${i + 1}: village must be a string`);
            continue;
          }

          let settlement = (rowObj.settlement as string) ?? '';
          if (typeof settlement === 'string') {
            settlement = settlement.trim();
          } else if (settlement != null) {
            settlement = String(settlement).trim();
          } else {
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
          } else if (typeof tehsilRaw === 'number') {
            tehsilStr = String(tehsilRaw);
          } else {
            errors.push(`Row ${i + 1}: invalid tehsil`);
            continue;
          }

          const ct = canonicalTehsil(tehsilStr);
          if (!ct) {
            errors.push(`Row ${i + 1}: invalid tehsil`);
            continue;
          }

          try {
            await this.tehsilAccess.assertUserMayAccessTehsil(opUser!, ct, {
              forWrite: true,
            });
          } catch {
            errors.push(`Row ${i + 1}: tehsil not permitted for your account`);
            continue;
          }

          let system: WaterSystem | null;
          if (settlement) {
            system = await waterSystemRepo.findOne({
              where: { tehsil: ct, village, settlement },
            });
          } else {
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
            errors.push(
              `Row ${i + 1}: No water system for this location — your tehsil manager must register it first`,
            );
            continue;
          }

          try {
            await this.tehsilAccess.assertUserMayLogWaterSystem(
              opUser!,
              system,
            );
          } catch {
            errors.push(
              `Row ${i + 1}: this water system is not assigned to your account`,
            );
            continue;
          }

          const noBulkMeterInstalled = system.bulkMeterInstalled === false;

          for (const monthRecord of monthlyData) {
            if (
              typeof monthRecord !== 'object' ||
              monthRecord === null ||
              Array.isArray(monthRecord)
            ) {
              errors.push(
                `Row ${i + 1}: each monthlyData item must be an object`,
              );
              continue;
            }

            const mr = monthRecord as Record<string, unknown>;
            const month = mr.month;

            let pumpHours: number | null | undefined;
            let meterEnd: number | null | undefined;
            let meterStart: number | null | undefined;
            let totalWater: number | null | undefined;

            try {
              pumpHours = this.operatorHelpers.coerceOptionalFloat(
                mr.pump_operating_hours,
              );
              meterEnd = this.operatorHelpers.coerceOptionalFloat(
                mr.meter_reading_end,
              );
              meterStart = this.operatorHelpers.coerceOptionalFloat(
                mr.meter_reading_start,
              );
              totalWater = this.operatorHelpers.coerceOptionalFloat(
                mr.total_water_pumped,
              );
            } catch (ve) {
              errors.push(
                `Row ${i + 1}: invalid number in monthlyData (${ve})`,
              );
              continue;
            }

            if (month === null || month === undefined) {
              errors.push(`Row ${i + 1}: missing month in monthlyData`);
              throw new Error('missing month');
            }

            let yi: number;
            let mi: number;
            try {
              yi = Number(year);
              mi = Number(month);
            } catch {
              errors.push(`Row ${i + 1}: invalid year or month in monthlyData`);
              throw new Error('invalid date');
            }

            const dayRaw = mr.day;
            const today = new Date();
            let day: number;

            if (
              dayRaw === null ||
              dayRaw === undefined ||
              (typeof dayRaw === 'string' && !dayRaw.trim())
            ) {
              if (yi === today.getFullYear() && mi === today.getMonth() + 1) {
                day = Math.min(today.getDate(), this.daysInMonth(yi, mi));
              } else {
                day = 1;
              }
            } else {
              try {
                day = Number(dayRaw);
              } catch {
                errors.push(`Row ${i + 1}: invalid day in monthlyData`);
                throw new Error('invalid day');
              }
            }

            const last = this.daysInMonth(yi, mi);
            if (day < 1 || day > last) {
              errors.push(
                `Row ${i + 1}: day must be between 1 and ${last} for this month`,
              );
              throw new Error('invalid day range');
            }

            let logD: Date;
            try {
              logD = new Date(yi, mi - 1, day);
            } catch {
              errors.push(`Row ${i + 1}: invalid log date`);
              throw new Error('invalid date');
            }

            const startTime = this.pumpTimesService.parseTimeOfDay(
              mr.pump_start_time,
            );
            const endTime = this.pumpTimesService.parseTimeOfDay(
              mr.pump_end_time,
            );

            if (startTime === null || endTime === null) {
              errors.push(
                `Row ${i + 1}: pump_start_time and pump_end_time are required and must be valid times`,
              );
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
              errors.push(
                `Row ${i + 1}: duplicate log interval for this system/day (same pump_start_time and pump_end_time)`,
              );
              continue;
            }

            const newRecord = waterLogRepo.create({
              waterSystemId: system.id,
              logDate: logD,
              status,
              bulkMeterImageUrl: noBulkMeterInstalled ? null : imageUrl,
              signed: status === SUBMISSION_STATUS_SUBMITTED,
              signatureSvgSnapshot:
                status === SUBMISSION_STATUS_SUBMITTED
                  ? this.signatureSvgOrNone(opUser!)
                  : null,
            });

            this.pumpTimesService.applyPumpTimeFieldsFromPayload(newRecord, mr);

            if (
              newRecord.pumpStartTime == null &&
              newRecord.pumpEndTime == null &&
              pumpHours != null
            ) {
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
            } catch (ve) {
              errors.push(`Row ${i + 1}: ${ve}`);
              continue;
            }

            const saved = await waterLogRepo.save(newRecord);
            savedRecordIds.push(String(saved.id));

            if (status === SUBMISSION_STATUS_SUBMITTED) {
              const rec = saved;
              const recordIdToLink = String(rec.id);
              const existingSub = await submissionRepo.findOne({
                where: { recordId: recordIdToLink },
              });

              if (!existingSub) {
                const currentUser = await userRepo.findOne({
                  where: { id: userId },
                });
                const submission = await submissionRepo.save(
                  submissionRepo.create({
                    operatorId: userId,
                    submissionType: 'water_system',
                    recordId: recordIdToLink,
                    status: SUBMISSION_STATUS_SUBMITTED,
                    submittedAt: new Date(),
                  }),
                );

                const details =
                  `New Monthly Water Report (${mi}/${yi}) submitted by ${currentUser!.name}.\n` +
                  `Location: ${system.tehsil}, ${system.village} ${system.settlement || ''}\n` +
                  `Pump Operating Hours: ${rec.pumpOperatingHours ?? 'N/A'}\n` +
                  `Meter reading (stop): ${rec.meterReadingEnd ?? 'N/A'}\n` +
                  `Water pumped this interval: ${rec.totalWaterPumped ?? 'N/A'} m³`;

                postSubmitWorkflows.push({
                  submissionId: submission.id,
                  userId,
                  role: this.rbac.userRoleCode(currentUser!),
                  comment: `Water data for ${mi}/${yi} submitted via form`,
                  notifyTitle: 'New Detailed Water Submission',
                  notifyDetails: details,
                  tehsil: system.tehsil,
                });
              } else if (
                [
                  SUBMISSION_STATUS_REJECTED,
                  SUBMISSION_STATUS_REVERTED_BACK,
                  SUBMISSION_STATUS_DRAFTED,
                ].includes(existingSub.status)
              ) {
                existingSub.status = SUBMISSION_STATUS_SUBMITTED;
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
              firstRecord.remarks = rowObj.remarks as string;
              await waterLogRepo.save(firstRecord);
            }
          }

          savedIds.push(String(system.id));
        } catch (e) {
          errors.push(`Row ${i + 1}: ${String(e)}`);
        }
      }

      if (errors.length) {
        throw new BadRequestException({
          message: 'Validation errors',
          errors,
        });
      }
    });

    for (const workflow of postSubmitWorkflows) {
      await this.workflowService.logVerificationAction(
        workflow.submissionId,
        'submit',
        workflow.userId,
        workflow.role,
        workflow.comment,
      );
      await this.workflowService.notifyAnalysts(
        workflow.notifyTitle,
        workflow.notifyDetails,
        workflow.submissionId,
        workflow.tehsil,
      );
    }

    return {
      message: `Saved data for ${savedIds.length} location(s) as ${status}`,
      ids: savedIds,
      record_ids: savedRecordIds,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private throwBulkMeterError(exc: unknown): never {
    if (exc instanceof MeterReadingOrderError) {
      throw new BadRequestException({
        error: exc.message,
        code: exc.code,
      });
    }
    if (exc instanceof Error) {
      throw new BadRequestException({ error: exc.message });
    }
    throw exc;
  }

  private applyWaterLogYearFilter(
    qb: SelectQueryBuilder<WaterEnergyLoggingDaily>,
    year?: number,
  ): SelectQueryBuilder<WaterEnergyLoggingDaily> {
    if (year === undefined || year === null) {
      return qb;
    }
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    return qb
      .andWhere('log.logDate >= :yearStart', { yearStart: start })
      .andWhere('log.logDate < :yearEnd', { yearEnd: end });
  }

  private async findWaterSystemByLocation(
    ct: string,
    village: string,
    settlement?: string,
  ): Promise<WaterSystem | null> {
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

  private waterLogToJson(record: WaterEnergyLoggingDaily) {
    return {
      id: String(record.id),
      year: getCalendarYear(record.logDate),
      month: getCalendarMonth(record.logDate),
      day: getCalendarDay(record.logDate),
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

  private signaturePayloadOk(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const v = value.trim();
    if (!v) {
      return false;
    }
    return v.length <= 150_000;
  }

  private requireOperatorSignature(user: User): void {
    if (!user || this.rbac.userRoleCode(user) !== this.rbac.USER) {
      throw new ForbiddenException({
        error: 'Only tubewell operators can perform this action',
      });
    }
    const sig = user.signatureSvg;
    if (!sig || !String(sig).trim()) {
      throw new BadRequestException({
        error: 'Signature required',
        message: 'Please add your signature before submitting a water log.',
      });
    }
  }

  private signatureSvgOrNone(user: User): string | null {
    const sig = user.signatureSvg;
    if (sig && String(sig).trim()) {
      return String(sig).trim();
    }
    return null;
  }

  private meterHistoryPayload(
    meters: SystemMeter[] | undefined,
    meterType: string,
  ) {
    const rows = (meters || []).filter((m) => m.meterType === meterType);
    rows.sort((a, b) => {
      const aCreated = a.createdAt?.getTime() ?? 0;
      const bCreated = b.createdAt?.getTime() ?? 0;
      if (bCreated !== aCreated) return bCreated - aCreated;
      return String(b.id).localeCompare(String(a.id));
    });
    const out: Record<string, unknown>[] = [];
    for (const meter of rows) {
      const payload = this.operatorHelpers.meterToDict(meter);
      if (payload !== null) {
        out.push(payload);
      }
    }
    return out;
  }

  private getActiveMeter(system: WaterSystem): SystemMeter | null {
    const meters = system.meters || [];
    const sorted = [...meters].sort((a, b) => {
      const aCreated = a.createdAt?.getTime() ?? 0;
      const bCreated = b.createdAt?.getTime() ?? 0;
      if (bCreated !== aCreated) return bCreated - aCreated;
      return String(b.id).localeCompare(String(a.id));
    });
    return (
      sorted.find((m) => m.isActive && m.meterType === METER_TYPE_TUBEWELL) ??
      null
    );
  }

  private waterSystemToJson(s: WaterSystem) {
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
      installation_date: toIsoDateString(activeMeter?.installationDate),
      current_meter: this.operatorHelpers.meterToDict(activeMeter),
      meters: this.meterHistoryPayload(s.meters, METER_TYPE_TUBEWELL),
      created_at: toIsoDateTimeString(s.createdAt),
      updated_at: toIsoDateTimeString(s.updatedAt),
    };
  }

  private daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  private parseIsoDate(raw: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const dt = new Date(y, m - 1, d);
    if (
      dt.getFullYear() !== y ||
      dt.getMonth() !== m - 1 ||
      dt.getDate() !== d
    ) {
      return null;
    }
    return dt;
  }
}
