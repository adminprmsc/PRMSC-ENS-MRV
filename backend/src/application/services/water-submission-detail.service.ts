import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { METER_TYPE_TUBEWELL } from '../../domain/constants/submission.constants';
import { Submission } from '../../infrastructure/database/entities/submission.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { VerificationLog } from '../../infrastructure/database/entities/verification-log.entity';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { OperatorHelpersService } from './operator-helpers.service';
import { WaterMeterVolumeService } from './water-meter-volume.service';

@Injectable()
export class WaterSubmissionDetailService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(WaterEnergyLoggingDaily)
    private readonly waterLogRepo: Repository<WaterEnergyLoggingDaily>,
    @InjectRepository(WaterSystem)
    private readonly waterSystemRepo: Repository<WaterSystem>,
    @InjectRepository(VerificationLog)
    private readonly verificationLogRepo: Repository<VerificationLog>,
    private readonly operatorHelpers: OperatorHelpersService,
    private readonly waterMeterVolume: WaterMeterVolumeService,
  ) {}

  async buildWaterSubmissionDetailResponse(submission: Submission) {
    const operator = await this.userRepo.findOne({
      where: { id: submission.operatorId },
    });
    const reviewer = submission.reviewedBy
      ? await this.userRepo.findOne({ where: { id: submission.reviewedBy } })
      : null;
    const approver = submission.approvedBy
      ? await this.userRepo.findOne({ where: { id: submission.approvedBy } })
      : null;

    let recordData: Record<string, unknown> = {};
    const record = await this.waterLogRepo.findOne({
      where: { id: submission.recordId },
    });

    if (record) {
      const system = await this.waterSystemRepo.findOne({
        where: { id: record.waterSystemId },
        relations: { meters: true },
      });
      const activeMeter = system?.activeMeter;
      const meterHistory: Array<Record<string, unknown>> = [];
      if (system?.meters) {
        const rows = system.meters
          .filter((m) => m.meterType === METER_TYPE_TUBEWELL)
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
          ? await this.waterMeterVolume.getLatestSubmittedMeterReadingEnd(
              String(record.waterSystemId),
              { excludeRecordId: String(record.id) },
            )
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
}
