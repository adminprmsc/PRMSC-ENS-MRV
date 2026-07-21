import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { canonicalTehsil } from '../../domain/constants/tehsils';
import { ADMIN, SUPER_ADMIN } from '../../domain/constants/roles';
import {
  toIsoDateString,
  toIsoDateTimeString,
} from '../../domain/utils/date.util';
import {
  SUBMISSION_STATUS_ACCEPTED,
  SUBMISSION_STATUS_DRAFTED,
  SUBMISSION_STATUS_REJECTED,
  SUBMISSION_STATUS_REVERTED_BACK,
  SUBMISSION_STATUS_SUBMITTED,
  MeterType,
} from '../../domain/constants/submission.constants';
import { WaterSystem } from '../../infrastructure/database/entities/water-system.entity';
import { WaterSystemCalibrationCertificate } from '../../infrastructure/database/entities/water-system-calibration-certificate.entity';
import { WaterEnergyLoggingDaily } from '../../infrastructure/database/entities/water-energy-logging-daily.entity';
import { SolarSystem } from '../../infrastructure/database/entities/solar-system.entity';
import { SystemMeter } from '../../infrastructure/database/entities/system-meter.entity';
import { SolarEnergyLoggingMonthly } from '../../infrastructure/database/entities/solar-energy-logging-monthly.entity';
import { Notification } from '../../infrastructure/database/entities/notification.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { UserWaterSystem } from '../../infrastructure/database/entities/user-water-system.entity';
import { Submission } from '../../infrastructure/database/entities/submission.entity';
import { VerificationLog } from '../../infrastructure/database/entities/verification-log.entity';
import { UserService } from './user.service';
import { StorageService } from './storage.service';
import { WorkflowService } from './workflow.service';
import { NotificationsService } from './notifications.service';
import { WaterSubmissionDetailService } from './water-submission-detail.service';
import { OperatorHelpersService } from './operator-helpers.service';
import {
  TehsilAccessDenied,
  TehsilAccessService,
} from './tehsil-access.service';
import { RbacService } from './rbac.service';

export interface JwtContext {
  sub: string;
  role?: string;
  hierarchy_rank?: number;
  tehsils?: string[];
}

export type ServiceResult<T = Record<string, unknown>> = {
  statusCode: number;
  body: T;
};

@Injectable()
export class TehsilManagerService {
  constructor(
    @InjectRepository(WaterSystem)
    private readonly waterSystemRepo: Repository<WaterSystem>,
    @InjectRepository(WaterSystemCalibrationCertificate)
    private readonly calibrationCertRepo: Repository<WaterSystemCalibrationCertificate>,
    @InjectRepository(WaterEnergyLoggingDaily)
    private readonly waterDailyRepo: Repository<WaterEnergyLoggingDaily>,
    @InjectRepository(SolarSystem)
    private readonly solarSystemRepo: Repository<SolarSystem>,
    @InjectRepository(SystemMeter)
    private readonly systemMeterRepo: Repository<SystemMeter>,
    @InjectRepository(SolarEnergyLoggingMonthly)
    private readonly solarMonthlyRepo: Repository<SolarEnergyLoggingMonthly>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserWaterSystem)
    private readonly userWaterSystemRepo: Repository<UserWaterSystem>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(VerificationLog)
    private readonly verificationLogRepo: Repository<VerificationLog>,
    private readonly userService: UserService,
    private readonly storageService: StorageService,
    private readonly workflowService: WorkflowService,
    private readonly notificationsService: NotificationsService,
    private readonly waterSubmissionDetailService: WaterSubmissionDetailService,
    private readonly operatorHelpers: OperatorHelpersService,
    private readonly tehsilAccess: TehsilAccessService,
    private readonly rbac: RbacService,
  ) {}

  // ── RBAC / access helpers ─────────────────────────────────────────────────

  private assertMinRole(
    jwt: JwtContext,
    minRole: string,
  ): ServiceResult | null {
    if (!this.rbac.rankAtLeast(jwt.role, minRole)) {
      return {
        statusCode: 403,
        body: {
          message: `Access Forbidden: ${minRole} role required`,
          your_role: jwt.role,
        },
      };
    }
    return null;
  }

  private async assertTehsilManagerRequired(
    jwt: JwtContext,
  ): Promise<ServiceResult | null> {
    if (this.rbac.normalizeRoleCode(jwt.role) !== ADMIN) {
      return {
        statusCode: 403,
        body: {
          message: 'Access Forbidden: tehsil manager role required',
          your_role: jwt.role,
        },
      };
    }
    const user = await this.userService.getUserById(jwt.sub);
    if (!user) {
      return { statusCode: 404, body: { message: 'User not found' } };
    }
    const tehsils = await this.rbac.userAssignedTehsils(user);
    if (!tehsils || tehsils.size === 0) {
      return {
        statusCode: 403,
        body: { message: 'No tehsil assignments — contact operations' },
      };
    }
    return null;
  }

  private tehsilDenied(exc: unknown): ServiceResult | null {
    if (exc instanceof TehsilAccessDenied) {
      return { statusCode: 403, body: { message: String(exc) } };
    }
    return null;
  }

  private async loadActor(jwt: JwtContext): Promise<User | null> {
    return this.userService.getUserById(jwt.sub);
  }

  private scopeTehsilsFromJwt(jwt: JwtContext): string[] {
    const raw = jwt.tehsils;
    if (!Array.isArray(raw)) return [];
    return raw.map((t) => String(t).trim()).filter(Boolean);
  }

  private dateSeries(endDay: Date, days: number): Date[] {
    const out: Date[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(endDay);
      d.setDate(d.getDate() - i);
      out.push(d);
    }
    return out;
  }

  private isoDate(d: unknown): string | null {
    return toIsoDateString(d);
  }

  private parseIsoDate(s: string): Date | null {
    return this.operatorHelpers.parseDate(s);
  }

  private todayDate(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private pctChange(a: number | null, b: number | null): number | null {
    if (a === null || b === null) return null;
    if (Math.abs(b) < 1e-9) return null;
    return (a - b) / b;
  }

  private coerceString(value: unknown, fallback = ''): string {
    if (value === null || value === undefined) {
      return fallback;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return fallback;
  }

  private coerceOptionalBool(value: unknown): boolean | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }
    const s = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
    return null;
  }

  private coerceOptionalDate(value: unknown): Date | null {
    if (value === null || value === '') {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return this.operatorHelpers.parseDate(String(value));
    }
    return null;
  }

  private requireFields(
    data: Record<string, unknown>,
    keys: string[],
  ): string[] {
    const missing: string[] = [];
    for (const k of keys) {
      const v = data[k];
      if (v === null || v === undefined) {
        missing.push(k);
        continue;
      }
      if (typeof v === 'string' && !v.trim()) missing.push(k);
    }
    return missing;
  }

  private solarMonthlyTouRequired(payload: Record<string, unknown>): boolean {
    const explicit = this.coerceOptionalBool(payload.tou_required);
    if (explicit !== null) return explicit;
    return ['export_peak', 'import_peak', 'net_peak'].some(
      (k) =>
        payload[k] !== null && payload[k] !== undefined && payload[k] !== '',
    );
  }

  private normalizeSolarMonthlyFields(payload: Record<string, unknown>): {
    normalized: Record<string, unknown>;
    error: string | null;
  } {
    const touRequired = this.solarMonthlyTouRequired(payload);
    try {
      if (touRequired) {
        return {
          normalized: {
            tou_required: true,
            export_off_peak: this.operatorHelpers.coerceOptionalFloat(
              payload.export_off_peak,
            ),
            export_peak: this.operatorHelpers.coerceOptionalFloat(
              payload.export_peak,
            ),
            import_off_peak: this.operatorHelpers.coerceOptionalFloat(
              payload.import_off_peak,
            ),
            import_peak: this.operatorHelpers.coerceOptionalFloat(
              payload.import_peak,
            ),
            net_off_peak: this.operatorHelpers.coerceOptionalFloat(
              payload.net_off_peak,
            ),
            net_peak: this.operatorHelpers.coerceOptionalFloat(
              payload.net_peak,
            ),
          },
          error: null,
        };
      }
      return {
        normalized: {
          tou_required: false,
          export_off_peak: this.operatorHelpers.coerceOptionalFloat(
            payload.export_total,
          ),
          export_peak: null,
          import_off_peak: this.operatorHelpers.coerceOptionalFloat(
            payload.import_total,
          ),
          import_peak: null,
          net_off_peak: this.operatorHelpers.coerceOptionalFloat(
            payload.net_total,
          ),
          net_peak: null,
        },
        error: null,
      };
    } catch (exc) {
      return { normalized: {}, error: String(exc) };
    }
  }

  private solarMonthlyResponseFields(
    record: SolarEnergyLoggingMonthly,
  ): Record<string, unknown> {
    const touRequired = ['export_peak', 'import_peak', 'net_peak'].some(
      (k) =>
        (record as unknown as Record<string, unknown>)[k] !== null &&
        (record as unknown as Record<string, unknown>)[k] !== undefined,
    );
    let exportTotal: number | null;
    let importTotal: number | null;
    let netTotal: number | null;
    if (touRequired) {
      exportTotal = (record.exportOffPeak ?? 0) + (record.exportPeak ?? 0);
      importTotal = (record.importOffPeak ?? 0) + (record.importPeak ?? 0);
      netTotal = (record.netOffPeak ?? 0) + (record.netPeak ?? 0);
    } else {
      exportTotal = record.exportOffPeak ?? null;
      importTotal = record.importOffPeak ?? null;
      netTotal = record.netOffPeak ?? null;
    }
    return {
      tou_required: touRequired,
      export_total: exportTotal,
      import_total: importTotal,
      net_total: netTotal,
    };
  }

  private currentMeterPayload(
    data: Record<string, unknown>,
    meterType: string,
    fallback: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const raw = data.current_meter;
    const pick = (fieldKey: string, legacyKey: string): unknown => {
      if (raw && typeof raw === 'object' && fieldKey in raw) {
        return (raw as Record<string, unknown>)[fieldKey];
      }
      if (legacyKey in data) return data[legacyKey];
      return fallback[fieldKey];
    };
    return {
      meter_type: meterType,
      meter_model: this.operatorHelpers.coerceOptionalStr(
        pick('meter_model', 'meter_model'),
      ),
      meter_serial_number: this.operatorHelpers.coerceOptionalStr(
        pick('meter_serial_number', 'meter_serial_number'),
      ),
      meter_accuracy_class: this.operatorHelpers.coerceOptionalStr(
        pick('meter_accuracy_class', 'meter_accuracy_class'),
      ),
      installation_date: this.coerceOptionalDate(
        pick('installation_date', 'installation_date'),
      ),
    };
  }

  private async meterHistoryPayload(
    system: WaterSystem | SolarSystem,
    meterType: string,
  ): Promise<Record<string, unknown>[]> {
    const meters = await this.operatorHelpers.getSystemMeters(
      system,
      this.systemMeterRepo,
    );
    const rows = meters.filter((m) => m.meterType === meterType);
    rows.sort((a, b) => {
      const ta = a.createdAt?.getTime() ?? 0;
      const tb = b.createdAt?.getTime() ?? 0;
      if (tb !== ta) return tb - ta;
      return String(b.id).localeCompare(String(a.id));
    });
    return rows
      .map((m) => this.operatorHelpers.meterToDict(m))
      .filter((d): d is Record<string, unknown> => d !== null);
  }

  private meterUpdateMode(data: Record<string, unknown>): string {
    let raw = data.meter_update_mode;
    const currentMeter = data.current_meter;
    if (
      currentMeter &&
      typeof currentMeter === 'object' &&
      (currentMeter as Record<string, unknown>).update_mode !== undefined
    ) {
      raw = (currentMeter as Record<string, unknown>).update_mode;
    }
    let mode =
      raw !== null && raw !== undefined
        ? this.coerceString(raw).trim().toLowerCase()
        : 'auto';
    if (!['auto', 'update_current', 'switch_new'].includes(mode)) mode = 'auto';
    return mode;
  }

  private validateWaterSystemMeterLogic(payload: Record<string, unknown>): {
    ok: boolean;
    err: string | null;
  } {
    const baseMissing = this.requireFields(payload, ['pump_horse_power']);
    if (baseMissing.length) {
      return {
        ok: false,
        err: `Missing required equipment field(s): ${baseMissing.join(', ')}`,
      };
    }
    const bmi = this.coerceOptionalBool(payload.bulk_meter_installed);
    const bulkInstalled = bmi === true;
    if (bulkInstalled) {
      const missing = this.requireFields(payload, [
        'meter_model',
        'meter_serial_number',
        'meter_accuracy_class',
        'installation_date',
      ]);
      if (missing.length) {
        return {
          ok: false,
          err: `Missing required bulk meter field(s): ${missing.join(', ')}`,
        };
      }
      return { ok: true, err: null };
    }
    const missing = this.requireFields(payload, [
      'ohr_tank_capacity',
      'ohr_fill_required',
      'pump_capacity',
      'pump_head',
      'pump_horse_power',
      'time_to_fill',
    ]);
    if (missing.length) {
      return {
        ok: false,
        err: `Missing required no-bulk-meter field(s): ${missing.join(', ')}`,
      };
    }
    return { ok: true, err: null };
  }

  private waterDailyStatusBucket(
    rec: WaterEnergyLoggingDaily | null,
  ): [string, Record<string, unknown> | null] {
    if (!rec) return ['missing', null];
    let st: string;
    if (rec.status === SUBMISSION_STATUS_DRAFTED) st = 'draft';
    else if (rec.status === SUBMISSION_STATUS_SUBMITTED) st = 'submitted';
    else if (rec.status === SUBMISSION_STATUS_ACCEPTED) st = 'accepted';
    else if (rec.status === SUBMISSION_STATUS_REJECTED) st = 'rejected';
    else if (rec.status === SUBMISSION_STATUS_REVERTED_BACK)
      st = 'reverted_back';
    else st = rec.status || 'unknown';
    return [st, { record_id: String(rec.id), status: rec.status }];
  }

  private toFloatOrNone(value: unknown): number | null {
    if (value === null || value === '') return null;
    try {
      return Number(value);
    } catch {
      return null;
    }
  }

  private operatorPayload(op: User): Record<string, unknown> {
    return {
      id: String(op.id),
      name: op.name,
      email: op.email,
      phone: op.phone || null,
    };
  }

  private async getActiveMeter(
    system: WaterSystem | SolarSystem,
  ): Promise<SystemMeter | null> {
    return this.operatorHelpers.getActiveMeter(system, this.systemMeterRepo);
  }

  private applySolarNormalized(
    record: SolarEnergyLoggingMonthly,
    normalized: Record<string, unknown>,
  ): void {
    record.exportOffPeak = normalized.export_off_peak as number | null;
    record.exportPeak = normalized.export_peak as number | null;
    record.importOffPeak = normalized.import_off_peak as number | null;
    record.importPeak = normalized.import_peak as number | null;
    record.netOffPeak = normalized.net_off_peak as number | null;
    record.netPeak = normalized.net_peak as number | null;
  }

  private async upsertMeter(
    params: Parameters<OperatorHelpersService['upsertActiveSystemMeter']>[0],
  ): Promise<SystemMeter | null> {
    return this.operatorHelpers.upsertActiveSystemMeter(
      params,
      this.systemMeterRepo,
    );
  }

  // ── Route handlers (tehsil_manager_bp) ─────────────────────────────────────

  async getWaterAnomalies(
    jwt: JwtContext,
    query: {
      days?: string;
      end_date?: string;
      tehsil?: string;
      village?: string;
    },
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    if (!user) return { statusCode: 404, body: { message: 'User not found' } };

    let days: number;
    try {
      days = parseInt(query.days || '4', 10);
      if (Number.isNaN(days)) throw new Error('invalid');
    } catch {
      return { statusCode: 400, body: { message: 'days must be an integer' } };
    }
    days = Math.max(4, Math.min(days, 14));

    let endDay: Date;
    const endDateS = (query.end_date || '').trim();
    if (endDateS) {
      endDay = this.parseIsoDate(endDateS) as Date;
      if (!endDay) {
        return {
          statusCode: 400,
          body: { message: 'Invalid end_date; use YYYY-MM-DD' },
        };
      }
    } else {
      endDay = this.todayDate();
    }

    const tehsilFilter = (query.tehsil || '').trim();
    const villageFilter = (query.village || '').trim();
    const jwtScopeTehsils = this.scopeTehsilsFromJwt(jwt);

    const where: Record<string, unknown> = {};
    if (jwtScopeTehsils.length) where.tehsil = In(jwtScopeTehsils);
    if (tehsilFilter && tehsilFilter !== 'All Tehsils')
      where.tehsil = tehsilFilter;
    if (villageFilter && villageFilter !== 'All Villages')
      where.village = villageFilter;

    const systems = await this.waterSystemRepo.find({
      where: where as never,
      order: { tehsil: 'ASC', village: 'ASC', uniqueIdentifier: 'ASC' },
    });

    const daysList = this.dateSeries(endDay, days);
    const wsIds = systems.map((s) => s.id);
    let records: WaterEnergyLoggingDaily[] = [];
    let subs: Submission[] = [];
    if (wsIds.length) {
      records = await this.waterDailyRepo.find({
        where: {
          waterSystemId: In(wsIds),
          logDate: In(daysList),
        },
      });
      const recIds = records.map((r) => r.id);
      if (recIds.length) {
        subs = await this.submissionRepo.find({
          where: {
            submissionType: 'water_system',
            recordId: In(recIds),
          },
        });
      }
    }

    const recByWsDay = new Map<string, WaterEnergyLoggingDaily>();
    for (const r of records) {
      recByWsDay.set(`${r.waterSystemId}|${this.isoDate(r.logDate)}`, r);
    }
    const subByRec = new Map<string, Submission>();
    for (const s of subs) subByRec.set(String(s.recordId), s);

    const items: Record<string, unknown>[] = [];
    for (const ws of systems) {
      try {
        await this.tehsilAccess.assertUserMayAccessTehsil(user, ws.tehsil);
      } catch (exc) {
        if (this.tehsilDenied(exc)) continue;
        throw exc;
      }

      const series: Record<string, unknown>[] = [];
      const anomalies: Record<string, unknown>[] = [];

      for (const d of daysList) {
        const r = recByWsDay.get(`${ws.id}|${this.isoDate(d)}`);
        const sub = r ? subByRec.get(String(r.id)) : undefined;
        let opUser: User | null = null;
        if (sub?.operatorId) {
          opUser = await this.userRepo.findOne({
            where: { id: sub.operatorId },
          });
        }

        series.push({
          date: this.isoDate(d),
          status: r?.status ?? null,
          pump_operating_hours: r?.pumpOperatingHours ?? null,
          total_water_pumped: r?.totalWaterPumped ?? null,
          record_id: r ? String(r.id) : null,
          operator: opUser ? this.operatorPayload(opUser) : null,
        });

        if (!r) {
          anomalies.push({
            date: this.isoDate(d),
            code: 'missing_log',
            severity: 'high',
            message: 'No daily log found for this date.',
          });
          continue;
        }
        if (r.status === SUBMISSION_STATUS_DRAFTED) {
          anomalies.push({
            date: this.isoDate(d),
            code: 'draft_not_submitted',
            severity: 'medium',
            message: 'Log exists but is still a draft.',
          });
        }
        if (ws.bulkMeterInstalled) {
          const twp = r.totalWaterPumped;
          if (
            twp === null ||
            twp === undefined ||
            (typeof twp === 'number' && twp <= 0)
          ) {
            anomalies.push({
              date: this.isoDate(d),
              code: 'water_volume_missing_or_zero',
              severity: 'high',
              message:
                'Bulk meter system but total water pumped is missing or zero.',
            });
          }
        }
      }

      if (daysList.length >= 4 && ws.bulkMeterInstalled) {
        for (let idx = 3; idx < daysList.length; idx++) {
          const d = daysList[idx];
          const cur = recByWsDay.get(`${ws.id}|${this.isoDate(d)}`);
          if (
            !cur ||
            cur.totalWaterPumped === null ||
            cur.totalWaterPumped === undefined
          )
            continue;
          const prevVals: number[] = [];
          for (let j = idx - 3; j < idx; j++) {
            const rprev = recByWsDay.get(
              `${ws.id}|${this.isoDate(daysList[j])}`,
            );
            if (
              rprev?.totalWaterPumped !== null &&
              rprev?.totalWaterPumped !== undefined
            ) {
              prevVals.push(Number(rprev.totalWaterPumped));
            }
          }
          if (prevVals.length < 3) continue;
          const avg3 = prevVals.reduce((a, b) => a + b, 0) / 3.0;
          if (avg3 <= 0) continue;
          const curv = Number(cur.totalWaterPumped);
          if (curv > avg3 * 1.1) {
            anomalies.push({
              date: this.isoDate(d),
              code: 'water_volume_sudden_increase_vs_3day_avg',
              severity: 'high',
              message: `Total water pumped ${curv.toFixed(2)} is >10% above 3-day average ${avg3.toFixed(2)}.`,
              baseline_avg_3d: avg3,
              value: curv,
            });
          } else if (curv < avg3 * 0.5) {
            anomalies.push({
              date: this.isoDate(d),
              code: 'water_volume_sudden_decrease_vs_3day_avg',
              severity: 'high',
              message: `Total water pumped ${curv.toFixed(2)} is >50% below 3-day average ${avg3.toFixed(2)}.`,
              baseline_avg_3d: avg3,
              value: curv,
            });
          }
        }
      }

      items.push({
        water_system: {
          id: String(ws.id),
          unique_identifier: ws.uniqueIdentifier,
          tehsil: ws.tehsil,
          village: ws.village,
          settlement: ws.settlement || '',
          bulk_meter_installed: Boolean(ws.bulkMeterInstalled),
        },
        series,
        anomalies,
      });
    }

    return {
      statusCode: 200,
      body: { end_date: this.isoDate(endDay), days, items },
    };
  }

  async getLoggingCompliance(
    jwt: JwtContext,
    query: {
      water_date?: string;
      solar_year?: string;
      solar_month?: string;
    },
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    if (!user) return { statusCode: 404, body: { message: 'User not found' } };

    const ts = [...(await this.rbac.userAssignedTehsils(user))];

    let waterDay: Date;
    try {
      if (query.water_date) {
        waterDay = this.parseIsoDate(query.water_date) as Date;
        if (!waterDay) throw new Error('invalid');
      } else {
        waterDay = this.todayDate();
      }
    } catch {
      return {
        statusCode: 400,
        body: { message: 'Invalid water_date; use YYYY-MM-DD' },
      };
    }

    let solarYear = query.solar_year
      ? parseInt(query.solar_year, 10)
      : this.todayDate().getFullYear();
    let solarMonth = query.solar_month
      ? parseInt(query.solar_month, 10)
      : this.todayDate().getMonth() + 1;
    if (Number.isNaN(solarYear)) solarYear = this.todayDate().getFullYear();
    if (Number.isNaN(solarMonth)) solarMonth = this.todayDate().getMonth() + 1;
    if (solarMonth < 1 || solarMonth > 12) {
      return { statusCode: 400, body: { message: 'solar_month must be 1–12' } };
    }

    let waterSystems: WaterSystem[];
    let solarSystems: SolarSystem[];
    if (ts.length) {
      waterSystems = await this.waterSystemRepo.find({
        where: { tehsil: In(ts) },
        order: { tehsil: 'ASC', village: 'ASC', uniqueIdentifier: 'ASC' },
      });
      solarSystems = await this.solarSystemRepo.find({
        where: { tehsil: In(ts) },
        order: { tehsil: 'ASC', village: 'ASC', uniqueIdentifier: 'ASC' },
      });
    } else {
      return {
        statusCode: 200,
        body: {
          water_date: this.isoDate(waterDay),
          solar_year: solarYear,
          solar_month: solarMonth,
          water_systems: [],
          solar_systems: [],
        },
      };
    }

    const wsIds = waterSystems.map((ws) => ws.id);
    const operatorsByWaterId: Record<string, Record<string, unknown>[]> = {};
    for (const wid of wsIds) operatorsByWaterId[String(wid)] = [];

    if (wsIds.length) {
      const opRows = await this.userWaterSystemRepo
        .createQueryBuilder('uws')
        .innerJoinAndSelect('uws.user', 'user')
        .where('uws.water_system_id IN (:...ids)', { ids: wsIds })
        .orderBy('user.name', 'ASC')
        .getMany();
      for (const row of opRows) {
        const wid = String(row.waterSystemId);
        if (!operatorsByWaterId[wid]) operatorsByWaterId[wid] = [];
        if (row.user)
          operatorsByWaterId[wid].push(this.operatorPayload(row.user));
      }
    }

    const outWater: Record<string, unknown>[] = [];
    for (const ws of waterSystems) {
      const rec = await this.waterDailyRepo.findOne({
        where: { waterSystemId: ws.id, logDate: waterDay },
      });
      let bucket: string;
      if (!rec) bucket = 'missing';
      else if (rec.status === SUBMISSION_STATUS_DRAFTED) bucket = 'draft';
      else if (rec.status === SUBMISSION_STATUS_SUBMITTED) bucket = 'submitted';
      else if (rec.status === SUBMISSION_STATUS_ACCEPTED) bucket = 'accepted';
      else if (rec.status === SUBMISSION_STATUS_REJECTED) bucket = 'rejected';
      else if (rec.status === SUBMISSION_STATUS_REVERTED_BACK)
        bucket = 'reverted_back';
      else bucket = rec.status || 'unknown';

      outWater.push({
        id: String(ws.id),
        tehsil: ws.tehsil,
        village: ws.village,
        settlement: ws.settlement,
        unique_identifier: ws.uniqueIdentifier,
        assigned_operators: operatorsByWaterId[String(ws.id)] || [],
        daily_status: bucket,
        daily_log: rec
          ? { record_id: String(rec.id), status: rec.status }
          : null,
      });
    }

    const outSolar: Record<string, unknown>[] = [];
    for (const ss of solarSystems) {
      const mrec = await this.solarMonthlyRepo.findOne({
        where: { solarSystemId: ss.id, year: solarYear, month: solarMonth },
      });
      outSolar.push({
        id: String(ss.id),
        tehsil: ss.tehsil,
        village: ss.village,
        settlement: ss.settlement,
        unique_identifier: ss.uniqueIdentifier,
        monthly_status: mrec ? 'logged' : 'missing',
        monthly_log: mrec
          ? { record_id: String(mrec.id), has_data: true }
          : null,
      });
    }

    return {
      statusCode: 200,
      body: {
        water_date: this.isoDate(waterDay),
        solar_year: solarYear,
        solar_month: solarMonth,
        water_systems: outWater,
        solar_systems: outSolar,
      },
    };
  }

  async getWaterDailyLoggingRange(
    jwt: JwtContext,
    query: { water_system_id?: string; date_from?: string; date_to?: string },
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    if (!user) return { statusCode: 404, body: { message: 'User not found' } };

    const waterSystemId = (query.water_system_id || '').trim();
    if (!waterSystemId) {
      return {
        statusCode: 400,
        body: { message: 'water_system_id is required' },
      };
    }
    if (!query.date_from || !query.date_to) {
      return {
        statusCode: 400,
        body: { message: 'date_from and date_to are required (YYYY-MM-DD)' },
      };
    }

    const d0 = this.parseIsoDate(query.date_from);
    const d1 = this.parseIsoDate(query.date_to);
    if (!d0 || !d1) {
      return {
        statusCode: 400,
        body: { message: 'Invalid date; use YYYY-MM-DD' },
      };
    }
    if (d1 < d0) {
      return {
        statusCode: 400,
        body: { message: 'date_to must be on or after date_from' },
      };
    }
    const span =
      Math.floor((d1.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (span > 31) {
      return {
        statusCode: 400,
        body: { message: 'Range cannot exceed 31 days' },
      };
    }

    const ws = await this.waterSystemRepo.findOne({
      where: { id: waterSystemId },
    });
    if (!ws) {
      return { statusCode: 404, body: { message: 'Water system not found' } };
    }
    try {
      await this.tehsilAccess.assertUserMayAccessWaterSystem(user, ws);
    } catch (exc) {
      const d = this.tehsilDenied(exc);
      if (d) return d;
      throw exc;
    }

    const opRows = await this.userWaterSystemRepo
      .createQueryBuilder('uws')
      .innerJoinAndSelect('uws.user', 'user')
      .where('uws.water_system_id = :id', { id: ws.id })
      .orderBy('user.name', 'ASC')
      .getMany();
    const assignedOperators = opRows
      .filter((r) => r.user)
      .map((r) => this.operatorPayload(r.user));

    const daysOut: Record<string, unknown>[] = [];
    const cur = new Date(d0);
    while (cur <= d1) {
      const rec = await this.waterDailyRepo.findOne({
        where: { waterSystemId: ws.id, logDate: new Date(cur) },
      });
      const [st, logPayload] = this.waterDailyStatusBucket(rec);
      daysOut.push({
        date: this.isoDate(cur),
        daily_status: st,
        daily_log: logPayload,
      });
      cur.setDate(cur.getDate() + 1);
    }

    return {
      statusCode: 200,
      body: {
        water_system_id: String(ws.id),
        unique_identifier: ws.uniqueIdentifier,
        village: ws.village,
        tehsil: ws.tehsil,
        settlement: ws.settlement,
        date_from: this.isoDate(d0),
        date_to: this.isoDate(d1),
        assigned_operators: assignedOperators,
        days: daysOut,
      },
    };
  }

  async getSolarMonthlyYearRange(
    jwt: JwtContext,
    query: { solar_system_id?: string; year?: string },
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    if (!user) return { statusCode: 404, body: { message: 'User not found' } };

    const solarSystemId = (query.solar_system_id || '').trim();
    const year = query.year ? parseInt(query.year, 10) : NaN;
    if (!solarSystemId) {
      return {
        statusCode: 400,
        body: { message: 'solar_system_id is required' },
      };
    }
    if (!query.year || Number.isNaN(year)) {
      return { statusCode: 400, body: { message: 'year is required' } };
    }
    if (year < 2000 || year > 2100) {
      return { statusCode: 400, body: { message: 'year is out of range' } };
    }

    const ss = await this.solarSystemRepo.findOne({
      where: { id: solarSystemId },
    });
    if (!ss) {
      return { statusCode: 404, body: { message: 'Solar system not found' } };
    }
    try {
      await this.tehsilAccess.assertUserMayAccessSolarSystem(user, ss);
    } catch (exc) {
      const d = this.tehsilDenied(exc);
      if (d) return d;
      throw exc;
    }

    const monthsOut: Record<string, unknown>[] = [];
    for (let month = 1; month <= 12; month++) {
      const mrec = await this.solarMonthlyRepo.findOne({
        where: { solarSystemId: ss.id, year, month },
      });
      monthsOut.push({
        month,
        monthly_status: mrec ? 'logged' : 'missing',
        monthly_log: mrec
          ? { record_id: String(mrec.id), has_data: true }
          : null,
      });
    }

    return {
      statusCode: 200,
      body: {
        solar_system_id: String(ss.id),
        unique_identifier: ss.uniqueIdentifier,
        village: ss.village,
        tehsil: ss.tehsil,
        settlement: ss.settlement,
        year,
        months: monthsOut,
      },
    };
  }

  async listWaterOperatorAssignments(jwt: JwtContext): Promise<ServiceResult> {
    const denied = await this.assertTehsilManagerRequired(jwt);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    if (!user) return { statusCode: 404, body: { message: 'User not found' } };

    const data = await this.userService.listTubewellOperatorAssignments(user);
    return { statusCode: 200, body: data };
  }

  async replaceWaterOperatorAssignments(
    jwt: JwtContext,
    operatorId: string,
    body: Record<string, unknown>,
  ): Promise<ServiceResult> {
    const denied = await this.assertTehsilManagerRequired(jwt);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    if (!user) return { statusCode: 404, body: { message: 'User not found' } };

    const payload = body ?? {};
    const ids = payload.water_system_ids;
    if (ids !== undefined && ids !== null && !Array.isArray(ids)) {
      return {
        statusCode: 400,
        body: { message: 'water_system_ids must be an array' },
      };
    }

    try {
      const updated =
        await this.userService.replaceTubewellOperatorWaterAssignments(
          user,
          operatorId,
          Array.isArray(ids) ? ids.map((id) => String(id)) : [],
        );
      return {
        statusCode: 200,
        body: {
          message: 'Assignments updated',
          user: {
            id: String(updated.id),
            name: updated.name,
            email: updated.email,
            water_system_ids: updated.assignedWaterSystemIds,
          },
        },
      };
    } catch (exc) {
      const d = this.tehsilDenied(exc);
      if (d) return d;
      if (exc instanceof Error) {
        return { statusCode: 400, body: { message: exc.message } };
      }
      throw exc;
    }
  }

  async getTehsilManagerWaterSubmissionDetail(
    jwt: JwtContext,
    submissionId: string,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const currentUser = await this.loadActor(jwt);
    if (!currentUser) {
      return { statusCode: 404, body: { error: 'User not found' } };
    }

    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
    });
    if (!submission) {
      return { statusCode: 404, body: { error: 'Submission not found' } };
    }
    if (submission.submissionType !== 'water_system') {
      return {
        statusCode: 400,
        body: { error: 'Only water submissions are supported' },
      };
    }
    if (
      !(await this.rbac.userCanViewSubmissionDetail(
        currentUser,
        submission,
        jwt.sub,
      ))
    ) {
      return { statusCode: 403, body: { error: 'Access denied' } };
    }

    const detail =
      await this.waterSubmissionDetailService.buildWaterSubmissionDetailResponse(
        submission,
      );
    return { statusCode: 200, body: detail };
  }

  async addWaterSystem(
    jwt: JwtContext,
    data: Record<string, unknown>,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    if (!user) return { statusCode: 404, body: { message: 'User not found' } };

    const ct = canonicalTehsil(data.tehsil as string);
    if (!ct) {
      return {
        statusCode: 400,
        body: { message: 'Invalid or unknown tehsil' },
      };
    }
    try {
      await this.tehsilAccess.assertUserMayAccessTehsil(user, ct, {
        forWrite: true,
      });
    } catch {
      return {
        statusCode: 403,
        body: { message: 'You cannot manage water systems in this tehsil' },
      };
    }

    const village = data.village as string;
    const settlement = (data.settlement as string) || '';

    let uniqueId = data.unique_identifier as string | undefined;
    if (!uniqueId) {
      uniqueId = `WS-${ct.slice(0, 3).toUpperCase()}-${String(village).slice(0, 3).toUpperCase()}-${settlement ? settlement.slice(0, 3).toUpperCase() : 'XXX'}-${uuidv4().slice(0, 8)}`;
    }

    const newSystem = this.waterSystemRepo.create({
      tehsil: ct,
      village,
      settlement,
      uniqueIdentifier: uniqueId,
      latitude: this.toFloatOrNone(data.latitude),
      longitude: this.toFloatOrNone(data.longitude),
      pumpModel: this.operatorHelpers.coerceOptionalStr(data.pump_model),
      pumpSerialNumber: this.operatorHelpers.coerceOptionalStr(
        data.pump_serial_number,
      ),
      startOfOperation: this.operatorHelpers.parseDate(
        this.coerceString(data.start_of_operation),
      ),
      depthOfWaterIntake: this.toFloatOrNone(data.depth_of_water_intake),
      heightToOhr: this.toFloatOrNone(data.height_to_ohr),
      pumpFlowRate: this.toFloatOrNone(data.pump_flow_rate),
      bulkMeterInstalled:
        this.coerceOptionalBool(data.bulk_meter_installed) === true,
      ohrTankCapacity: this.toFloatOrNone(data.ohr_tank_capacity),
      ohrFillRequired: this.toFloatOrNone(data.ohr_fill_required),
      pumpCapacity: this.toFloatOrNone(data.pump_capacity),
      pumpHead: this.toFloatOrNone(data.pump_head),
      pumpHorsePower: this.toFloatOrNone(data.pump_horse_power),
      timeToFill: this.toFloatOrNone(data.time_to_fill),
      createdBy: jwt.sub,
    });

    const meterPayload = this.currentMeterPayload(data, MeterType.TUBEWELL);
    const validation = this.validateWaterSystemMeterLogic({
      ...data,
      meter_model: meterPayload.meter_model,
      meter_serial_number: meterPayload.meter_serial_number,
      meter_accuracy_class: meterPayload.meter_accuracy_class,
      installation_date: this.isoDate(meterPayload.installation_date),
    });
    if (!validation.ok) {
      return { statusCode: 400, body: { message: validation.err } };
    }

    await this.waterSystemRepo.save(newSystem);
    const meterRow = await this.upsertMeter({
      meterType: MeterType.TUBEWELL,
      waterSystemId: String(newSystem.id),
      meterModel: newSystem.bulkMeterInstalled
        ? (meterPayload.meter_model as string | null)
        : null,
      meterSerialNumber: newSystem.bulkMeterInstalled
        ? (meterPayload.meter_serial_number as string | null)
        : null,
      meterAccuracyClass: newSystem.bulkMeterInstalled
        ? (meterPayload.meter_accuracy_class as string | null)
        : null,
      installationDate: newSystem.bulkMeterInstalled
        ? (meterPayload.installation_date as Date | null)
        : null,
      updateMode: this.meterUpdateMode(data),
    });
    if (meterRow) await this.systemMeterRepo.save(meterRow);

    return {
      statusCode: 201,
      body: {
        message: 'Water system added successfully',
        id: String(newSystem.id),
      },
    };
  }

  async addSolarSystem(
    jwt: JwtContext,
    data: Record<string, unknown>,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    if (!user) return { statusCode: 404, body: { message: 'User not found' } };

    const ct = canonicalTehsil(data.tehsil as string);
    if (!ct) {
      return {
        statusCode: 400,
        body: { message: 'Invalid or unknown tehsil' },
      };
    }
    try {
      await this.tehsilAccess.assertUserMayAccessTehsil(user, ct, {
        forWrite: true,
      });
    } catch {
      return {
        statusCode: 403,
        body: { message: 'You cannot manage solar systems in this tehsil' },
      };
    }

    const village = data.village as string;
    if (!village) {
      return { statusCode: 400, body: { message: 'village is required' } };
    }
    const billReferenceNumber = this.operatorHelpers.coerceOptionalStr(
      data.bill_reference_number,
    );
    if (!billReferenceNumber) {
      return {
        statusCode: 400,
        body: { message: 'bill_reference_number is required' },
      };
    }

    const settlementRaw = this.coerceString(data.settlement).trim();
    const settlementDb = settlementRaw || null;

    const solarConnectionDate = this.operatorHelpers.parseDate(
      this.coerceString(data.solar_connection_date || data.installation_date),
    );
    const electricityConnectionDate = this.operatorHelpers.parseDate(
      this.coerceString(data.electricity_connection_date),
    );
    const greenConnectionDate = this.operatorHelpers.parseDate(
      this.coerceString(
        data.green_connection_date || data.green_meter_connection_date,
      ),
    );

    let uniqueId = data.unique_identifier as string | undefined;
    if (!uniqueId) {
      uniqueId = `SS-${ct.slice(0, 3).toUpperCase()}-${village.slice(0, 3).toUpperCase()}-${settlementRaw ? settlementRaw.slice(0, 3).toUpperCase() : 'XXX'}-${uuidv4().slice(0, 8)}`;
    }

    const newSystem = this.solarSystemRepo.create({
      tehsil: ct,
      village,
      settlement: settlementDb,
      uniqueIdentifier: uniqueId,
      latitude: this.operatorHelpers.coerceOptionalFloat(data.latitude),
      longitude: this.operatorHelpers.coerceOptionalFloat(data.longitude),
      installationLocation: data.installation_location as string,
      discoInfo: data.disco_info as string,
      billReferenceNumber,
      solarPanelCapacity: data.solar_panel_capacity as number,
      inverterCapacity: data.inverter_capacity as number,
      inverterSerialNumber: data.inverter_serial_number as string,
      solarConnectionDate,
      electricityConnectionDate,
      greenConnectionDate,
      installationDate: solarConnectionDate,
      greenMeterConnectionDate: greenConnectionDate,
      remarks: data.remarks as string,
      createdBy: jwt.sub,
    });
    await this.solarSystemRepo.save(newSystem);

    const meterPayload = this.currentMeterPayload(data, MeterType.SOLAR, {
      installation_date: greenConnectionDate,
    });
    const meterRow = await this.upsertMeter({
      meterType: MeterType.SOLAR,
      solarSystemId: String(newSystem.id),
      meterModel: meterPayload.meter_model as string | null,
      meterSerialNumber: meterPayload.meter_serial_number as string | null,
      installationDate:
        (meterPayload.installation_date as Date | null) ?? greenConnectionDate,
      updateMode: this.meterUpdateMode(data),
    });
    if (meterRow) await this.systemMeterRepo.save(meterRow);

    return {
      statusCode: 201,
      body: {
        message: 'Solar system added successfully',
        id: String(newSystem.id),
      },
    };
  }

  async submitSolarData(
    jwt: JwtContext,
    data: Record<string, unknown>,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const ss = await this.solarSystemRepo.findOne({
      where: { id: data.solar_system_id as string },
    });
    try {
      await this.tehsilAccess.assertUserMayAccessSolarSystem(user!, ss, {
        forWrite: true,
      });
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this solar system' },
      };
    }

    const { normalized, error } = this.normalizeSolarMonthlyFields(data || {});
    if (error) return { statusCode: 400, body: { message: error } };

    const newRecord = this.solarMonthlyRepo.create({
      solarSystemId: data.solar_system_id as string,
      year: data.year as number,
      month: data.month as number,
      exportOffPeak: normalized.export_off_peak as number | null,
      exportPeak: normalized.export_peak as number | null,
      importOffPeak: normalized.import_off_peak as number | null,
      importPeak: normalized.import_peak as number | null,
      netOffPeak: normalized.net_off_peak as number | null,
      netPeak: normalized.net_peak as number | null,
    });
    await this.solarMonthlyRepo.save(newRecord);
    return {
      statusCode: 201,
      body: {
        message: 'Solar data saved successfully',
        id: String(newRecord.id),
      },
    };
  }

  async updateWaterSystem(
    jwt: JwtContext,
    systemId: string,
    data: Record<string, unknown>,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const system = await this.waterSystemRepo.findOne({
      where: { id: systemId },
    });
    if (!system) {
      return { statusCode: 404, body: { message: 'Water system not found' } };
    }
    try {
      await this.tehsilAccess.assertUserMayAccessWaterSystem(user!, system, {
        forWrite: true,
      });
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this water system' },
      };
    }

    if ('tehsil' in data) {
      const ctNew = canonicalTehsil(data.tehsil as string);
      if (!ctNew || ctNew !== system.tehsil) {
        return {
          statusCode: 400,
          body: { message: 'Cannot change tehsil on an existing water system' },
        };
      }
    }
    if (
      'village' in data &&
      this.coerceString(data.village).trim() !==
        this.coerceString(system.village).trim()
    ) {
      return {
        statusCode: 400,
        body: { message: 'Cannot change village on an existing water system' },
      };
    }
    if ('settlement' in data) {
      const incoming = this.coerceString(data.settlement).trim() || null;
      const current = this.coerceString(system.settlement).trim() || null;
      if (incoming !== current) {
        return {
          statusCode: 400,
          body: {
            message: 'Cannot change settlement on an existing water system',
          },
        };
      }
    }

    if ('pump_model' in data) {
      system.pumpModel = this.operatorHelpers.coerceOptionalStr(
        data.pump_model,
      );
    }
    if ('pump_serial_number' in data) {
      system.pumpSerialNumber = this.operatorHelpers.coerceOptionalStr(
        data.pump_serial_number,
      );
    }
    if ('start_of_operation' in data) {
      system.startOfOperation = this.operatorHelpers.parseDate(
        this.coerceString(data.start_of_operation),
      );
    }
    try {
      if ('latitude' in data) {
        system.latitude = this.operatorHelpers.coerceOptionalFloat(
          data.latitude,
        );
      }
      if ('longitude' in data) {
        system.longitude = this.operatorHelpers.coerceOptionalFloat(
          data.longitude,
        );
      }
      if ('depth_of_water_intake' in data) {
        system.depthOfWaterIntake = this.operatorHelpers.coerceOptionalFloat(
          data.depth_of_water_intake,
        );
      }
      if ('height_to_ohr' in data) {
        system.heightToOhr = this.operatorHelpers.coerceOptionalFloat(
          data.height_to_ohr,
        );
      }
      if ('pump_flow_rate' in data) {
        system.pumpFlowRate = this.operatorHelpers.coerceOptionalFloat(
          data.pump_flow_rate,
        );
      }
    } catch (exc) {
      return { statusCode: 400, body: { message: String(exc) } };
    }

    if ('bulk_meter_installed' in data) {
      const bmi = this.coerceOptionalBool(data.bulk_meter_installed);
      if (bmi === null) {
        return {
          statusCode: 400,
          body: { message: 'bulk_meter_installed must be boolean' },
        };
      }
      system.bulkMeterInstalled = bmi;
    }

    const activeMeter = await this.getActiveMeter(system);
    const meterPayload = this.currentMeterPayload(data, MeterType.TUBEWELL, {
      meter_model: activeMeter?.meterModel,
      meter_serial_number: activeMeter?.meterSerialNumber,
      meter_accuracy_class: activeMeter?.meterAccuracyClass,
      installation_date: activeMeter?.installationDate,
    });

    try {
      if ('ohr_tank_capacity' in data) {
        system.ohrTankCapacity = this.operatorHelpers.coerceOptionalFloat(
          data.ohr_tank_capacity,
        );
      }
      if ('ohr_fill_required' in data) {
        system.ohrFillRequired = this.operatorHelpers.coerceOptionalFloat(
          data.ohr_fill_required,
        );
      }
      if ('pump_capacity' in data) {
        system.pumpCapacity = this.operatorHelpers.coerceOptionalFloat(
          data.pump_capacity,
        );
      }
      if ('pump_head' in data) {
        system.pumpHead = this.operatorHelpers.coerceOptionalFloat(
          data.pump_head,
        );
      }
      if ('pump_horse_power' in data) {
        system.pumpHorsePower = this.operatorHelpers.coerceOptionalFloat(
          data.pump_horse_power,
        );
      }
      if ('time_to_fill' in data) {
        system.timeToFill = this.operatorHelpers.coerceOptionalFloat(
          data.time_to_fill,
        );
      }
    } catch (exc) {
      return { statusCode: 400, body: { message: String(exc) } };
    }

    const validation = this.validateWaterSystemMeterLogic({
      bulk_meter_installed: system.bulkMeterInstalled,
      meter_model: meterPayload.meter_model,
      meter_serial_number: meterPayload.meter_serial_number,
      meter_accuracy_class: meterPayload.meter_accuracy_class,
      installation_date: this.isoDate(meterPayload.installation_date),
      ohr_tank_capacity: system.ohrTankCapacity,
      ohr_fill_required: system.ohrFillRequired,
      pump_capacity: system.pumpCapacity,
      pump_head: system.pumpHead,
      pump_horse_power: system.pumpHorsePower,
      time_to_fill: system.timeToFill,
    });
    if (!validation.ok) {
      return { statusCode: 400, body: { message: validation.err } };
    }

    const meterRow = await this.upsertMeter({
      meterType: MeterType.TUBEWELL,
      waterSystemId: String(system.id),
      meterModel: system.bulkMeterInstalled
        ? (meterPayload.meter_model as string | null)
        : null,
      meterSerialNumber: system.bulkMeterInstalled
        ? (meterPayload.meter_serial_number as string | null)
        : null,
      meterAccuracyClass: system.bulkMeterInstalled
        ? (meterPayload.meter_accuracy_class as string | null)
        : null,
      installationDate: system.bulkMeterInstalled
        ? (meterPayload.installation_date as Date | null)
        : null,
      updateMode: this.meterUpdateMode(data),
    });
    if (meterRow) await this.systemMeterRepo.save(meterRow);

    try {
      await this.waterSystemRepo.save(system);
      return {
        statusCode: 200,
        body: {
          message: 'Water system updated successfully',
          id: String(system.id),
          updated_at: system.updatedAt?.toISOString() ?? null,
        },
      };
    } catch (e) {
      return {
        statusCode: 500,
        body: { message: 'Error updating system', error: String(e) },
      };
    }
  }

  async getWaterSystem(
    jwt: JwtContext,
    systemId: string,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const system = await this.waterSystemRepo.findOne({
      where: { id: systemId },
    });
    if (!system) {
      return { statusCode: 404, body: { message: 'Water system not found' } };
    }
    try {
      await this.tehsilAccess.assertUserMayAccessWaterSystem(user!, system);
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this water system' },
      };
    }

    const activeMeter = await this.getActiveMeter(system);
    const meters = await this.meterHistoryPayload(system, MeterType.TUBEWELL);
    return {
      statusCode: 200,
      body: {
        id: String(system.id),
        tehsil: system.tehsil,
        village: system.village,
        settlement: system.settlement || '',
        unique_identifier: system.uniqueIdentifier,
        latitude: system.latitude,
        longitude: system.longitude,
        pump_model: system.pumpModel,
        pump_serial_number: system.pumpSerialNumber,
        start_of_operation: system.startOfOperation
          ? this.isoDate(system.startOfOperation)
          : null,
        depth_of_water_intake: system.depthOfWaterIntake,
        height_to_ohr: system.heightToOhr,
        pump_flow_rate: system.pumpFlowRate,
        bulk_meter_installed: system.bulkMeterInstalled,
        ohr_tank_capacity: system.ohrTankCapacity,
        ohr_fill_required: system.ohrFillRequired,
        pump_capacity: system.pumpCapacity,
        pump_head: system.pumpHead,
        pump_horse_power: system.pumpHorsePower,
        time_to_fill: system.timeToFill,
        meter_model: activeMeter?.meterModel ?? null,
        meter_serial_number: activeMeter?.meterSerialNumber ?? null,
        meter_accuracy_class: activeMeter?.meterAccuracyClass ?? null,
        installation_date: activeMeter?.installationDate
          ? this.isoDate(activeMeter.installationDate)
          : null,
        current_meter: this.operatorHelpers.meterToDict(activeMeter),
        meters,
        created_by: system.createdBy,
        created_at: system.createdAt?.toISOString() ?? null,
        updated_at: system.updatedAt?.toISOString() ?? null,
      },
    };
  }

  async getWaterSystemCalibrationCertificate(
    jwt: JwtContext,
    systemId: string,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const system = await this.waterSystemRepo.findOne({
      where: { id: systemId },
    });
    if (!system) {
      return { statusCode: 404, body: { message: 'Water system not found' } };
    }
    try {
      await this.tehsilAccess.assertUserMayAccessWaterSystem(user!, system);
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this water system' },
      };
    }

    const certs = await this.calibrationCertRepo.find({
      where: { waterSystemId: system.id },
      order: { uploadedAt: 'DESC' },
    });
    return {
      statusCode: 200,
      body: certs.map((c) => ({
        id: String(c.id),
        water_system_id: String(c.waterSystemId),
        file_url: c.fileUrl,
        uploaded_at: c.uploadedAt?.toISOString() ?? null,
        expiry_date: c.expiryDate ? this.isoDate(c.expiryDate) : null,
        is_active: Boolean(c.isActive),
        created_at: c.createdAt?.toISOString() ?? null,
        updated_at: c.updatedAt?.toISOString() ?? null,
      })) as unknown as Record<string, unknown>,
    };
  }

  async putWaterSystemCalibrationCertificate(
    jwt: JwtContext,
    systemId: string,
    data: Record<string, unknown>,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const system = await this.waterSystemRepo.findOne({
      where: { id: systemId },
    });
    if (!system) {
      return { statusCode: 404, body: { message: 'Water system not found' } };
    }
    try {
      await this.tehsilAccess.assertUserMayAccessWaterSystem(user!, system, {
        forWrite: true,
      });
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this water system' },
      };
    }

    const payload = data ?? {};
    const fileUrl = this.coerceString(payload.file_url).trim();
    if (!fileUrl) {
      return { statusCode: 400, body: { message: 'file_url is required' } };
    }
    const expiryRaw = this.coerceString(payload.expiry_date).trim();
    if (!expiryRaw) {
      return {
        statusCode: 400,
        body: { message: 'expiry_date is required (YYYY-MM-DD)' },
      };
    }
    const expiryDate = this.operatorHelpers.parseDate(expiryRaw);
    if (!expiryDate) {
      return {
        statusCode: 400,
        body: { message: 'Invalid expiry_date; use YYYY-MM-DD' },
      };
    }

    await this.calibrationCertRepo.update(
      { waterSystemId: system.id, isActive: true },
      { isActive: false },
    );

    const cert = this.calibrationCertRepo.create({
      waterSystemId: system.id,
      fileUrl,
      uploadedAt: new Date(),
      expiryDate,
      isActive: true,
    });
    await this.calibrationCertRepo.save(cert);

    return {
      statusCode: 200,
      body: {
        message: 'Calibration certificate saved',
        id: String(cert.id),
        water_system_id: String(cert.waterSystemId),
        uploaded_at: cert.uploadedAt?.toISOString() ?? null,
        expiry_date: cert.expiryDate ? this.isoDate(cert.expiryDate) : null,
      },
    };
  }

  async listActiveWaterSystemCalibrationCertificates(
    jwt: JwtContext,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    if (!user) return { statusCode: 404, body: { message: 'User not found' } };

    const jwtScopeTehsils = this.scopeTehsilsFromJwt(jwt);
    const out: Record<string, unknown>[] = [];

    const certWhere: Record<string, unknown> = { isActive: true };
    const certs = await this.calibrationCertRepo.find({
      where: certWhere as never,
    });

    for (const cert of certs) {
      const ws = await this.waterSystemRepo.findOne({
        where: { id: cert.waterSystemId },
      });
      if (!ws) continue;
      if (jwtScopeTehsils.length && !jwtScopeTehsils.includes(ws.tehsil))
        continue;
      try {
        await this.tehsilAccess.assertUserMayAccessWaterSystem(user, ws);
      } catch {
        continue;
      }
      out.push({
        water_system: {
          id: String(ws.id),
          unique_identifier: ws.uniqueIdentifier,
          tehsil: ws.tehsil,
          village: ws.village,
          settlement: ws.settlement || '',
        },
        certificate: {
          id: String(cert.id),
          water_system_id: String(cert.waterSystemId),
          file_url: cert.fileUrl,
          uploaded_at: cert.uploadedAt?.toISOString() ?? null,
          expiry_date: cert.expiryDate ? this.isoDate(cert.expiryDate) : null,
        },
      });
    }

    out.sort((a, b) => {
      const wa = (
        a.water_system as Record<string, string>
      ).tehsil.localeCompare((b.water_system as Record<string, string>).tehsil);
      if (wa !== 0) return wa;
      const wv = (
        a.water_system as Record<string, string>
      ).village.localeCompare(
        (b.water_system as Record<string, string>).village,
      );
      if (wv !== 0) return wv;
      return (
        a.water_system as Record<string, string>
      ).unique_identifier.localeCompare(
        (b.water_system as Record<string, string>).unique_identifier,
      );
    });

    return { statusCode: 200, body: out as unknown as Record<string, unknown> };
  }

  async deleteWaterSystem(
    jwt: JwtContext,
    systemId: string,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const system = await this.waterSystemRepo.findOne({
      where: { id: systemId },
    });
    if (!system) {
      return { statusCode: 404, body: { message: 'Water system not found' } };
    }
    try {
      await this.tehsilAccess.assertUserMayAccessWaterSystem(user!, system, {
        forWrite: true,
      });
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this water system' },
      };
    }

    await this.waterDailyRepo.delete({ waterSystemId: systemId });
    await this.waterSystemRepo.delete({ id: systemId });
    return {
      statusCode: 200,
      body: { message: 'Water system deleted successfully' },
    };
  }

  async getSolarSystems(
    jwt: JwtContext,
    query: { tehsil?: string; village?: string },
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    if (!user) return { statusCode: 404, body: { message: 'User not found' } };

    const ts = [...(await this.rbac.userAssignedTehsils(user))];
    const filterTehsil = query.tehsil;
    const filterVillage = query.village;

    let systems: SolarSystem[];
    if (ts.length) {
      systems = await this.solarSystemRepo.find({ where: { tehsil: In(ts) } });
    } else {
      return {
        statusCode: 200,
        body: [] as unknown as Record<string, unknown>,
      };
    }

    if (filterTehsil && filterTehsil !== 'All Tehsils') {
      systems = systems.filter((s) => s.tehsil === filterTehsil);
    }
    if (filterVillage && filterVillage !== 'All Villages') {
      systems = systems.filter((s) => s.village === filterVillage);
    }

    const systemIds = systems.map((s) => s.id);
    const monthlyCounts: Record<string, number> = {};
    if (systemIds.length) {
      const counts = await this.solarMonthlyRepo
        .createQueryBuilder('m')
        .select('m.solar_system_id', 'systemId')
        .addSelect('COUNT(m.id)', 'total')
        .where('m.solar_system_id IN (:...ids)', { ids: systemIds })
        .groupBy('m.solar_system_id')
        .getRawMany<{ systemId: string; total: string }>();
      for (const row of counts) {
        monthlyCounts[String(row.systemId)] = parseInt(row.total, 10) || 0;
      }
    }

    const result: Record<string, unknown>[] = [];
    for (const s of systems) {
      const activeMeter = await this.getActiveMeter(s);
      const meters = await this.meterHistoryPayload(s, MeterType.SOLAR);
      result.push({
        id: String(s.id),
        tehsil: s.tehsil,
        village: s.village,
        settlement: s.settlement,
        unique_identifier: s.uniqueIdentifier,
        latitude: s.latitude,
        longitude: s.longitude,
        installation_location: s.installationLocation,
        disco_info: s.discoInfo,
        bill_reference_number: s.billReferenceNumber,
        solar_panel_capacity: s.solarPanelCapacity,
        inverter_capacity: s.inverterCapacity,
        inverter_serial_number: s.inverterSerialNumber,
        solar_connection_date: s.solarConnectionDate
          ? this.isoDate(s.solarConnectionDate)
          : null,
        electricity_connection_date: s.electricityConnectionDate
          ? this.isoDate(s.electricityConnectionDate)
          : null,
        green_connection_date: s.greenConnectionDate
          ? this.isoDate(s.greenConnectionDate)
          : null,
        installation_date: s.installationDate
          ? this.isoDate(s.installationDate)
          : null,
        meter_model: activeMeter?.meterModel ?? null,
        meter_serial_number: activeMeter?.meterSerialNumber ?? null,
        green_meter_connection_date: s.greenMeterConnectionDate
          ? this.isoDate(s.greenMeterConnectionDate)
          : null,
        current_meter: this.operatorHelpers.meterToDict(activeMeter),
        meters,
        remarks: s.remarks,
        created_by: s.createdBy,
        created_at: toIsoDateTimeString(s.createdAt),
        updated_at: toIsoDateTimeString(s.updatedAt),
        monthly_log_count: monthlyCounts[String(s.id)] || 0,
      });
    }

    return {
      statusCode: 200,
      body: result as unknown as Record<string, unknown>,
    };
  }

  async deleteSolarSystem(
    jwt: JwtContext,
    systemId: string,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const system = await this.solarSystemRepo.findOne({
      where: { id: systemId },
    });
    if (!system) {
      return { statusCode: 404, body: { message: 'Solar system not found' } };
    }
    try {
      await this.tehsilAccess.assertUserMayAccessSolarSystem(user!, system, {
        forWrite: true,
      });
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this solar system' },
      };
    }

    const logCount = await this.solarMonthlyRepo.count({
      where: { solarSystemId: systemId },
    });
    if (logCount > 0) {
      return {
        statusCode: 409,
        body: {
          message:
            'This solar site has monthly energy submissions and cannot be deleted. Remove those monthly records first if your process allows it, or contact operations.',
        },
      };
    }

    await this.solarSystemRepo.delete({ id: systemId });
    return {
      statusCode: 200,
      body: { message: 'Solar system deleted successfully' },
    };
  }

  async getSolarSystem(
    jwt: JwtContext,
    systemId: string,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const system = await this.solarSystemRepo.findOne({
      where: { id: systemId },
    });
    if (!system) {
      return { statusCode: 404, body: { message: 'Solar system not found' } };
    }
    try {
      await this.tehsilAccess.assertUserMayAccessSolarSystem(user!, system);
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this solar system' },
      };
    }

    const activeMeter = await this.getActiveMeter(system);
    const meters = await this.meterHistoryPayload(system, MeterType.SOLAR);
    const monthlyLogCount = await this.solarMonthlyRepo.count({
      where: { solarSystemId: system.id },
    });

    return {
      statusCode: 200,
      body: {
        id: String(system.id),
        tehsil: system.tehsil,
        village: system.village,
        settlement: system.settlement || '',
        unique_identifier: system.uniqueIdentifier,
        latitude: system.latitude,
        longitude: system.longitude,
        installation_location: system.installationLocation,
        disco_info: system.discoInfo,
        bill_reference_number: system.billReferenceNumber,
        solar_panel_capacity: system.solarPanelCapacity,
        inverter_capacity: system.inverterCapacity,
        inverter_serial_number: system.inverterSerialNumber,
        solar_connection_date: system.solarConnectionDate
          ? this.isoDate(system.solarConnectionDate)
          : null,
        electricity_connection_date: system.electricityConnectionDate
          ? this.isoDate(system.electricityConnectionDate)
          : null,
        green_connection_date: system.greenConnectionDate
          ? this.isoDate(system.greenConnectionDate)
          : null,
        installation_date: system.installationDate
          ? this.isoDate(system.installationDate)
          : null,
        meter_model: activeMeter?.meterModel ?? null,
        meter_serial_number: activeMeter?.meterSerialNumber ?? null,
        green_meter_connection_date: system.greenMeterConnectionDate
          ? this.isoDate(system.greenMeterConnectionDate)
          : null,
        current_meter: this.operatorHelpers.meterToDict(activeMeter),
        meters,
        remarks: system.remarks,
        created_at: system.createdAt?.toISOString() ?? null,
        updated_at: system.updatedAt?.toISOString() ?? null,
        monthly_log_count: monthlyLogCount,
      },
    };
  }

  async updateSolarSystem(
    jwt: JwtContext,
    systemId: string,
    data: Record<string, unknown>,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const system = await this.solarSystemRepo.findOne({
      where: { id: systemId },
    });
    if (!system) {
      return { statusCode: 404, body: { message: 'Solar system not found' } };
    }
    try {
      await this.tehsilAccess.assertUserMayAccessSolarSystem(user!, system, {
        forWrite: true,
      });
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this solar system' },
      };
    }

    if ('tehsil' in data) {
      const ctNew = canonicalTehsil(data.tehsil as string);
      if (!ctNew || ctNew !== system.tehsil) {
        return {
          statusCode: 400,
          body: { message: 'Cannot change tehsil on an existing solar site' },
        };
      }
    }
    if (
      'village' in data &&
      this.coerceString(data.village).trim() !==
        this.coerceString(system.village).trim()
    ) {
      return {
        statusCode: 400,
        body: { message: 'Cannot change village on an existing solar site' },
      };
    }
    if ('settlement' in data) {
      const incoming = this.coerceString(data.settlement).trim() || null;
      const current = this.coerceString(system.settlement).trim() || null;
      if (incoming !== current) {
        return {
          statusCode: 400,
          body: {
            message: 'Cannot change settlement on an existing solar site',
          },
        };
      }
    }

    if ('installation_location' in data) {
      system.installationLocation = this.operatorHelpers.coerceOptionalStr(
        data.installation_location,
      );
    }
    if ('disco_info' in data) {
      system.discoInfo = this.operatorHelpers.coerceOptionalStr(
        data.disco_info,
      );
    }
    if ('bill_reference_number' in data) {
      system.billReferenceNumber = this.operatorHelpers.coerceOptionalStr(
        data.bill_reference_number,
      );
    }
    if (!this.operatorHelpers.coerceOptionalStr(system.billReferenceNumber)) {
      return {
        statusCode: 400,
        body: { message: 'bill_reference_number is required' },
      };
    }

    try {
      if ('latitude' in data) {
        system.latitude = this.operatorHelpers.coerceOptionalFloat(
          data.latitude,
        );
      }
      if ('longitude' in data) {
        system.longitude = this.operatorHelpers.coerceOptionalFloat(
          data.longitude,
        );
      }
      if ('solar_panel_capacity' in data) {
        system.solarPanelCapacity = this.operatorHelpers.coerceOptionalFloat(
          data.solar_panel_capacity,
        );
      }
      if ('inverter_capacity' in data) {
        system.inverterCapacity = this.operatorHelpers.coerceOptionalFloat(
          data.inverter_capacity,
        );
      }
    } catch (exc) {
      return { statusCode: 400, body: { message: String(exc) } };
    }

    if ('inverter_serial_number' in data) {
      system.inverterSerialNumber = this.operatorHelpers.coerceOptionalStr(
        data.inverter_serial_number,
      );
    }

    let solarConnectionDate: Date | null = null;
    if ('solar_connection_date' in data) {
      solarConnectionDate = this.operatorHelpers.parseDate(
        this.coerceString(data.solar_connection_date),
      );
    }
    if (solarConnectionDate === null && 'installation_date' in data) {
      solarConnectionDate = this.operatorHelpers.parseDate(
        this.coerceString(data.installation_date),
      );
    }
    if (solarConnectionDate !== null) {
      system.solarConnectionDate = solarConnectionDate;
      system.installationDate = solarConnectionDate;
    }
    if ('electricity_connection_date' in data) {
      system.electricityConnectionDate = this.operatorHelpers.parseDate(
        this.coerceString(data.electricity_connection_date),
      );
    }
    let greenConnectionDate: Date | null = null;
    if ('green_connection_date' in data) {
      greenConnectionDate = this.operatorHelpers.parseDate(
        this.coerceString(data.green_connection_date),
      );
    }
    if (greenConnectionDate === null && 'green_meter_connection_date' in data) {
      greenConnectionDate = this.operatorHelpers.parseDate(
        this.coerceString(data.green_meter_connection_date),
      );
    }
    if (greenConnectionDate !== null) {
      system.greenConnectionDate = greenConnectionDate;
      system.greenMeterConnectionDate = greenConnectionDate;
    }
    if ('remarks' in data) {
      system.remarks = this.operatorHelpers.coerceOptionalStr(data.remarks);
    }

    const activeMeter = await this.getActiveMeter(system);
    const meterPayload = this.currentMeterPayload(data, MeterType.SOLAR, {
      meter_model: activeMeter?.meterModel,
      meter_serial_number: activeMeter?.meterSerialNumber,
      installation_date:
        activeMeter?.installationDate ?? system.greenConnectionDate,
    });
    const meterRow = await this.upsertMeter({
      meterType: MeterType.SOLAR,
      solarSystemId: String(system.id),
      meterModel: meterPayload.meter_model as string | null,
      meterSerialNumber: meterPayload.meter_serial_number as string | null,
      installationDate:
        (meterPayload.installation_date as Date | null) ??
        system.greenConnectionDate,
      updateMode: this.meterUpdateMode(data),
    });
    if (meterRow) await this.systemMeterRepo.save(meterRow);

    try {
      await this.solarSystemRepo.save(system);
      return {
        statusCode: 200,
        body: {
          message: 'Solar system updated successfully',
          id: String(system.id),
          updated_at: system.updatedAt?.toISOString() ?? null,
        },
      };
    } catch (e) {
      return {
        statusCode: 500,
        body: { message: 'Error updating system', error: String(e) },
      };
    }
  }

  async getSolarSystemConfig(
    jwt: JwtContext,
    query: { tehsil?: string; village?: string; settlement?: string },
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const tehsil = query.tehsil;
    const village = query.village;
    const settlement = query.settlement || '';

    if (!tehsil || !village) {
      return {
        statusCode: 400,
        body: { message: 'Tehsil and village are required' },
      };
    }

    const ct = canonicalTehsil(tehsil);
    if (!ct) return { statusCode: 400, body: { message: 'Invalid tehsil' } };
    try {
      await this.tehsilAccess.assertUserMayAccessTehsil(user!, ct);
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this tehsil' },
      };
    }

    const system = await this.operatorHelpers.findSolarSystemByLocation(
      ct,
      village,
      settlement,
      this.solarSystemRepo,
    );

    if (system) {
      const activeMeter = await this.getActiveMeter(system);
      const meters = await this.meterHistoryPayload(system, MeterType.SOLAR);
      const monthlyLogCount = await this.solarMonthlyRepo.count({
        where: { solarSystemId: system.id },
      });
      return {
        statusCode: 200,
        body: {
          exists: true,
          config: {
            id: String(system.id),
            installation_location: system.installationLocation,
            disco_info: system.discoInfo,
            bill_reference_number: system.billReferenceNumber,
            solar_panel_capacity: system.solarPanelCapacity,
            inverter_capacity: system.inverterCapacity,
            inverter_serial_number: system.inverterSerialNumber,
            solar_connection_date: system.solarConnectionDate
              ? this.isoDate(system.solarConnectionDate)
              : null,
            electricity_connection_date: system.electricityConnectionDate
              ? this.isoDate(system.electricityConnectionDate)
              : null,
            green_connection_date: system.greenConnectionDate
              ? this.isoDate(system.greenConnectionDate)
              : null,
            installation_date: system.installationDate
              ? this.isoDate(system.installationDate)
              : null,
            meter_model: activeMeter?.meterModel ?? null,
            meter_serial_number: activeMeter?.meterSerialNumber ?? null,
            green_meter_connection_date: system.greenMeterConnectionDate
              ? this.isoDate(system.greenMeterConnectionDate)
              : null,
            current_meter: this.operatorHelpers.meterToDict(activeMeter),
            meters,
            remarks: system.remarks,
            created_at: system.createdAt?.toISOString() ?? null,
            updated_at: system.updatedAt?.toISOString() ?? null,
            monthly_log_count: monthlyLogCount,
          },
        },
      };
    }

    return { statusCode: 200, body: { exists: false, config: null } };
  }

  async getSolarSupplyData(
    jwt: JwtContext,
    query: {
      tehsil?: string;
      village?: string;
      settlement?: string;
      year?: string;
    },
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const tehsil = query.tehsil;
    const village = query.village;
    const settlement = query.settlement || '';
    const year = query.year ? parseInt(query.year, 10) : undefined;

    if (!tehsil || !village) {
      return {
        statusCode: 400,
        body: { message: 'Tehsil and village are required' },
      };
    }

    const ct = canonicalTehsil(tehsil);
    if (!ct) return { statusCode: 400, body: { message: 'Invalid tehsil' } };
    try {
      await this.tehsilAccess.assertUserMayAccessTehsil(user!, ct);
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this tehsil' },
      };
    }

    const system = await this.operatorHelpers.findSolarSystemByLocation(
      ct,
      village,
      settlement,
      this.solarSystemRepo,
    );
    if (!system) {
      return {
        statusCode: 200,
        body: [] as unknown as Record<string, unknown>,
      };
    }

    const where: Record<string, unknown> = { solarSystemId: system.id };
    if (year) where.year = year;
    const records = await this.solarMonthlyRepo.find({
      where: where as never,
      order: { month: 'ASC' },
    });

    const out = records.map((r) => ({
      id: String(r.id),
      year: r.year,
      month: r.month,
      export_off_peak: r.exportOffPeak,
      export_peak: r.exportPeak,
      import_off_peak: r.importOffPeak,
      import_peak: r.importPeak,
      net_off_peak: r.netOffPeak,
      net_peak: r.netPeak,
      remarks: r.remarks,
      electricity_bill_image_url: r.electricityBillImageUrl,
      created_at: r.createdAt?.toISOString() ?? null,
      updated_at: r.updatedAt?.toISOString() ?? null,
      ...this.solarMonthlyResponseFields(r),
    }));

    return { statusCode: 200, body: out as unknown as Record<string, unknown> };
  }

  async getSolarSupplyDataRecord(
    jwt: JwtContext,
    recordId: string,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const record = await this.solarMonthlyRepo.findOne({
      where: { id: recordId },
    });
    if (!record) {
      return {
        statusCode: 404,
        body: { message: 'Monthly solar record not found' },
      };
    }
    const system = await this.solarSystemRepo.findOne({
      where: { id: record.solarSystemId },
    });
    try {
      await this.tehsilAccess.assertUserMayAccessSolarSystem(user!, system);
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this solar site' },
      };
    }

    const derived = this.solarMonthlyResponseFields(record);
    return {
      statusCode: 200,
      body: {
        id: String(record.id),
        solar_system_id: String(record.solarSystemId),
        tehsil: system!.tehsil,
        village: system!.village,
        settlement: system!.settlement || '',
        year: record.year,
        month: record.month,
        export_off_peak: record.exportOffPeak,
        export_peak: record.exportPeak,
        import_off_peak: record.importOffPeak,
        import_peak: record.importPeak,
        net_off_peak: record.netOffPeak,
        net_peak: record.netPeak,
        remarks: record.remarks,
        electricity_bill_image_url: record.electricityBillImageUrl,
        created_at: record.createdAt?.toISOString() ?? null,
        updated_at: record.updatedAt?.toISOString() ?? null,
        ...derived,
      },
    };
  }

  async updateSolarSupplyDataRecord(
    jwt: JwtContext,
    recordId: string,
    data: Record<string, unknown>,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    if (!user) return { statusCode: 404, body: { message: 'User not found' } };

    const record = await this.solarMonthlyRepo.findOne({
      where: { id: recordId },
    });
    if (!record) {
      return {
        statusCode: 404,
        body: { message: 'Monthly solar record not found' },
      };
    }
    const system = await this.solarSystemRepo.findOne({
      where: { id: record.solarSystemId },
    });
    try {
      await this.tehsilAccess.assertUserMayAccessSolarSystem(user, system, {
        forWrite: true,
      });
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this solar site' },
      };
    }

    const payload = data ?? {};
    const { normalized, error } = this.normalizeSolarMonthlyFields(payload);
    if (error) return { statusCode: 400, body: { message: error } };
    this.applySolarNormalized(record, normalized);

    if ('remarks' in payload) {
      record.remarks = payload.remarks as string;
    }

    const newUrl = (payload.image_url || payload.image_path) as
      string | undefined;
    if (
      newUrl &&
      String(newUrl).trim() !== (record.electricityBillImageUrl || '')
    ) {
      await this.storageService.tryDeletePublicObject(
        record.electricityBillImageUrl,
      );
      record.electricityBillImageUrl = String(newUrl).trim() || null;
    }

    await this.solarMonthlyRepo.save(record);
    return {
      statusCode: 200,
      body: {
        message: 'Monthly solar record updated',
        id: String(record.id),
        updated_at: record.updatedAt?.toISOString() ?? null,
      },
    };
  }

  async deleteSolarSupplyDataRecord(
    jwt: JwtContext,
    recordId: string,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const user = await this.loadActor(jwt);
    const record = await this.solarMonthlyRepo.findOne({
      where: { id: recordId },
    });
    if (!record) {
      return {
        statusCode: 404,
        body: { message: 'Monthly solar record not found' },
      };
    }
    const system = await this.solarSystemRepo.findOne({
      where: { id: record.solarSystemId },
    });
    try {
      await this.tehsilAccess.assertUserMayAccessSolarSystem(user!, system, {
        forWrite: true,
      });
    } catch {
      return {
        statusCode: 403,
        body: { message: 'Access denied for this solar site' },
      };
    }

    await this.storageService.tryDeletePublicObject(
      record.electricityBillImageUrl,
    );
    const legacySub = await this.submissionRepo.findOne({
      where: { recordId: String(record.id) },
    });
    if (legacySub) {
      await this.verificationLogRepo.delete({ submissionId: legacySub.id });
      await this.notificationRepo.delete({ submissionId: legacySub.id });
      await this.submissionRepo.delete({ id: legacySub.id });
    }
    await this.solarMonthlyRepo.delete({ id: record.id });
    return {
      statusCode: 200,
      body: { message: 'Monthly solar record deleted' },
    };
  }

  async saveSolarSupplyData(
    jwt: JwtContext,
    data: Record<string, unknown>,
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const rows = (data.data as Record<string, unknown>[]) || [];
    const year = (data.year as number) ?? new Date().getFullYear();
    const imageUrl = (data.image_url || data.image_path) as string | undefined;

    if (!rows.length) {
      return { statusCode: 400, body: { message: 'No data provided' } };
    }

    const opUser = await this.loadActor(jwt);
    if (!opUser)
      return { statusCode: 404, body: { message: 'User not found' } };

    const savedIds: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const ct = canonicalTehsil(row.tehsil as string);
        if (!ct) {
          errors.push(`Row ${i + 1}: invalid tehsil`);
          continue;
        }
        try {
          await this.tehsilAccess.assertUserMayAccessTehsil(opUser, ct, {
            forWrite: true,
          });
        } catch {
          errors.push(`Row ${i + 1}: tehsil not permitted for your account`);
          continue;
        }

        const system = await this.operatorHelpers.findSolarSystemByLocation(
          ct,
          row.village as string,
          row.settlement as string,
          this.solarSystemRepo,
        );
        if (!system) {
          errors.push(
            `Row ${i + 1}: No solar system for this location — your tehsil manager must register it first`,
          );
          continue;
        }

        const monthlyData =
          (row.monthlyData as Record<string, unknown>[]) || [];
        let rowEnergyError = false;
        for (const monthRecord of monthlyData) {
          const month = monthRecord.month as number;
          const { normalized, error } = this.normalizeSolarMonthlyFields(
            monthRecord || {},
          );
          if (error) {
            errors.push(
              `Row ${i + 1}, month ${this.coerceString(monthRecord.month)}: ${error}`,
            );
            rowEnergyError = true;
            break;
          }

          const existing = await this.solarMonthlyRepo.findOne({
            where: { solarSystemId: system.id, year, month },
          });

          if (existing) {
            this.applySolarNormalized(existing, normalized);
            if ('remarks' in monthRecord) {
              existing.remarks = monthRecord.remarks as string;
            }
            if (
              imageUrl &&
              (existing.electricityBillImageUrl || '') !==
                String(imageUrl).trim()
            ) {
              await this.storageService.tryDeletePublicObject(
                existing.electricityBillImageUrl,
              );
              existing.electricityBillImageUrl = String(imageUrl).trim();
            }
            await this.solarMonthlyRepo.save(existing);
          } else {
            const newRecord = this.solarMonthlyRepo.create({
              solarSystemId: system.id,
              year,
              month,
              exportOffPeak: normalized.export_off_peak as number | null,
              exportPeak: normalized.export_peak as number | null,
              importOffPeak: normalized.import_off_peak as number | null,
              importPeak: normalized.import_peak as number | null,
              netOffPeak: normalized.net_off_peak as number | null,
              netPeak: normalized.net_peak as number | null,
              electricityBillImageUrl: imageUrl
                ? String(imageUrl).trim()
                : null,
              remarks: monthRecord.remarks as string,
            });
            await this.solarMonthlyRepo.save(newRecord);
          }
        }

        if (rowEnergyError) continue;
        savedIds.push(String(system.id));
      } catch (e) {
        errors.push(`Row ${i + 1}: ${String(e)}`);
      }
    }

    if (errors.length) {
      return {
        statusCode: 400,
        body: { message: 'Validation errors', errors },
      };
    }

    return {
      statusCode: 201,
      body: {
        message: `Saved solar data for ${savedIds.length} location(s)`,
        ids: savedIds,
      },
    };
  }

  async getPendingSubmissions(jwt: JwtContext): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const currentUser = await this.loadActor(jwt);
    const statuses = [
      SUBMISSION_STATUS_SUBMITTED,
      SUBMISSION_STATUS_REJECTED,
      SUBMISSION_STATUS_ACCEPTED,
      SUBMISSION_STATUS_REVERTED_BACK,
    ];

    let submissions = await this.submissionRepo.find({
      where: {
        status: In(statuses),
        submissionType: 'water_system',
      },
      order: { submittedAt: 'ASC' },
    });

    if (this.rbac.userRoleCode(currentUser!) === ADMIN) {
      const filtered = [];
      for (const s of submissions) {
        if (
          await this.rbac.canAccessTehsil(
            currentUser!,
            await this.rbac.submissionTehsil(s),
          )
        ) {
          filtered.push(s);
        }
      }
      submissions = filtered;
    } else if (this.rbac.userRoleCode(currentUser!) === SUPER_ADMIN) {
      const filtered = [];
      for (const s of submissions) {
        if (
          await this.rbac.canAccessTehsil(
            currentUser!,
            await this.rbac.submissionTehsil(s),
          )
        ) {
          filtered.push(s);
        }
      }
      submissions = filtered;
    }

    const result: Record<string, unknown>[] = [];
    for (const sub of submissions) {
      const operator = sub.operatorId
        ? await this.userRepo.findOne({ where: { id: sub.operatorId } })
        : null;
      const reviewer = sub.reviewedBy
        ? await this.userRepo.findOne({ where: { id: sub.reviewedBy } })
        : null;
      let systemInfo: Record<string, unknown> = {};

      const record = await this.waterDailyRepo.findOne({
        where: { id: sub.recordId },
      });
      if (record) {
        const system = await this.waterSystemRepo.findOne({
          where: { id: record.waterSystemId },
        });
        if (system) {
          systemInfo = {
            id: system.id,
            uid: system.uniqueIdentifier,
            village: system.village,
            tehsil: system.tehsil,
            year: record.logDate?.getFullYear() ?? null,
            month: record.logDate ? record.logDate.getMonth() + 1 : null,
            last_edited_at: record.updatedAt?.toISOString() ?? null,
            pump_start_time: record.pumpStartTime
              ? record.pumpStartTime.slice(0, 8)
              : null,
            pump_end_time: record.pumpEndTime
              ? record.pumpEndTime.slice(0, 8)
              : null,
            pump_operating_hours: record.pumpOperatingHours,
            total_water_pumped: record.totalWaterPumped,
            bulk_meter_image_url: record.bulkMeterImageUrl,
          };
        }
      }

      result.push({
        id: sub.id,
        submission_type: sub.submissionType,
        status: sub.status,
        operator_name: operator?.name ?? 'Unknown',
        operator_email: operator?.email ?? 'Unknown',
        submitted_at: sub.submittedAt?.toISOString() ?? null,
        reviewed_at: sub.reviewedAt?.toISOString() ?? null,
        remarks: sub.remarks,
        system_info: systemInfo,
        reviewed_by: sub.reviewedBy,
        reviewed_by_name: reviewer?.name ?? null,
        approved_by: sub.approvedBy,
      });
    }

    return { statusCode: 200, body: { submissions: result } };
  }

  async acceptSubmission(
    jwt: JwtContext,
    submissionId: string,
    data: Record<string, unknown>,
  ): Promise<ServiceResult> {
    const currentUser = await this.loadActor(jwt);
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
    });
    if (!submission) {
      return { statusCode: 404, body: { error: 'Submission not found' } };
    }
    if (!(await this.rbac.userCanVerifySubmission(currentUser!, submission))) {
      return {
        statusCode: 403,
        body: { error: 'Only tehsil managers can accept submissions' },
      };
    }
    if (submission.status !== SUBMISSION_STATUS_SUBMITTED) {
      return {
        statusCode: 400,
        body: {
          error: `Can only accept submissions in '${SUBMISSION_STATUS_SUBMITTED}' status`,
        },
      };
    }

    const remarks = (data?.remarks as string) || '';
    submission.status = SUBMISSION_STATUS_ACCEPTED;
    submission.reviewedAt = new Date();
    submission.reviewedBy = jwt.sub;
    submission.remarks = remarks;

    if (submission.submissionType === 'water_system') {
      const record = await this.waterDailyRepo.findOne({
        where: { id: submission.recordId },
      });
      if (record) record.status = SUBMISSION_STATUS_ACCEPTED;
      if (record) await this.waterDailyRepo.save(record);
    }

    await this.workflowService.logVerificationAction(
      submission.id,
      'accept',
      jwt.sub,
      this.rbac.userRoleCode(currentUser!),
      remarks || 'Submission accepted',
    );
    await this.workflowService.notifyOperator(
      submission.operatorId,
      'Submission accepted',
      `Your water submission was accepted by ${currentUser!.name}.`,
      submission.id,
    );
    await this.submissionRepo.save(submission);

    return {
      statusCode: 200,
      body: {
        message: 'Submission accepted',
        submission: {
          id: submission.id,
          status: submission.status,
          reviewed_at: submission.reviewedAt.toISOString(),
        },
      },
    };
  }

  async rejectSubmission(
    jwt: JwtContext,
    submissionId: string,
    data: Record<string, unknown>,
  ): Promise<ServiceResult> {
    const currentUser = await this.loadActor(jwt);
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
    });
    if (!submission) {
      return { statusCode: 404, body: { error: 'Submission not found' } };
    }
    if (!(await this.rbac.userCanVerifySubmission(currentUser!, submission))) {
      return {
        statusCode: 403,
        body: { error: 'Only tehsil managers can reject submissions' },
      };
    }
    if (submission.status !== SUBMISSION_STATUS_SUBMITTED) {
      return {
        statusCode: 400,
        body: {
          error: `Can only reject submissions in '${SUBMISSION_STATUS_SUBMITTED}' status`,
        },
      };
    }

    const remarks = (data?.remarks as string) || '';
    if (!remarks) {
      return {
        statusCode: 400,
        body: { error: 'Rejection reason is required' },
      };
    }

    submission.status = SUBMISSION_STATUS_REJECTED;
    submission.reviewedAt = new Date();
    submission.reviewedBy = jwt.sub;
    submission.remarks = remarks;

    if (submission.submissionType === 'water_system') {
      const record = await this.waterDailyRepo.findOne({
        where: { id: submission.recordId },
      });
      if (record) {
        record.status = SUBMISSION_STATUS_REJECTED;
        await this.waterDailyRepo.save(record);
      }
    }

    await this.workflowService.logVerificationAction(
      submission.id,
      'reject',
      jwt.sub,
      this.rbac.userRoleCode(currentUser!),
      remarks,
    );
    await this.workflowService.notifyOperator(
      submission.operatorId,
      'Submission rejected',
      `Your ${submission.submissionType} submission was rejected: ${remarks}`,
      submission.id,
    );
    await this.submissionRepo.save(submission);

    return {
      statusCode: 200,
      body: {
        message: 'Submission rejected',
        submission: {
          id: submission.id,
          status: submission.status,
          remarks: submission.remarks,
        },
      },
    };
  }

  async revertSubmission(
    jwt: JwtContext,
    submissionId: string,
    data: Record<string, unknown>,
  ): Promise<ServiceResult> {
    const currentUser = await this.loadActor(jwt);
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
    });
    if (!submission) {
      return { statusCode: 404, body: { error: 'Submission not found' } };
    }
    if (!(await this.rbac.userCanVerifySubmission(currentUser!, submission))) {
      return {
        statusCode: 403,
        body: { error: 'Only tehsil managers can revert submissions' },
      };
    }
    if (submission.status !== SUBMISSION_STATUS_SUBMITTED) {
      return {
        statusCode: 400,
        body: {
          error:
            'Can only revert submissions that are pending review (submitted)',
        },
      };
    }

    if (submission.submissionType === 'water_system') {
      const record = await this.waterDailyRepo.findOne({
        where: { id: submission.recordId },
      });
      if (!record || record.status !== SUBMISSION_STATUS_SUBMITTED) {
        return {
          statusCode: 400,
          body: { error: 'Water record is not in submitted state' },
        };
      }
    }

    const remarks = (data?.remarks as string) || '';
    submission.status = SUBMISSION_STATUS_REVERTED_BACK;
    submission.reviewedAt = new Date();
    submission.reviewedBy = jwt.sub;
    submission.remarks = remarks || null;

    if (submission.submissionType === 'water_system') {
      const record = await this.waterDailyRepo.findOne({
        where: { id: submission.recordId },
      });
      if (record) {
        record.status = SUBMISSION_STATUS_REVERTED_BACK;
        await this.waterDailyRepo.save(record);
      }
    }

    await this.workflowService.logVerificationAction(
      submission.id,
      'revert',
      jwt.sub,
      this.rbac.userRoleCode(currentUser!),
      remarks || 'Returned to operator for corrections',
    );
    await this.workflowService.notifyOperator(
      submission.operatorId,
      'Submission returned',
      `Your submission was returned by ${currentUser!.name} for corrections.` +
        (remarks ? ` Note: ${remarks}` : ''),
      submission.id,
    );
    await this.submissionRepo.save(submission);

    return {
      statusCode: 200,
      body: {
        message: 'Submission reverted to operator',
        submission: {
          id: submission.id,
          status: submission.status,
          remarks: submission.remarks,
        },
      },
    };
  }

  async getVerificationAuditLogs(
    jwt: JwtContext,
    query: {
      submission_id?: string;
      action_type?: string;
      user_id?: string;
    },
  ): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const currentUser = await this.loadActor(jwt);
    const qb = this.verificationLogRepo.createQueryBuilder('log');

    if (query.submission_id) {
      qb.andWhere('log.submission_id = :sid', { sid: query.submission_id });
    }
    if (query.action_type) {
      qb.andWhere('log.action_type = :at', { at: query.action_type });
    }
    if (query.user_id) {
      qb.andWhere('log.performed_by = :uid', { uid: query.user_id });
    }

    let logs = await qb.orderBy('log.created_at', 'DESC').limit(100).getMany();

    if (this.rbac.userRoleCode(currentUser!) === ADMIN) {
      const filtered: VerificationLog[] = [];
      for (const lg of logs) {
        const sub = await this.submissionRepo.findOne({
          where: { id: lg.submissionId },
        });
        if (
          sub &&
          (await this.rbac.canAccessTehsil(
            currentUser!,
            await this.rbac.submissionTehsil(sub),
          ))
        ) {
          filtered.push(lg);
        }
      }
      logs = filtered;
    }

    const result: Record<string, unknown>[] = [];
    for (const log of logs) {
      const u = await this.userRepo.findOne({ where: { id: log.performedBy } });
      result.push({
        id: log.id,
        submission_id: log.submissionId,
        action_type: log.actionType,
        performed_by_name: u?.name ?? 'Unknown',
        role: log.role,
        comment: log.comment,
        created_at: log.createdAt?.toISOString() ?? null,
      });
    }

    return { statusCode: 200, body: { audit_logs: result } };
  }

  async getVerificationStats(jwt: JwtContext): Promise<ServiceResult> {
    const denied = this.assertMinRole(jwt, ADMIN);
    if (denied) return denied;

    const currentUser = await this.loadActor(jwt);

    let total: number;
    let pending: number;
    let accepted: number;
    let rejected: number;
    let reverted: number;
    let acceptedSubs: Submission[];

    if (this.rbac.userRoleCode(currentUser!) === ADMIN) {
      const allSubs = await this.submissionRepo.find({
        where: { submissionType: 'water_system' },
      });
      const scoped: Submission[] = [];
      for (const s of allSubs) {
        if (
          await this.rbac.canAccessTehsil(
            currentUser!,
            await this.rbac.submissionTehsil(s),
          )
        ) {
          scoped.push(s);
        }
      }
      total = scoped.length;
      pending = scoped.filter(
        (s) => s.status === SUBMISSION_STATUS_SUBMITTED,
      ).length;
      accepted = scoped.filter(
        (s) => s.status === SUBMISSION_STATUS_ACCEPTED,
      ).length;
      rejected = scoped.filter(
        (s) => s.status === SUBMISSION_STATUS_REJECTED,
      ).length;
      reverted = scoped.filter(
        (s) => s.status === SUBMISSION_STATUS_REVERTED_BACK,
      ).length;
      acceptedSubs = scoped.filter(
        (s) =>
          s.status === SUBMISSION_STATUS_ACCEPTED &&
          s.submittedAt &&
          s.reviewedAt,
      );
    } else {
      const water = await this.submissionRepo.find({
        where: { submissionType: 'water_system' },
      });
      total = water.length;
      pending = water.filter(
        (s) => s.status === SUBMISSION_STATUS_SUBMITTED,
      ).length;
      accepted = water.filter(
        (s) => s.status === SUBMISSION_STATUS_ACCEPTED,
      ).length;
      rejected = water.filter(
        (s) => s.status === SUBMISSION_STATUS_REJECTED,
      ).length;
      reverted = water.filter(
        (s) => s.status === SUBMISSION_STATUS_REVERTED_BACK,
      ).length;
      acceptedSubs = water.filter(
        (s) =>
          s.status === SUBMISSION_STATUS_ACCEPTED &&
          s.submittedAt &&
          s.reviewedAt,
      );
    }

    let avgReviewTimeHours = 0;
    if (acceptedSubs.length) {
      const totalHours = acceptedSubs.reduce((sum, sub) => {
        if (sub.reviewedAt && sub.submittedAt) {
          return (
            sum +
            (sub.reviewedAt.getTime() - sub.submittedAt.getTime()) / 3600000
          );
        }
        return sum;
      }, 0);
      avgReviewTimeHours =
        Math.round((totalHours / acceptedSubs.length) * 100) / 100;
    }

    return {
      statusCode: 200,
      body: {
        total_submissions: total,
        pending_review: pending,
        accepted,
        rejected,
        reverted_back: reverted,
        avg_review_time_hours: avgReviewTimeHours,
      },
    };
  }

  async getNotifications(jwt: JwtContext): Promise<ServiceResult> {
    const result = await this.notificationsService.getNotificationsResponse(
      jwt.sub,
    );
    return { statusCode: 200, body: result };
  }

  async markNotificationRead(
    jwt: JwtContext,
    notificationId: string,
  ): Promise<ServiceResult> {
    const result = await this.notificationsService.markNotificationReadResponse(
      jwt.sub,
      notificationId,
    );
    return { statusCode: 200, body: result };
  }

  async markAllNotificationsRead(jwt: JwtContext): Promise<ServiceResult> {
    const result =
      await this.notificationsService.markAllNotificationsReadResponse(jwt.sub);
    return { statusCode: 200, body: result };
  }
}
