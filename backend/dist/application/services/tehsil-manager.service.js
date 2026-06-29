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
exports.TehsilManagerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const uuid_1 = require("uuid");
const tehsils_1 = require("../../domain/constants/tehsils");
const roles_1 = require("../../domain/constants/roles");
const submission_constants_1 = require("../../domain/constants/submission.constants");
const water_system_entity_1 = require("../../infrastructure/database/entities/water-system.entity");
const water_system_calibration_certificate_entity_1 = require("../../infrastructure/database/entities/water-system-calibration-certificate.entity");
const water_energy_logging_daily_entity_1 = require("../../infrastructure/database/entities/water-energy-logging-daily.entity");
const solar_system_entity_1 = require("../../infrastructure/database/entities/solar-system.entity");
const system_meter_entity_1 = require("../../infrastructure/database/entities/system-meter.entity");
const solar_energy_logging_monthly_entity_1 = require("../../infrastructure/database/entities/solar-energy-logging-monthly.entity");
const notification_entity_1 = require("../../infrastructure/database/entities/notification.entity");
const user_entity_1 = require("../../infrastructure/database/entities/user.entity");
const user_water_system_entity_1 = require("../../infrastructure/database/entities/user-water-system.entity");
const submission_entity_1 = require("../../infrastructure/database/entities/submission.entity");
const verification_log_entity_1 = require("../../infrastructure/database/entities/verification-log.entity");
const user_service_1 = require("./user.service");
const storage_service_1 = require("./storage.service");
const workflow_service_1 = require("./workflow.service");
const notifications_service_1 = require("./notifications.service");
const water_submission_detail_service_1 = require("./water-submission-detail.service");
const operator_helpers_service_1 = require("./operator-helpers.service");
const tehsil_access_service_1 = require("./tehsil-access.service");
const rbac_service_1 = require("./rbac.service");
let TehsilManagerService = class TehsilManagerService {
    waterSystemRepo;
    calibrationCertRepo;
    waterDailyRepo;
    solarSystemRepo;
    systemMeterRepo;
    solarMonthlyRepo;
    notificationRepo;
    userRepo;
    userWaterSystemRepo;
    submissionRepo;
    verificationLogRepo;
    userService;
    storageService;
    workflowService;
    notificationsService;
    waterSubmissionDetailService;
    operatorHelpers;
    tehsilAccess;
    rbac;
    constructor(waterSystemRepo, calibrationCertRepo, waterDailyRepo, solarSystemRepo, systemMeterRepo, solarMonthlyRepo, notificationRepo, userRepo, userWaterSystemRepo, submissionRepo, verificationLogRepo, userService, storageService, workflowService, notificationsService, waterSubmissionDetailService, operatorHelpers, tehsilAccess, rbac) {
        this.waterSystemRepo = waterSystemRepo;
        this.calibrationCertRepo = calibrationCertRepo;
        this.waterDailyRepo = waterDailyRepo;
        this.solarSystemRepo = solarSystemRepo;
        this.systemMeterRepo = systemMeterRepo;
        this.solarMonthlyRepo = solarMonthlyRepo;
        this.notificationRepo = notificationRepo;
        this.userRepo = userRepo;
        this.userWaterSystemRepo = userWaterSystemRepo;
        this.submissionRepo = submissionRepo;
        this.verificationLogRepo = verificationLogRepo;
        this.userService = userService;
        this.storageService = storageService;
        this.workflowService = workflowService;
        this.notificationsService = notificationsService;
        this.waterSubmissionDetailService = waterSubmissionDetailService;
        this.operatorHelpers = operatorHelpers;
        this.tehsilAccess = tehsilAccess;
        this.rbac = rbac;
    }
    assertMinRole(jwt, minRole) {
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
    async assertTehsilManagerRequired(jwt) {
        if (this.rbac.normalizeRoleCode(jwt.role) !== roles_1.ADMIN) {
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
    tehsilDenied(exc) {
        if (exc instanceof tehsil_access_service_1.TehsilAccessDenied) {
            return { statusCode: 403, body: { message: String(exc) } };
        }
        return null;
    }
    async loadActor(jwt) {
        return this.userService.getUserById(jwt.sub);
    }
    scopeTehsilsFromJwt(jwt) {
        const raw = jwt.tehsils;
        if (!Array.isArray(raw))
            return [];
        return raw.map((t) => String(t).trim()).filter(Boolean);
    }
    dateSeries(endDay, days) {
        const out = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(endDay);
            d.setDate(d.getDate() - i);
            out.push(d);
        }
        return out;
    }
    isoDate(d) {
        if (!d)
            return null;
        return d.toISOString().slice(0, 10);
    }
    parseIsoDate(s) {
        return this.operatorHelpers.parseDate(s);
    }
    todayDate() {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    pctChange(a, b) {
        if (a === null || b === null)
            return null;
        if (Math.abs(b) < 1e-9)
            return null;
        return (a - b) / b;
    }
    coerceOptionalBool(value) {
        if (value === null || value === undefined)
            return null;
        if (typeof value === 'boolean')
            return value;
        const s = String(value).trim().toLowerCase();
        if (['1', 'true', 'yes', 'y', 'on'].includes(s))
            return true;
        if (['0', 'false', 'no', 'n', 'off'].includes(s))
            return false;
        return null;
    }
    coerceOptionalDate(value) {
        if (value === null || value === '')
            return null;
        if (value instanceof Date)
            return value;
        return this.operatorHelpers.parseDate(String(value));
    }
    requireFields(data, keys) {
        const missing = [];
        for (const k of keys) {
            const v = data[k];
            if (v === null || v === undefined) {
                missing.push(k);
                continue;
            }
            if (typeof v === 'string' && !v.trim())
                missing.push(k);
        }
        return missing;
    }
    solarMonthlyTouRequired(payload) {
        const explicit = this.coerceOptionalBool(payload.tou_required);
        if (explicit !== null)
            return explicit;
        return ['export_peak', 'import_peak', 'net_peak'].some((k) => payload[k] !== null && payload[k] !== undefined && payload[k] !== '');
    }
    normalizeSolarMonthlyFields(payload) {
        const touRequired = this.solarMonthlyTouRequired(payload);
        try {
            if (touRequired) {
                return {
                    normalized: {
                        tou_required: true,
                        export_off_peak: this.operatorHelpers.coerceOptionalFloat(payload.export_off_peak),
                        export_peak: this.operatorHelpers.coerceOptionalFloat(payload.export_peak),
                        import_off_peak: this.operatorHelpers.coerceOptionalFloat(payload.import_off_peak),
                        import_peak: this.operatorHelpers.coerceOptionalFloat(payload.import_peak),
                        net_off_peak: this.operatorHelpers.coerceOptionalFloat(payload.net_off_peak),
                        net_peak: this.operatorHelpers.coerceOptionalFloat(payload.net_peak),
                    },
                    error: null,
                };
            }
            return {
                normalized: {
                    tou_required: false,
                    export_off_peak: this.operatorHelpers.coerceOptionalFloat(payload.export_total),
                    export_peak: null,
                    import_off_peak: this.operatorHelpers.coerceOptionalFloat(payload.import_total),
                    import_peak: null,
                    net_off_peak: this.operatorHelpers.coerceOptionalFloat(payload.net_total),
                    net_peak: null,
                },
                error: null,
            };
        }
        catch (exc) {
            return { normalized: {}, error: String(exc) };
        }
    }
    solarMonthlyResponseFields(record) {
        const touRequired = ['export_peak', 'import_peak', 'net_peak'].some((k) => record[k] !== null &&
            record[k] !== undefined);
        let exportTotal;
        let importTotal;
        let netTotal;
        if (touRequired) {
            exportTotal = (record.exportOffPeak ?? 0) + (record.exportPeak ?? 0);
            importTotal = (record.importOffPeak ?? 0) + (record.importPeak ?? 0);
            netTotal = (record.netOffPeak ?? 0) + (record.netPeak ?? 0);
        }
        else {
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
    currentMeterPayload(data, meterType, fallback = {}) {
        const raw = data.current_meter;
        const pick = (fieldKey, legacyKey) => {
            if (raw && typeof raw === 'object' && fieldKey in raw) {
                return raw[fieldKey];
            }
            if (legacyKey in data)
                return data[legacyKey];
            return fallback[fieldKey];
        };
        return {
            meter_type: meterType,
            meter_model: this.operatorHelpers.coerceOptionalStr(pick('meter_model', 'meter_model')),
            meter_serial_number: this.operatorHelpers.coerceOptionalStr(pick('meter_serial_number', 'meter_serial_number')),
            meter_accuracy_class: this.operatorHelpers.coerceOptionalStr(pick('meter_accuracy_class', 'meter_accuracy_class')),
            installation_date: this.coerceOptionalDate(pick('installation_date', 'installation_date')),
        };
    }
    async meterHistoryPayload(system, meterType) {
        const meters = await this.operatorHelpers.getSystemMeters(system, this.systemMeterRepo);
        const rows = meters.filter((m) => m.meterType === meterType);
        rows.sort((a, b) => {
            const ta = a.createdAt?.getTime() ?? 0;
            const tb = b.createdAt?.getTime() ?? 0;
            if (tb !== ta)
                return tb - ta;
            return String(b.id).localeCompare(String(a.id));
        });
        return rows
            .map((m) => this.operatorHelpers.meterToDict(m))
            .filter((d) => d !== null);
    }
    meterUpdateMode(data) {
        let raw = data.meter_update_mode;
        const currentMeter = data.current_meter;
        if (currentMeter &&
            typeof currentMeter === 'object' &&
            currentMeter.update_mode !== undefined) {
            raw = currentMeter.update_mode;
        }
        let mode = raw !== null && raw !== undefined
            ? String(raw).trim().toLowerCase()
            : 'auto';
        if (!['auto', 'update_current', 'switch_new'].includes(mode))
            mode = 'auto';
        return mode;
    }
    validateWaterSystemMeterLogic(payload) {
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
    waterDailyStatusBucket(rec) {
        if (!rec)
            return ['missing', null];
        let st;
        if (rec.status === submission_constants_1.SubmissionStatus.DRAFTED)
            st = 'draft';
        else if (rec.status === submission_constants_1.SubmissionStatus.SUBMITTED)
            st = 'submitted';
        else if (rec.status === submission_constants_1.SubmissionStatus.ACCEPTED)
            st = 'accepted';
        else if (rec.status === submission_constants_1.SubmissionStatus.REJECTED)
            st = 'rejected';
        else if (rec.status === submission_constants_1.SubmissionStatus.REVERTED_BACK)
            st = 'reverted_back';
        else
            st = rec.status || 'unknown';
        return [st, { record_id: String(rec.id), status: rec.status }];
    }
    toFloatOrNone(value) {
        if (value === null || value === '')
            return null;
        try {
            return Number(value);
        }
        catch {
            return null;
        }
    }
    operatorPayload(op) {
        return {
            id: String(op.id),
            name: op.name,
            email: op.email,
            phone: op.phone || null,
        };
    }
    async getActiveMeter(system) {
        return this.operatorHelpers.getActiveMeter(system, this.systemMeterRepo);
    }
    applySolarNormalized(record, normalized) {
        record.exportOffPeak = normalized.export_off_peak;
        record.exportPeak = normalized.export_peak;
        record.importOffPeak = normalized.import_off_peak;
        record.importPeak = normalized.import_peak;
        record.netOffPeak = normalized.net_off_peak;
        record.netPeak = normalized.net_peak;
    }
    async upsertMeter(params) {
        return this.operatorHelpers.upsertActiveSystemMeter(params, this.systemMeterRepo);
    }
    async getWaterAnomalies(jwt, query) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        if (!user)
            return { statusCode: 404, body: { message: 'User not found' } };
        let days;
        try {
            days = parseInt(query.days || '4', 10);
            if (Number.isNaN(days))
                throw new Error('invalid');
        }
        catch {
            return { statusCode: 400, body: { message: 'days must be an integer' } };
        }
        days = Math.max(4, Math.min(days, 14));
        let endDay;
        const endDateS = (query.end_date || '').trim();
        if (endDateS) {
            endDay = this.parseIsoDate(endDateS);
            if (!endDay) {
                return {
                    statusCode: 400,
                    body: { message: 'Invalid end_date; use YYYY-MM-DD' },
                };
            }
        }
        else {
            endDay = this.todayDate();
        }
        const tehsilFilter = (query.tehsil || '').trim();
        const villageFilter = (query.village || '').trim();
        const jwtScopeTehsils = this.scopeTehsilsFromJwt(jwt);
        const where = {};
        if (jwtScopeTehsils.length)
            where.tehsil = (0, typeorm_2.In)(jwtScopeTehsils);
        if (tehsilFilter && tehsilFilter !== 'All Tehsils')
            where.tehsil = tehsilFilter;
        if (villageFilter && villageFilter !== 'All Villages')
            where.village = villageFilter;
        const systems = await this.waterSystemRepo.find({
            where: where,
            order: { tehsil: 'ASC', village: 'ASC', uniqueIdentifier: 'ASC' },
        });
        const daysList = this.dateSeries(endDay, days);
        const wsIds = systems.map((s) => s.id);
        let records = [];
        let subs = [];
        if (wsIds.length) {
            records = await this.waterDailyRepo.find({
                where: {
                    waterSystemId: (0, typeorm_2.In)(wsIds),
                    logDate: (0, typeorm_2.In)(daysList),
                },
            });
            const recIds = records.map((r) => r.id);
            if (recIds.length) {
                subs = await this.submissionRepo.find({
                    where: {
                        submissionType: 'water_system',
                        recordId: (0, typeorm_2.In)(recIds),
                    },
                });
            }
        }
        const recByWsDay = new Map();
        for (const r of records) {
            recByWsDay.set(`${r.waterSystemId}|${this.isoDate(r.logDate)}`, r);
        }
        const subByRec = new Map();
        for (const s of subs)
            subByRec.set(String(s.recordId), s);
        const items = [];
        for (const ws of systems) {
            try {
                this.tehsilAccess.assertUserMayAccessTehsil(user, ws.tehsil);
            }
            catch (exc) {
                if (this.tehsilDenied(exc))
                    continue;
                throw exc;
            }
            const series = [];
            const anomalies = [];
            for (const d of daysList) {
                const r = recByWsDay.get(`${ws.id}|${this.isoDate(d)}`);
                const sub = r ? subByRec.get(String(r.id)) : undefined;
                let opUser = null;
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
                if (r.status === submission_constants_1.SubmissionStatus.DRAFTED) {
                    anomalies.push({
                        date: this.isoDate(d),
                        code: 'draft_not_submitted',
                        severity: 'medium',
                        message: 'Log exists but is still a draft.',
                    });
                }
                if (ws.bulkMeterInstalled) {
                    const twp = r.totalWaterPumped;
                    if (twp === null ||
                        twp === undefined ||
                        (typeof twp === 'number' && twp <= 0)) {
                        anomalies.push({
                            date: this.isoDate(d),
                            code: 'water_volume_missing_or_zero',
                            severity: 'high',
                            message: 'Bulk meter system but total water pumped is missing or zero.',
                        });
                    }
                }
            }
            if (daysList.length >= 4 && ws.bulkMeterInstalled) {
                for (let idx = 3; idx < daysList.length; idx++) {
                    const d = daysList[idx];
                    const cur = recByWsDay.get(`${ws.id}|${this.isoDate(d)}`);
                    if (!cur ||
                        cur.totalWaterPumped === null ||
                        cur.totalWaterPumped === undefined)
                        continue;
                    const prevVals = [];
                    for (let j = idx - 3; j < idx; j++) {
                        const rprev = recByWsDay.get(`${ws.id}|${this.isoDate(daysList[j])}`);
                        if (rprev?.totalWaterPumped !== null &&
                            rprev?.totalWaterPumped !== undefined) {
                            prevVals.push(Number(rprev.totalWaterPumped));
                        }
                    }
                    if (prevVals.length < 3)
                        continue;
                    const avg3 = prevVals.reduce((a, b) => a + b, 0) / 3.0;
                    if (avg3 <= 0)
                        continue;
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
                    }
                    else if (curv < avg3 * 0.5) {
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
    async getLoggingCompliance(jwt, query) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        if (!user)
            return { statusCode: 404, body: { message: 'User not found' } };
        const rk = this.rbac.userRank(user);
        const ts = [...(await this.rbac.userAssignedTehsils(user))];
        let waterDay;
        try {
            if (query.water_date) {
                waterDay = this.parseIsoDate(query.water_date);
                if (!waterDay)
                    throw new Error('invalid');
            }
            else {
                waterDay = this.todayDate();
            }
        }
        catch {
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
        if (Number.isNaN(solarYear))
            solarYear = this.todayDate().getFullYear();
        if (Number.isNaN(solarMonth))
            solarMonth = this.todayDate().getMonth() + 1;
        if (solarMonth < 1 || solarMonth > 12) {
            return { statusCode: 400, body: { message: 'solar_month must be 1–12' } };
        }
        let waterSystems;
        let solarSystems;
        if (rk >= roles_1.ROLE_RANK[roles_1.SUPER_ADMIN]) {
            waterSystems = await this.waterSystemRepo.find({
                order: { tehsil: 'ASC', village: 'ASC', uniqueIdentifier: 'ASC' },
            });
            solarSystems = await this.solarSystemRepo.find({
                order: { tehsil: 'ASC', village: 'ASC', uniqueIdentifier: 'ASC' },
            });
        }
        else if (ts.length) {
            waterSystems = await this.waterSystemRepo.find({
                where: { tehsil: (0, typeorm_2.In)(ts) },
                order: { tehsil: 'ASC', village: 'ASC', uniqueIdentifier: 'ASC' },
            });
            solarSystems = await this.solarSystemRepo.find({
                where: { tehsil: (0, typeorm_2.In)(ts) },
                order: { tehsil: 'ASC', village: 'ASC', uniqueIdentifier: 'ASC' },
            });
        }
        else {
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
        const operatorsByWaterId = {};
        for (const wid of wsIds)
            operatorsByWaterId[String(wid)] = [];
        if (wsIds.length) {
            const opRows = await this.userWaterSystemRepo
                .createQueryBuilder('uws')
                .innerJoinAndSelect('uws.user', 'user')
                .where('uws.water_system_id IN (:...ids)', { ids: wsIds })
                .orderBy('user.name', 'ASC')
                .getMany();
            for (const row of opRows) {
                const wid = String(row.waterSystemId);
                if (!operatorsByWaterId[wid])
                    operatorsByWaterId[wid] = [];
                if (row.user)
                    operatorsByWaterId[wid].push(this.operatorPayload(row.user));
            }
        }
        const outWater = [];
        for (const ws of waterSystems) {
            const rec = await this.waterDailyRepo.findOne({
                where: { waterSystemId: ws.id, logDate: waterDay },
            });
            let bucket;
            if (!rec)
                bucket = 'missing';
            else if (rec.status === submission_constants_1.SubmissionStatus.DRAFTED)
                bucket = 'draft';
            else if (rec.status === submission_constants_1.SubmissionStatus.SUBMITTED)
                bucket = 'submitted';
            else if (rec.status === submission_constants_1.SubmissionStatus.ACCEPTED)
                bucket = 'accepted';
            else if (rec.status === submission_constants_1.SubmissionStatus.REJECTED)
                bucket = 'rejected';
            else if (rec.status === submission_constants_1.SubmissionStatus.REVERTED_BACK)
                bucket = 'reverted_back';
            else
                bucket = rec.status || 'unknown';
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
        const outSolar = [];
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
    async getWaterDailyLoggingRange(jwt, query) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        if (!user)
            return { statusCode: 404, body: { message: 'User not found' } };
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
        const span = Math.floor((d1.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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
            this.tehsilAccess.assertUserMayAccessWaterSystem(user, ws);
        }
        catch (exc) {
            const d = this.tehsilDenied(exc);
            if (d)
                return d;
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
        const daysOut = [];
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
    async getSolarMonthlyYearRange(jwt, query) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        if (!user)
            return { statusCode: 404, body: { message: 'User not found' } };
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
            this.tehsilAccess.assertUserMayAccessSolarSystem(user, ss);
        }
        catch (exc) {
            const d = this.tehsilDenied(exc);
            if (d)
                return d;
            throw exc;
        }
        const monthsOut = [];
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
    async listWaterOperatorAssignments(jwt) {
        const denied = await this.assertTehsilManagerRequired(jwt);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        if (!user)
            return { statusCode: 404, body: { message: 'User not found' } };
        const data = await this.userService.listTubewellOperatorAssignments(user);
        return { statusCode: 200, body: data };
    }
    async replaceWaterOperatorAssignments(jwt, operatorId, body) {
        const denied = await this.assertTehsilManagerRequired(jwt);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        if (!user)
            return { statusCode: 404, body: { message: 'User not found' } };
        const payload = body ?? {};
        const ids = payload.water_system_ids;
        if (ids !== undefined && ids !== null && !Array.isArray(ids)) {
            return {
                statusCode: 400,
                body: { message: 'water_system_ids must be an array' },
            };
        }
        try {
            const updated = await this.userService.replaceTubewellOperatorWaterAssignments(user, operatorId, Array.isArray(ids) ? ids : []);
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
        }
        catch (exc) {
            const d = this.tehsilDenied(exc);
            if (d)
                return d;
            if (exc instanceof Error) {
                return { statusCode: 400, body: { message: exc.message } };
            }
            throw exc;
        }
    }
    async getTehsilManagerWaterSubmissionDetail(jwt, submissionId) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const currentUser = await this.userRepo.findOne({ where: { id: jwt.sub } });
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
        if (!this.rbac.userCanViewSubmissionDetail(currentUser, submission, jwt.sub)) {
            return { statusCode: 403, body: { error: 'Access denied' } };
        }
        const detail = await this.waterSubmissionDetailService.buildWaterSubmissionDetailResponse(submission);
        return { statusCode: 200, body: detail };
    }
    async addWaterSystem(jwt, data) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        if (!user)
            return { statusCode: 404, body: { message: 'User not found' } };
        const ct = (0, tehsils_1.canonicalTehsil)(data.tehsil);
        if (!ct) {
            return {
                statusCode: 400,
                body: { message: 'Invalid or unknown tehsil' },
            };
        }
        try {
            this.tehsilAccess.assertUserMayAccessTehsil(user, ct, { forWrite: true });
        }
        catch {
            return {
                statusCode: 403,
                body: { message: 'You cannot manage water systems in this tehsil' },
            };
        }
        const village = data.village;
        const settlement = data.settlement || '';
        const findWhere = { tehsil: ct, village };
        if (settlement)
            findWhere.settlement = settlement;
        const existingSystem = await this.waterSystemRepo.findOne({
            where: findWhere,
        });
        if (existingSystem) {
            try {
                this.tehsilAccess.assertUserMayAccessTehsil(user, existingSystem.tehsil, { forWrite: true });
            }
            catch {
                return {
                    statusCode: 403,
                    body: { message: 'You cannot manage water systems in this tehsil' },
                };
            }
            existingSystem.pumpModel = this.operatorHelpers.coerceOptionalStr(data.pump_model);
            existingSystem.pumpSerialNumber = this.operatorHelpers.coerceOptionalStr(data.pump_serial_number);
            existingSystem.startOfOperation = this.operatorHelpers.parseDate(String(data.start_of_operation || ''));
            try {
                if ('latitude' in data) {
                    existingSystem.latitude = this.operatorHelpers.coerceOptionalFloat(data.latitude);
                }
                if ('longitude' in data) {
                    existingSystem.longitude = this.operatorHelpers.coerceOptionalFloat(data.longitude);
                }
                existingSystem.depthOfWaterIntake =
                    this.operatorHelpers.coerceOptionalFloat(data.depth_of_water_intake);
                existingSystem.heightToOhr = this.operatorHelpers.coerceOptionalFloat(data.height_to_ohr);
                existingSystem.pumpFlowRate = this.operatorHelpers.coerceOptionalFloat(data.pump_flow_rate);
            }
            catch (exc) {
                return { statusCode: 400, body: { message: String(exc) } };
            }
            const bmi = this.coerceOptionalBool(data.bulk_meter_installed);
            if (bmi !== null)
                existingSystem.bulkMeterInstalled = bmi;
            try {
                if ('ohr_tank_capacity' in data) {
                    existingSystem.ohrTankCapacity =
                        this.operatorHelpers.coerceOptionalFloat(data.ohr_tank_capacity);
                }
                if ('ohr_fill_required' in data) {
                    existingSystem.ohrFillRequired =
                        this.operatorHelpers.coerceOptionalFloat(data.ohr_fill_required);
                }
                if ('pump_capacity' in data) {
                    existingSystem.pumpCapacity =
                        this.operatorHelpers.coerceOptionalFloat(data.pump_capacity);
                }
                if ('pump_head' in data) {
                    existingSystem.pumpHead = this.operatorHelpers.coerceOptionalFloat(data.pump_head);
                }
                if ('pump_horse_power' in data) {
                    existingSystem.pumpHorsePower =
                        this.operatorHelpers.coerceOptionalFloat(data.pump_horse_power);
                }
                if ('time_to_fill' in data) {
                    existingSystem.timeToFill = this.operatorHelpers.coerceOptionalFloat(data.time_to_fill);
                }
            }
            catch (exc) {
                return { statusCode: 400, body: { message: String(exc) } };
            }
            const activeMeter = await this.getActiveMeter(existingSystem);
            const meterPayload = this.currentMeterPayload(data, submission_constants_1.MeterType.TUBEWELL, {
                meter_model: activeMeter?.meterModel,
                meter_serial_number: activeMeter?.meterSerialNumber,
                meter_accuracy_class: activeMeter?.meterAccuracyClass,
                installation_date: activeMeter?.installationDate,
            });
            const validation = this.validateWaterSystemMeterLogic({
                ...data,
                bulk_meter_installed: existingSystem.bulkMeterInstalled,
                meter_model: meterPayload.meter_model,
                meter_serial_number: meterPayload.meter_serial_number,
                meter_accuracy_class: meterPayload.meter_accuracy_class,
                installation_date: meterPayload.installation_date
                    ? this.isoDate(meterPayload.installation_date)
                    : null,
                ohr_tank_capacity: existingSystem.ohrTankCapacity,
                ohr_fill_required: existingSystem.ohrFillRequired,
                pump_capacity: existingSystem.pumpCapacity,
                pump_head: existingSystem.pumpHead,
                pump_horse_power: existingSystem.pumpHorsePower,
                time_to_fill: existingSystem.timeToFill,
            });
            if (!validation.ok) {
                return { statusCode: 400, body: { message: validation.err } };
            }
            const meterRow = await this.upsertMeter({
                meterType: submission_constants_1.MeterType.TUBEWELL,
                waterSystemId: String(existingSystem.id),
                meterModel: existingSystem.bulkMeterInstalled
                    ? meterPayload.meter_model
                    : null,
                meterSerialNumber: existingSystem.bulkMeterInstalled
                    ? meterPayload.meter_serial_number
                    : null,
                meterAccuracyClass: existingSystem.bulkMeterInstalled
                    ? meterPayload.meter_accuracy_class
                    : null,
                installationDate: existingSystem.bulkMeterInstalled
                    ? meterPayload.installation_date
                    : null,
                updateMode: this.meterUpdateMode(data),
            });
            if (meterRow)
                await this.systemMeterRepo.save(meterRow);
            try {
                await this.waterSystemRepo.save(existingSystem);
                return {
                    statusCode: 200,
                    body: {
                        message: 'Water system updated successfully',
                        id: String(existingSystem.id),
                    },
                };
            }
            catch (e) {
                return {
                    statusCode: 500,
                    body: { message: 'Error updating system', error: String(e) },
                };
            }
        }
        let uniqueId = data.unique_identifier;
        if (!uniqueId) {
            uniqueId = `WS-${ct.slice(0, 3).toUpperCase()}-${String(village).slice(0, 3).toUpperCase()}-${settlement ? settlement.slice(0, 3).toUpperCase() : 'XXX'}-${(0, uuid_1.v4)().slice(0, 8)}`;
        }
        const newSystem = this.waterSystemRepo.create({
            tehsil: ct,
            village,
            settlement,
            uniqueIdentifier: uniqueId,
            latitude: this.toFloatOrNone(data.latitude),
            longitude: this.toFloatOrNone(data.longitude),
            pumpModel: this.operatorHelpers.coerceOptionalStr(data.pump_model),
            pumpSerialNumber: this.operatorHelpers.coerceOptionalStr(data.pump_serial_number),
            startOfOperation: this.operatorHelpers.parseDate(String(data.start_of_operation || '')),
            depthOfWaterIntake: this.toFloatOrNone(data.depth_of_water_intake),
            heightToOhr: this.toFloatOrNone(data.height_to_ohr),
            pumpFlowRate: this.toFloatOrNone(data.pump_flow_rate),
            bulkMeterInstalled: this.coerceOptionalBool(data.bulk_meter_installed) === true,
            ohrTankCapacity: this.toFloatOrNone(data.ohr_tank_capacity),
            ohrFillRequired: this.toFloatOrNone(data.ohr_fill_required),
            pumpCapacity: this.toFloatOrNone(data.pump_capacity),
            pumpHead: this.toFloatOrNone(data.pump_head),
            pumpHorsePower: this.toFloatOrNone(data.pump_horse_power),
            timeToFill: this.toFloatOrNone(data.time_to_fill),
            createdBy: jwt.sub,
        });
        const meterPayload = this.currentMeterPayload(data, submission_constants_1.MeterType.TUBEWELL);
        const validation = this.validateWaterSystemMeterLogic({
            ...data,
            meter_model: meterPayload.meter_model,
            meter_serial_number: meterPayload.meter_serial_number,
            meter_accuracy_class: meterPayload.meter_accuracy_class,
            installation_date: meterPayload.installation_date
                ? this.isoDate(meterPayload.installation_date)
                : null,
        });
        if (!validation.ok) {
            return { statusCode: 400, body: { message: validation.err } };
        }
        await this.waterSystemRepo.save(newSystem);
        const meterRow = await this.upsertMeter({
            meterType: submission_constants_1.MeterType.TUBEWELL,
            waterSystemId: String(newSystem.id),
            meterModel: newSystem.bulkMeterInstalled
                ? meterPayload.meter_model
                : null,
            meterSerialNumber: newSystem.bulkMeterInstalled
                ? meterPayload.meter_serial_number
                : null,
            meterAccuracyClass: newSystem.bulkMeterInstalled
                ? meterPayload.meter_accuracy_class
                : null,
            installationDate: newSystem.bulkMeterInstalled
                ? meterPayload.installation_date
                : null,
            updateMode: this.meterUpdateMode(data),
        });
        if (meterRow)
            await this.systemMeterRepo.save(meterRow);
        return {
            statusCode: 201,
            body: {
                message: 'Water system added successfully',
                id: String(newSystem.id),
            },
        };
    }
    async addSolarSystem(jwt, data) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        if (!user)
            return { statusCode: 404, body: { message: 'User not found' } };
        const ct = (0, tehsils_1.canonicalTehsil)(data.tehsil);
        if (!ct) {
            return {
                statusCode: 400,
                body: { message: 'Invalid or unknown tehsil' },
            };
        }
        try {
            this.tehsilAccess.assertUserMayAccessTehsil(user, ct, { forWrite: true });
        }
        catch {
            return {
                statusCode: 403,
                body: { message: 'You cannot manage solar systems in this tehsil' },
            };
        }
        const village = data.village;
        if (!village) {
            return { statusCode: 400, body: { message: 'village is required' } };
        }
        const billReferenceNumber = this.operatorHelpers.coerceOptionalStr(data.bill_reference_number);
        if (!billReferenceNumber) {
            return {
                statusCode: 400,
                body: { message: 'bill_reference_number is required' },
            };
        }
        const settlementRaw = String(data.settlement || '').trim();
        const settlementDb = settlementRaw || null;
        const existingSystem = await this.operatorHelpers.findSolarSystemByLocation(ct, village, settlementRaw, this.solarSystemRepo);
        const solarConnectionDate = this.operatorHelpers.parseDate(String(data.solar_connection_date || data.installation_date || ''));
        const electricityConnectionDate = this.operatorHelpers.parseDate(String(data.electricity_connection_date || ''));
        const greenConnectionDate = this.operatorHelpers.parseDate(String(data.green_connection_date || data.green_meter_connection_date || ''));
        if (existingSystem) {
            try {
                this.tehsilAccess.assertUserMayAccessTehsil(user, existingSystem.tehsil, { forWrite: true });
            }
            catch {
                return {
                    statusCode: 403,
                    body: { message: 'You cannot manage solar systems in this tehsil' },
                };
            }
            existingSystem.installationLocation =
                this.operatorHelpers.coerceOptionalStr(data.installation_location);
            existingSystem.discoInfo = this.operatorHelpers.coerceOptionalStr(data.disco_info);
            existingSystem.billReferenceNumber = billReferenceNumber;
            try {
                if ('latitude' in data) {
                    existingSystem.latitude = this.operatorHelpers.coerceOptionalFloat(data.latitude);
                }
                if ('longitude' in data) {
                    existingSystem.longitude = this.operatorHelpers.coerceOptionalFloat(data.longitude);
                }
                existingSystem.solarPanelCapacity =
                    this.operatorHelpers.coerceOptionalFloat(data.solar_panel_capacity);
                existingSystem.inverterCapacity =
                    this.operatorHelpers.coerceOptionalFloat(data.inverter_capacity);
            }
            catch (exc) {
                return { statusCode: 400, body: { message: String(exc) } };
            }
            existingSystem.inverterSerialNumber =
                this.operatorHelpers.coerceOptionalStr(data.inverter_serial_number);
            existingSystem.solarConnectionDate = solarConnectionDate;
            existingSystem.electricityConnectionDate = electricityConnectionDate;
            existingSystem.greenConnectionDate = greenConnectionDate;
            existingSystem.installationDate = solarConnectionDate;
            existingSystem.greenMeterConnectionDate = greenConnectionDate;
            existingSystem.remarks = this.operatorHelpers.coerceOptionalStr(data.remarks);
            const activeMeter = await this.getActiveMeter(existingSystem);
            const meterPayload = this.currentMeterPayload(data, submission_constants_1.MeterType.SOLAR, {
                meter_model: activeMeter?.meterModel,
                meter_serial_number: activeMeter?.meterSerialNumber,
                installation_date: activeMeter?.installationDate ?? greenConnectionDate,
            });
            const meterRow = await this.upsertMeter({
                meterType: submission_constants_1.MeterType.SOLAR,
                solarSystemId: String(existingSystem.id),
                meterModel: meterPayload.meter_model,
                meterSerialNumber: meterPayload.meter_serial_number,
                installationDate: meterPayload.installation_date ??
                    greenConnectionDate,
                updateMode: this.meterUpdateMode(data),
            });
            if (meterRow)
                await this.systemMeterRepo.save(meterRow);
            try {
                await this.solarSystemRepo.save(existingSystem);
                return {
                    statusCode: 200,
                    body: {
                        message: 'Solar system updated successfully',
                        id: String(existingSystem.id),
                    },
                };
            }
            catch (e) {
                return {
                    statusCode: 500,
                    body: { message: 'Error updating system', error: String(e) },
                };
            }
        }
        let uniqueId = data.unique_identifier;
        if (!uniqueId) {
            uniqueId = `SS-${ct.slice(0, 3).toUpperCase()}-${village.slice(0, 3).toUpperCase()}-${settlementRaw ? settlementRaw.slice(0, 3).toUpperCase() : 'XXX'}-${(0, uuid_1.v4)().slice(0, 8)}`;
        }
        const newSystem = this.solarSystemRepo.create({
            tehsil: ct,
            village,
            settlement: settlementDb,
            uniqueIdentifier: uniqueId,
            latitude: this.operatorHelpers.coerceOptionalFloat(data.latitude),
            longitude: this.operatorHelpers.coerceOptionalFloat(data.longitude),
            installationLocation: data.installation_location,
            discoInfo: data.disco_info,
            billReferenceNumber,
            solarPanelCapacity: data.solar_panel_capacity,
            inverterCapacity: data.inverter_capacity,
            inverterSerialNumber: data.inverter_serial_number,
            solarConnectionDate,
            electricityConnectionDate,
            greenConnectionDate,
            installationDate: solarConnectionDate,
            greenMeterConnectionDate: greenConnectionDate,
            remarks: data.remarks,
            createdBy: jwt.sub,
        });
        await this.solarSystemRepo.save(newSystem);
        const meterPayload = this.currentMeterPayload(data, submission_constants_1.MeterType.SOLAR, {
            installation_date: greenConnectionDate,
        });
        const meterRow = await this.upsertMeter({
            meterType: submission_constants_1.MeterType.SOLAR,
            solarSystemId: String(newSystem.id),
            meterModel: meterPayload.meter_model,
            meterSerialNumber: meterPayload.meter_serial_number,
            installationDate: meterPayload.installation_date ?? greenConnectionDate,
            updateMode: this.meterUpdateMode(data),
        });
        if (meterRow)
            await this.systemMeterRepo.save(meterRow);
        return {
            statusCode: 201,
            body: {
                message: 'Solar system added successfully',
                id: String(newSystem.id),
            },
        };
    }
    async submitSolarData(jwt, data) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        const ss = await this.solarSystemRepo.findOne({
            where: { id: data.solar_system_id },
        });
        try {
            this.tehsilAccess.assertUserMayAccessSolarSystem(user, ss, {
                forWrite: true,
            });
        }
        catch {
            return {
                statusCode: 403,
                body: { message: 'Access denied for this solar system' },
            };
        }
        const { normalized, error } = this.normalizeSolarMonthlyFields(data || {});
        if (error)
            return { statusCode: 400, body: { message: error } };
        const newRecord = this.solarMonthlyRepo.create({
            solarSystemId: data.solar_system_id,
            year: data.year,
            month: data.month,
            exportOffPeak: normalized.export_off_peak,
            exportPeak: normalized.export_peak,
            importOffPeak: normalized.import_off_peak,
            importPeak: normalized.import_peak,
            netOffPeak: normalized.net_off_peak,
            netPeak: normalized.net_peak,
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
    async updateWaterSystem(jwt, systemId, data) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        const system = await this.waterSystemRepo.findOne({
            where: { id: systemId },
        });
        if (!system) {
            return { statusCode: 404, body: { message: 'Water system not found' } };
        }
        try {
            this.tehsilAccess.assertUserMayAccessWaterSystem(user, system, {
                forWrite: true,
            });
        }
        catch {
            return {
                statusCode: 403,
                body: { message: 'Access denied for this water system' },
            };
        }
        if ('tehsil' in data) {
            const ctNew = (0, tehsils_1.canonicalTehsil)(data.tehsil);
            if (!ctNew || ctNew !== system.tehsil) {
                return {
                    statusCode: 400,
                    body: { message: 'Cannot change tehsil on an existing water system' },
                };
            }
        }
        if ('village' in data &&
            String(data.village || '').trim() !== String(system.village).trim()) {
            return {
                statusCode: 400,
                body: { message: 'Cannot change village on an existing water system' },
            };
        }
        if ('settlement' in data) {
            const incoming = String(data.settlement || '').trim() || null;
            const current = String(system.settlement || '').trim() || null;
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
            system.pumpModel = this.operatorHelpers.coerceOptionalStr(data.pump_model);
        }
        if ('pump_serial_number' in data) {
            system.pumpSerialNumber = this.operatorHelpers.coerceOptionalStr(data.pump_serial_number);
        }
        if ('start_of_operation' in data) {
            system.startOfOperation = this.operatorHelpers.parseDate(String(data.start_of_operation || ''));
        }
        try {
            if ('latitude' in data) {
                system.latitude = this.operatorHelpers.coerceOptionalFloat(data.latitude);
            }
            if ('longitude' in data) {
                system.longitude = this.operatorHelpers.coerceOptionalFloat(data.longitude);
            }
            if ('depth_of_water_intake' in data) {
                system.depthOfWaterIntake = this.operatorHelpers.coerceOptionalFloat(data.depth_of_water_intake);
            }
            if ('height_to_ohr' in data) {
                system.heightToOhr = this.operatorHelpers.coerceOptionalFloat(data.height_to_ohr);
            }
            if ('pump_flow_rate' in data) {
                system.pumpFlowRate = this.operatorHelpers.coerceOptionalFloat(data.pump_flow_rate);
            }
        }
        catch (exc) {
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
        const meterPayload = this.currentMeterPayload(data, submission_constants_1.MeterType.TUBEWELL, {
            meter_model: activeMeter?.meterModel,
            meter_serial_number: activeMeter?.meterSerialNumber,
            meter_accuracy_class: activeMeter?.meterAccuracyClass,
            installation_date: activeMeter?.installationDate,
        });
        try {
            if ('ohr_tank_capacity' in data) {
                system.ohrTankCapacity = this.operatorHelpers.coerceOptionalFloat(data.ohr_tank_capacity);
            }
            if ('ohr_fill_required' in data) {
                system.ohrFillRequired = this.operatorHelpers.coerceOptionalFloat(data.ohr_fill_required);
            }
            if ('pump_capacity' in data) {
                system.pumpCapacity = this.operatorHelpers.coerceOptionalFloat(data.pump_capacity);
            }
            if ('pump_head' in data) {
                system.pumpHead = this.operatorHelpers.coerceOptionalFloat(data.pump_head);
            }
            if ('pump_horse_power' in data) {
                system.pumpHorsePower = this.operatorHelpers.coerceOptionalFloat(data.pump_horse_power);
            }
            if ('time_to_fill' in data) {
                system.timeToFill = this.operatorHelpers.coerceOptionalFloat(data.time_to_fill);
            }
        }
        catch (exc) {
            return { statusCode: 400, body: { message: String(exc) } };
        }
        const validation = this.validateWaterSystemMeterLogic({
            bulk_meter_installed: system.bulkMeterInstalled,
            meter_model: meterPayload.meter_model,
            meter_serial_number: meterPayload.meter_serial_number,
            meter_accuracy_class: meterPayload.meter_accuracy_class,
            installation_date: meterPayload.installation_date
                ? this.isoDate(meterPayload.installation_date)
                : null,
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
            meterType: submission_constants_1.MeterType.TUBEWELL,
            waterSystemId: String(system.id),
            meterModel: system.bulkMeterInstalled
                ? meterPayload.meter_model
                : null,
            meterSerialNumber: system.bulkMeterInstalled
                ? meterPayload.meter_serial_number
                : null,
            meterAccuracyClass: system.bulkMeterInstalled
                ? meterPayload.meter_accuracy_class
                : null,
            installationDate: system.bulkMeterInstalled
                ? meterPayload.installation_date
                : null,
            updateMode: this.meterUpdateMode(data),
        });
        if (meterRow)
            await this.systemMeterRepo.save(meterRow);
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
        }
        catch (e) {
            return {
                statusCode: 500,
                body: { message: 'Error updating system', error: String(e) },
            };
        }
    }
    async getWaterSystem(jwt, systemId) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        const system = await this.waterSystemRepo.findOne({
            where: { id: systemId },
        });
        if (!system) {
            return { statusCode: 404, body: { message: 'Water system not found' } };
        }
        try {
            this.tehsilAccess.assertUserMayAccessWaterSystem(user, system);
        }
        catch {
            return {
                statusCode: 403,
                body: { message: 'Access denied for this water system' },
            };
        }
        const activeMeter = await this.getActiveMeter(system);
        const meters = await this.meterHistoryPayload(system, submission_constants_1.MeterType.TUBEWELL);
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
    async getWaterSystemCalibrationCertificate(jwt, systemId) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        const system = await this.waterSystemRepo.findOne({
            where: { id: systemId },
        });
        if (!system) {
            return { statusCode: 404, body: { message: 'Water system not found' } };
        }
        try {
            this.tehsilAccess.assertUserMayAccessWaterSystem(user, system);
        }
        catch {
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
            })),
        };
    }
    async putWaterSystemCalibrationCertificate(jwt, systemId, data) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        const system = await this.waterSystemRepo.findOne({
            where: { id: systemId },
        });
        if (!system) {
            return { statusCode: 404, body: { message: 'Water system not found' } };
        }
        try {
            this.tehsilAccess.assertUserMayAccessWaterSystem(user, system, {
                forWrite: true,
            });
        }
        catch {
            return {
                statusCode: 403,
                body: { message: 'Access denied for this water system' },
            };
        }
        const payload = data ?? {};
        const fileUrl = String(payload.file_url || '').trim();
        if (!fileUrl) {
            return { statusCode: 400, body: { message: 'file_url is required' } };
        }
        const expiryRaw = String(payload.expiry_date || '').trim();
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
        await this.calibrationCertRepo.update({ waterSystemId: system.id, isActive: true }, { isActive: false });
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
    async listActiveWaterSystemCalibrationCertificates(jwt) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        if (!user)
            return { statusCode: 404, body: { message: 'User not found' } };
        const jwtScopeTehsils = this.scopeTehsilsFromJwt(jwt);
        const out = [];
        const certWhere = { isActive: true };
        const certs = await this.calibrationCertRepo.find({
            where: certWhere,
        });
        for (const cert of certs) {
            const ws = await this.waterSystemRepo.findOne({
                where: { id: cert.waterSystemId },
            });
            if (!ws)
                continue;
            if (jwtScopeTehsils.length && !jwtScopeTehsils.includes(ws.tehsil))
                continue;
            try {
                this.tehsilAccess.assertUserMayAccessWaterSystem(user, ws);
            }
            catch {
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
            const wa = a.water_system.tehsil.localeCompare(b.water_system.tehsil);
            if (wa !== 0)
                return wa;
            const wv = a.water_system.village.localeCompare(b.water_system.village);
            if (wv !== 0)
                return wv;
            return a.water_system.unique_identifier.localeCompare(b.water_system.unique_identifier);
        });
        return { statusCode: 200, body: out };
    }
    async deleteWaterSystem(jwt, systemId) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        const system = await this.waterSystemRepo.findOne({
            where: { id: systemId },
        });
        if (!system) {
            return { statusCode: 404, body: { message: 'Water system not found' } };
        }
        try {
            this.tehsilAccess.assertUserMayAccessWaterSystem(user, system, {
                forWrite: true,
            });
        }
        catch {
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
    async getSolarSystems(jwt, query) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        if (!user)
            return { statusCode: 404, body: { message: 'User not found' } };
        const rk = this.rbac.userRank(user);
        const ts = [...(await this.rbac.userAssignedTehsils(user))];
        const filterTehsil = query.tehsil;
        const filterVillage = query.village;
        let systems;
        if (rk >= roles_1.ROLE_RANK[roles_1.SUPER_ADMIN]) {
            systems = await this.solarSystemRepo.find();
        }
        else if (ts.length) {
            systems = await this.solarSystemRepo.find({ where: { tehsil: (0, typeorm_2.In)(ts) } });
        }
        else {
            return {
                statusCode: 200,
                body: [],
            };
        }
        if (filterTehsil && filterTehsil !== 'All Tehsils') {
            systems = systems.filter((s) => s.tehsil === filterTehsil);
        }
        if (filterVillage && filterVillage !== 'All Villages') {
            systems = systems.filter((s) => s.village === filterVillage);
        }
        const systemIds = systems.map((s) => s.id);
        const monthlyCounts = {};
        if (systemIds.length) {
            const counts = await this.solarMonthlyRepo
                .createQueryBuilder('m')
                .select('m.solar_system_id', 'systemId')
                .addSelect('COUNT(m.id)', 'total')
                .where('m.solar_system_id IN (:...ids)', { ids: systemIds })
                .groupBy('m.solar_system_id')
                .getRawMany();
            for (const row of counts) {
                monthlyCounts[String(row.systemId)] = parseInt(row.total, 10) || 0;
            }
        }
        const result = [];
        for (const s of systems) {
            const activeMeter = await this.getActiveMeter(s);
            const meters = await this.meterHistoryPayload(s, submission_constants_1.MeterType.SOLAR);
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
                created_at: s.createdAt?.toISOString() ?? null,
                updated_at: s.updatedAt?.toISOString() ?? null,
                monthly_log_count: monthlyCounts[String(s.id)] || 0,
            });
        }
        return {
            statusCode: 200,
            body: result,
        };
    }
    async deleteSolarSystem(jwt, systemId) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        const system = await this.solarSystemRepo.findOne({
            where: { id: systemId },
        });
        if (!system) {
            return { statusCode: 404, body: { message: 'Solar system not found' } };
        }
        try {
            this.tehsilAccess.assertUserMayAccessSolarSystem(user, system, {
                forWrite: true,
            });
        }
        catch {
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
                    message: 'This solar site has monthly energy submissions and cannot be deleted. Remove those monthly records first if your process allows it, or contact operations.',
                },
            };
        }
        await this.solarSystemRepo.delete({ id: systemId });
        return {
            statusCode: 200,
            body: { message: 'Solar system deleted successfully' },
        };
    }
    async getSolarSystem(jwt, systemId) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        const system = await this.solarSystemRepo.findOne({
            where: { id: systemId },
        });
        if (!system) {
            return { statusCode: 404, body: { message: 'Solar system not found' } };
        }
        try {
            this.tehsilAccess.assertUserMayAccessSolarSystem(user, system);
        }
        catch {
            return {
                statusCode: 403,
                body: { message: 'Access denied for this solar system' },
            };
        }
        const activeMeter = await this.getActiveMeter(system);
        const meters = await this.meterHistoryPayload(system, submission_constants_1.MeterType.SOLAR);
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
    async updateSolarSystem(jwt, systemId, data) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        const system = await this.solarSystemRepo.findOne({
            where: { id: systemId },
        });
        if (!system) {
            return { statusCode: 404, body: { message: 'Solar system not found' } };
        }
        try {
            this.tehsilAccess.assertUserMayAccessSolarSystem(user, system, {
                forWrite: true,
            });
        }
        catch {
            return {
                statusCode: 403,
                body: { message: 'Access denied for this solar system' },
            };
        }
        if ('tehsil' in data) {
            const ctNew = (0, tehsils_1.canonicalTehsil)(data.tehsil);
            if (!ctNew || ctNew !== system.tehsil) {
                return {
                    statusCode: 400,
                    body: { message: 'Cannot change tehsil on an existing solar site' },
                };
            }
        }
        if ('village' in data &&
            String(data.village || '').trim() !== String(system.village).trim()) {
            return {
                statusCode: 400,
                body: { message: 'Cannot change village on an existing solar site' },
            };
        }
        if ('settlement' in data) {
            const incoming = String(data.settlement || '').trim() || null;
            const current = String(system.settlement || '').trim() || null;
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
            system.installationLocation = this.operatorHelpers.coerceOptionalStr(data.installation_location);
        }
        if ('disco_info' in data) {
            system.discoInfo = this.operatorHelpers.coerceOptionalStr(data.disco_info);
        }
        if ('bill_reference_number' in data) {
            system.billReferenceNumber = this.operatorHelpers.coerceOptionalStr(data.bill_reference_number);
        }
        if (!this.operatorHelpers.coerceOptionalStr(system.billReferenceNumber)) {
            return {
                statusCode: 400,
                body: { message: 'bill_reference_number is required' },
            };
        }
        try {
            if ('latitude' in data) {
                system.latitude = this.operatorHelpers.coerceOptionalFloat(data.latitude);
            }
            if ('longitude' in data) {
                system.longitude = this.operatorHelpers.coerceOptionalFloat(data.longitude);
            }
            if ('solar_panel_capacity' in data) {
                system.solarPanelCapacity = this.operatorHelpers.coerceOptionalFloat(data.solar_panel_capacity);
            }
            if ('inverter_capacity' in data) {
                system.inverterCapacity = this.operatorHelpers.coerceOptionalFloat(data.inverter_capacity);
            }
        }
        catch (exc) {
            return { statusCode: 400, body: { message: String(exc) } };
        }
        if ('inverter_serial_number' in data) {
            system.inverterSerialNumber = this.operatorHelpers.coerceOptionalStr(data.inverter_serial_number);
        }
        let solarConnectionDate = null;
        if ('solar_connection_date' in data) {
            solarConnectionDate = this.operatorHelpers.parseDate(String(data.solar_connection_date || ''));
        }
        if (solarConnectionDate === null && 'installation_date' in data) {
            solarConnectionDate = this.operatorHelpers.parseDate(String(data.installation_date || ''));
        }
        if (solarConnectionDate !== null) {
            system.solarConnectionDate = solarConnectionDate;
            system.installationDate = solarConnectionDate;
        }
        if ('electricity_connection_date' in data) {
            system.electricityConnectionDate = this.operatorHelpers.parseDate(String(data.electricity_connection_date || ''));
        }
        let greenConnectionDate = null;
        if ('green_connection_date' in data) {
            greenConnectionDate = this.operatorHelpers.parseDate(String(data.green_connection_date || ''));
        }
        if (greenConnectionDate === null && 'green_meter_connection_date' in data) {
            greenConnectionDate = this.operatorHelpers.parseDate(String(data.green_meter_connection_date || ''));
        }
        if (greenConnectionDate !== null) {
            system.greenConnectionDate = greenConnectionDate;
            system.greenMeterConnectionDate = greenConnectionDate;
        }
        if ('remarks' in data) {
            system.remarks = this.operatorHelpers.coerceOptionalStr(data.remarks);
        }
        const activeMeter = await this.getActiveMeter(system);
        const meterPayload = this.currentMeterPayload(data, submission_constants_1.MeterType.SOLAR, {
            meter_model: activeMeter?.meterModel,
            meter_serial_number: activeMeter?.meterSerialNumber,
            installation_date: activeMeter?.installationDate ?? system.greenConnectionDate,
        });
        const meterRow = await this.upsertMeter({
            meterType: submission_constants_1.MeterType.SOLAR,
            solarSystemId: String(system.id),
            meterModel: meterPayload.meter_model,
            meterSerialNumber: meterPayload.meter_serial_number,
            installationDate: meterPayload.installation_date ??
                system.greenConnectionDate,
            updateMode: this.meterUpdateMode(data),
        });
        if (meterRow)
            await this.systemMeterRepo.save(meterRow);
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
        }
        catch (e) {
            return {
                statusCode: 500,
                body: { message: 'Error updating system', error: String(e) },
            };
        }
    }
    async getSolarSystemConfig(jwt, query) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
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
        const ct = (0, tehsils_1.canonicalTehsil)(tehsil);
        if (!ct)
            return { statusCode: 400, body: { message: 'Invalid tehsil' } };
        try {
            this.tehsilAccess.assertUserMayAccessTehsil(user, ct);
        }
        catch {
            return {
                statusCode: 403,
                body: { message: 'Access denied for this tehsil' },
            };
        }
        const system = await this.operatorHelpers.findSolarSystemByLocation(ct, village, settlement, this.solarSystemRepo);
        if (system) {
            const activeMeter = await this.getActiveMeter(system);
            const meters = await this.meterHistoryPayload(system, submission_constants_1.MeterType.SOLAR);
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
    async getSolarSupplyData(jwt, query) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
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
        const ct = (0, tehsils_1.canonicalTehsil)(tehsil);
        if (!ct)
            return { statusCode: 400, body: { message: 'Invalid tehsil' } };
        try {
            this.tehsilAccess.assertUserMayAccessTehsil(user, ct);
        }
        catch {
            return {
                statusCode: 403,
                body: { message: 'Access denied for this tehsil' },
            };
        }
        const system = await this.operatorHelpers.findSolarSystemByLocation(ct, village, settlement, this.solarSystemRepo);
        if (!system) {
            return {
                statusCode: 200,
                body: [],
            };
        }
        const where = { solarSystemId: system.id };
        if (year)
            where.year = year;
        const records = await this.solarMonthlyRepo.find({
            where: where,
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
        return { statusCode: 200, body: out };
    }
    async getSolarSupplyDataRecord(jwt, recordId) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
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
            this.tehsilAccess.assertUserMayAccessSolarSystem(user, system);
        }
        catch {
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
                tehsil: system.tehsil,
                village: system.village,
                settlement: system.settlement || '',
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
    async updateSolarSupplyDataRecord(jwt, recordId, data) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const user = await this.loadActor(jwt);
        if (!user)
            return { statusCode: 404, body: { message: 'User not found' } };
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
            this.tehsilAccess.assertUserMayAccessSolarSystem(user, system, {
                forWrite: true,
            });
        }
        catch {
            return {
                statusCode: 403,
                body: { message: 'Access denied for this solar site' },
            };
        }
        const payload = data ?? {};
        const { normalized, error } = this.normalizeSolarMonthlyFields(payload);
        if (error)
            return { statusCode: 400, body: { message: error } };
        this.applySolarNormalized(record, normalized);
        if ('remarks' in payload) {
            record.remarks = payload.remarks;
        }
        const newUrl = (payload.image_url || payload.image_path);
        if (newUrl &&
            String(newUrl).trim() !== (record.electricityBillImageUrl || '')) {
            await this.storageService.tryDeletePublicObject(record.electricityBillImageUrl);
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
    async deleteSolarSupplyDataRecord(jwt, recordId) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
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
            this.tehsilAccess.assertUserMayAccessSolarSystem(user, system, {
                forWrite: true,
            });
        }
        catch {
            return {
                statusCode: 403,
                body: { message: 'Access denied for this solar site' },
            };
        }
        await this.storageService.tryDeletePublicObject(record.electricityBillImageUrl);
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
    async saveSolarSupplyData(jwt, data) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const rows = data.data || [];
        const year = data.year ?? new Date().getFullYear();
        const imageUrl = (data.image_url || data.image_path);
        if (!rows.length) {
            return { statusCode: 400, body: { message: 'No data provided' } };
        }
        const opUser = await this.loadActor(jwt);
        if (!opUser)
            return { statusCode: 404, body: { message: 'User not found' } };
        const savedIds = [];
        const errors = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                const ct = (0, tehsils_1.canonicalTehsil)(row.tehsil);
                if (!ct) {
                    errors.push(`Row ${i + 1}: invalid tehsil`);
                    continue;
                }
                try {
                    this.tehsilAccess.assertUserMayAccessTehsil(opUser, ct, {
                        forWrite: true,
                    });
                }
                catch {
                    errors.push(`Row ${i + 1}: tehsil not permitted for your account`);
                    continue;
                }
                const system = await this.operatorHelpers.findSolarSystemByLocation(ct, row.village, row.settlement, this.solarSystemRepo);
                if (!system) {
                    errors.push(`Row ${i + 1}: No solar system for this location — your tehsil manager must register it first`);
                    continue;
                }
                const monthlyData = row.monthlyData || [];
                let rowEnergyError = false;
                for (const monthRecord of monthlyData) {
                    const month = monthRecord.month;
                    const { normalized, error } = this.normalizeSolarMonthlyFields(monthRecord || {});
                    if (error) {
                        errors.push(`Row ${i + 1}, month ${monthRecord.month}: ${error}`);
                        rowEnergyError = true;
                        break;
                    }
                    const existing = await this.solarMonthlyRepo.findOne({
                        where: { solarSystemId: system.id, year, month },
                    });
                    if (existing) {
                        this.applySolarNormalized(existing, normalized);
                        if ('remarks' in monthRecord) {
                            existing.remarks = monthRecord.remarks;
                        }
                        if (imageUrl &&
                            (existing.electricityBillImageUrl || '') !==
                                String(imageUrl).trim()) {
                            await this.storageService.tryDeletePublicObject(existing.electricityBillImageUrl);
                            existing.electricityBillImageUrl = String(imageUrl).trim();
                        }
                        await this.solarMonthlyRepo.save(existing);
                    }
                    else {
                        const newRecord = this.solarMonthlyRepo.create({
                            solarSystemId: system.id,
                            year,
                            month,
                            exportOffPeak: normalized.export_off_peak,
                            exportPeak: normalized.export_peak,
                            importOffPeak: normalized.import_off_peak,
                            importPeak: normalized.import_peak,
                            netOffPeak: normalized.net_off_peak,
                            netPeak: normalized.net_peak,
                            electricityBillImageUrl: imageUrl
                                ? String(imageUrl).trim()
                                : null,
                            remarks: monthRecord.remarks,
                        });
                        await this.solarMonthlyRepo.save(newRecord);
                    }
                }
                if (rowEnergyError)
                    continue;
                savedIds.push(String(system.id));
            }
            catch (e) {
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
    async getPendingSubmissions(jwt) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const currentUser = await this.userRepo.findOne({ where: { id: jwt.sub } });
        const statuses = [
            submission_constants_1.SubmissionStatus.SUBMITTED,
            submission_constants_1.SubmissionStatus.REJECTED,
            submission_constants_1.SubmissionStatus.ACCEPTED,
            submission_constants_1.SubmissionStatus.REVERTED_BACK,
        ];
        let submissions = await this.submissionRepo.find({
            where: {
                status: (0, typeorm_2.In)(statuses),
                submissionType: 'water_system',
            },
            order: { submittedAt: 'ASC' },
        });
        if (this.rbac.userRoleCode(currentUser) === roles_1.ADMIN) {
            const filtered = [];
            for (const s of submissions) {
                if (await this.rbac.canAccessTehsil(currentUser, await this.rbac.submissionTehsil(s))) {
                    filtered.push(s);
                }
            }
            submissions = filtered;
        }
        const result = [];
        for (const sub of submissions) {
            const operator = sub.operatorId
                ? await this.userRepo.findOne({ where: { id: sub.operatorId } })
                : null;
            const reviewer = sub.reviewedBy
                ? await this.userRepo.findOne({ where: { id: sub.reviewedBy } })
                : null;
            let systemInfo = {};
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
    async acceptSubmission(jwt, submissionId, data) {
        const currentUser = await this.userRepo.findOne({ where: { id: jwt.sub } });
        const submission = await this.submissionRepo.findOne({
            where: { id: submissionId },
        });
        if (!submission) {
            return { statusCode: 404, body: { error: 'Submission not found' } };
        }
        if (!this.rbac.userCanVerifySubmission(currentUser, submission)) {
            return {
                statusCode: 403,
                body: { error: 'Only tehsil managers can accept submissions' },
            };
        }
        if (submission.status !== submission_constants_1.SubmissionStatus.SUBMITTED) {
            return {
                statusCode: 400,
                body: {
                    error: `Can only accept submissions in '${submission_constants_1.SubmissionStatus.SUBMITTED}' status`,
                },
            };
        }
        const remarks = data?.remarks || '';
        submission.status = submission_constants_1.SubmissionStatus.ACCEPTED;
        submission.reviewedAt = new Date();
        submission.reviewedBy = jwt.sub;
        submission.remarks = remarks;
        if (submission.submissionType === 'water_system') {
            const record = await this.waterDailyRepo.findOne({
                where: { id: submission.recordId },
            });
            if (record)
                record.status = submission_constants_1.SubmissionStatus.ACCEPTED;
            if (record)
                await this.waterDailyRepo.save(record);
        }
        await this.workflowService.logVerificationAction(submission.id, 'accept', jwt.sub, this.rbac.userRoleCode(currentUser), remarks || 'Submission accepted');
        await this.workflowService.notifyOperator(submission.operatorId, 'Submission accepted', `Your water submission was accepted by ${currentUser.name}.`, submission.id);
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
    async rejectSubmission(jwt, submissionId, data) {
        const currentUser = await this.userRepo.findOne({ where: { id: jwt.sub } });
        const submission = await this.submissionRepo.findOne({
            where: { id: submissionId },
        });
        if (!submission) {
            return { statusCode: 404, body: { error: 'Submission not found' } };
        }
        if (!this.rbac.userCanVerifySubmission(currentUser, submission)) {
            return {
                statusCode: 403,
                body: { error: 'Only tehsil managers can reject submissions' },
            };
        }
        if (submission.status !== submission_constants_1.SubmissionStatus.SUBMITTED) {
            return {
                statusCode: 400,
                body: {
                    error: `Can only reject submissions in '${submission_constants_1.SubmissionStatus.SUBMITTED}' status`,
                },
            };
        }
        const remarks = data?.remarks || '';
        if (!remarks) {
            return {
                statusCode: 400,
                body: { error: 'Rejection reason is required' },
            };
        }
        submission.status = submission_constants_1.SubmissionStatus.REJECTED;
        submission.reviewedAt = new Date();
        submission.reviewedBy = jwt.sub;
        submission.remarks = remarks;
        if (submission.submissionType === 'water_system') {
            const record = await this.waterDailyRepo.findOne({
                where: { id: submission.recordId },
            });
            if (record) {
                record.status = submission_constants_1.SubmissionStatus.REJECTED;
                await this.waterDailyRepo.save(record);
            }
        }
        await this.workflowService.logVerificationAction(submission.id, 'reject', jwt.sub, this.rbac.userRoleCode(currentUser), remarks);
        await this.workflowService.notifyOperator(submission.operatorId, 'Submission rejected', `Your ${submission.submissionType} submission was rejected: ${remarks}`, submission.id);
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
    async revertSubmission(jwt, submissionId, data) {
        const currentUser = await this.userRepo.findOne({ where: { id: jwt.sub } });
        const submission = await this.submissionRepo.findOne({
            where: { id: submissionId },
        });
        if (!submission) {
            return { statusCode: 404, body: { error: 'Submission not found' } };
        }
        if (!this.rbac.userCanVerifySubmission(currentUser, submission)) {
            return {
                statusCode: 403,
                body: { error: 'Only tehsil managers can revert submissions' },
            };
        }
        if (submission.status !== submission_constants_1.SubmissionStatus.SUBMITTED) {
            return {
                statusCode: 400,
                body: {
                    error: 'Can only revert submissions that are pending review (submitted)',
                },
            };
        }
        if (submission.submissionType === 'water_system') {
            const record = await this.waterDailyRepo.findOne({
                where: { id: submission.recordId },
            });
            if (!record || record.status !== submission_constants_1.SubmissionStatus.SUBMITTED) {
                return {
                    statusCode: 400,
                    body: { error: 'Water record is not in submitted state' },
                };
            }
        }
        const remarks = data?.remarks || '';
        submission.status = submission_constants_1.SubmissionStatus.REVERTED_BACK;
        submission.reviewedAt = new Date();
        submission.reviewedBy = jwt.sub;
        submission.remarks = remarks || null;
        if (submission.submissionType === 'water_system') {
            const record = await this.waterDailyRepo.findOne({
                where: { id: submission.recordId },
            });
            if (record) {
                record.status = submission_constants_1.SubmissionStatus.REVERTED_BACK;
                await this.waterDailyRepo.save(record);
            }
        }
        await this.workflowService.logVerificationAction(submission.id, 'revert', jwt.sub, this.rbac.userRoleCode(currentUser), remarks || 'Returned to operator for corrections');
        await this.workflowService.notifyOperator(submission.operatorId, 'Submission returned', `Your submission was returned by ${currentUser.name} for corrections.` +
            (remarks ? ` Note: ${remarks}` : ''), submission.id);
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
    async getVerificationAuditLogs(jwt, query) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const currentUser = await this.userRepo.findOne({ where: { id: jwt.sub } });
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
        if (this.rbac.userRoleCode(currentUser) === roles_1.ADMIN) {
            const filtered = [];
            for (const lg of logs) {
                const sub = await this.submissionRepo.findOne({
                    where: { id: lg.submissionId },
                });
                if (sub &&
                    (await this.rbac.canAccessTehsil(currentUser, await this.rbac.submissionTehsil(sub)))) {
                    filtered.push(lg);
                }
            }
            logs = filtered;
        }
        const result = [];
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
    async getVerificationStats(jwt) {
        const denied = this.assertMinRole(jwt, roles_1.ADMIN);
        if (denied)
            return denied;
        const currentUser = await this.userRepo.findOne({ where: { id: jwt.sub } });
        let total;
        let pending;
        let accepted;
        let rejected;
        let reverted;
        let acceptedSubs;
        if (this.rbac.userRoleCode(currentUser) === roles_1.ADMIN) {
            const allSubs = await this.submissionRepo.find({
                where: { submissionType: 'water_system' },
            });
            const scoped = [];
            for (const s of allSubs) {
                if (await this.rbac.canAccessTehsil(currentUser, await this.rbac.submissionTehsil(s))) {
                    scoped.push(s);
                }
            }
            total = scoped.length;
            pending = scoped.filter((s) => s.status === submission_constants_1.SubmissionStatus.SUBMITTED).length;
            accepted = scoped.filter((s) => s.status === submission_constants_1.SubmissionStatus.ACCEPTED).length;
            rejected = scoped.filter((s) => s.status === submission_constants_1.SubmissionStatus.REJECTED).length;
            reverted = scoped.filter((s) => s.status === submission_constants_1.SubmissionStatus.REVERTED_BACK).length;
            acceptedSubs = scoped.filter((s) => s.status === submission_constants_1.SubmissionStatus.ACCEPTED &&
                s.submittedAt &&
                s.reviewedAt);
        }
        else {
            const water = await this.submissionRepo.find({
                where: { submissionType: 'water_system' },
            });
            total = water.length;
            pending = water.filter((s) => s.status === submission_constants_1.SubmissionStatus.SUBMITTED).length;
            accepted = water.filter((s) => s.status === submission_constants_1.SubmissionStatus.ACCEPTED).length;
            rejected = water.filter((s) => s.status === submission_constants_1.SubmissionStatus.REJECTED).length;
            reverted = water.filter((s) => s.status === submission_constants_1.SubmissionStatus.REVERTED_BACK).length;
            acceptedSubs = water.filter((s) => s.status === submission_constants_1.SubmissionStatus.ACCEPTED &&
                s.submittedAt &&
                s.reviewedAt);
        }
        let avgReviewTimeHours = 0;
        if (acceptedSubs.length) {
            const totalHours = acceptedSubs.reduce((sum, sub) => {
                if (sub.reviewedAt && sub.submittedAt) {
                    return (sum +
                        (sub.reviewedAt.getTime() - sub.submittedAt.getTime()) / 3600000);
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
    async getNotifications(jwt) {
        const result = await this.notificationsService.getNotificationsResponse(jwt.sub);
        return { statusCode: 200, body: result };
    }
    async markNotificationRead(jwt, notificationId) {
        const result = await this.notificationsService.markNotificationReadResponse(jwt.sub, notificationId);
        return { statusCode: 200, body: result };
    }
    async markAllNotificationsRead(jwt) {
        const result = await this.notificationsService.markAllNotificationsReadResponse(jwt.sub);
        return { statusCode: 200, body: result };
    }
};
exports.TehsilManagerService = TehsilManagerService;
exports.TehsilManagerService = TehsilManagerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(water_system_entity_1.WaterSystem)),
    __param(1, (0, typeorm_1.InjectRepository)(water_system_calibration_certificate_entity_1.WaterSystemCalibrationCertificate)),
    __param(2, (0, typeorm_1.InjectRepository)(water_energy_logging_daily_entity_1.WaterEnergyLoggingDaily)),
    __param(3, (0, typeorm_1.InjectRepository)(solar_system_entity_1.SolarSystem)),
    __param(4, (0, typeorm_1.InjectRepository)(system_meter_entity_1.SystemMeter)),
    __param(5, (0, typeorm_1.InjectRepository)(solar_energy_logging_monthly_entity_1.SolarEnergyLoggingMonthly)),
    __param(6, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __param(7, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(8, (0, typeorm_1.InjectRepository)(user_water_system_entity_1.UserWaterSystem)),
    __param(9, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __param(10, (0, typeorm_1.InjectRepository)(verification_log_entity_1.VerificationLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        user_service_1.UserService,
        storage_service_1.StorageService,
        workflow_service_1.WorkflowService,
        notifications_service_1.NotificationsService,
        water_submission_detail_service_1.WaterSubmissionDetailService,
        operator_helpers_service_1.OperatorHelpersService,
        tehsil_access_service_1.TehsilAccessService,
        rbac_service_1.RbacService])
], TehsilManagerService);
//# sourceMappingURL=tehsil-manager.service.js.map