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
exports.OperatorHelpersService = exports.ALLOWED_EXTENSIONS = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const submission_constants_1 = require("../../domain/constants/submission.constants");
const date_util_1 = require("../../domain/utils/date.util");
const solar_system_entity_1 = require("../../infrastructure/database/entities/solar-system.entity");
const system_meter_entity_1 = require("../../infrastructure/database/entities/system-meter.entity");
exports.ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'pdf']);
let OperatorHelpersService = class OperatorHelpersService {
    solarSystemRepo;
    systemMeterRepo;
    constructor(solarSystemRepo, systemMeterRepo) {
        this.solarSystemRepo = solarSystemRepo;
        this.systemMeterRepo = systemMeterRepo;
    }
    parseDate(dateStr) {
        if (!dateStr) {
            return null;
        }
        const d = new Date(dateStr);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    allowedFile(filename) {
        const parts = filename.split('.');
        if (parts.length < 2) {
            return false;
        }
        const ext = parts[parts.length - 1].toLowerCase();
        return exports.ALLOWED_EXTENSIONS.has(ext);
    }
    async findSolarSystemByLocation(tehsilCanonical, village, settlementRaw, repo = this.solarSystemRepo) {
        if (!village) {
            return null;
        }
        const st = (settlementRaw ?? '').trim();
        if (st) {
            return repo.findOne({
                where: { tehsil: tehsilCanonical, village, settlement: st },
            });
        }
        return repo.findOne({
            where: [
                { tehsil: tehsilCanonical, village, settlement: (0, typeorm_2.IsNull)() },
                { tehsil: tehsilCanonical, village, settlement: '' },
            ],
        });
    }
    coerceOptionalFloat(val) {
        if (val == null || val === '') {
            return null;
        }
        if (typeof val === 'boolean') {
            throw new Error(`Invalid numeric value: ${String(val)}`);
        }
        if (typeof val === 'number') {
            return val;
        }
        const parsed = parseFloat(String(val).trim());
        if (Number.isNaN(parsed)) {
            throw new Error(`Invalid numeric value: ${String(val)}`);
        }
        return parsed;
    }
    coerceOptionalStr(value) {
        if (value == null) {
            return null;
        }
        const s = String(value).trim();
        return s || null;
    }
    meterToDict(meter) {
        if (!meter) {
            return null;
        }
        return {
            id: String(meter.id),
            meter_type: meter.meterType,
            meter_model: meter.meterModel,
            meter_serial_number: meter.meterSerialNumber,
            meter_accuracy_class: meter.meterAccuracyClass,
            installation_date: (0, date_util_1.toIsoDateString)(meter.installationDate),
            is_active: Boolean(meter.isActive),
            created_at: (0, date_util_1.toIsoDateTimeString)(meter.createdAt),
            updated_at: (0, date_util_1.toIsoDateTimeString)(meter.updatedAt),
        };
    }
    async getSystemMeters(system, repo = this.systemMeterRepo) {
        const isWater = 'bulkMeterInstalled' in system;
        return repo.find({
            where: isWater
                ? { waterSystemId: system.id }
                : { solarSystemId: system.id },
            order: { createdAt: 'DESC' },
        });
    }
    async getActiveMeter(system, repo = this.systemMeterRepo) {
        const active = system.activeMeter;
        if (active) {
            return active;
        }
        const meterType = 'bulkMeterInstalled' in system ? submission_constants_1.METER_TYPE_TUBEWELL : submission_constants_1.METER_TYPE_SOLAR;
        const meters = await this.getSystemMeters(system, repo);
        return meters.find((m) => m.isActive && m.meterType === meterType) ?? null;
    }
    async upsertActiveSystemMeter(options, repo = this.systemMeterRepo) {
        const { meterType, waterSystemId, solarSystemId, meterModel, meterSerialNumber, meterAccuracyClass, updateMode = 'auto', } = options;
        if (meterType !== submission_constants_1.METER_TYPE_TUBEWELL && meterType !== submission_constants_1.METER_TYPE_SOLAR) {
            throw new Error('Invalid meter_type');
        }
        if (Boolean(waterSystemId) === Boolean(solarSystemId)) {
            throw new Error('Exactly one system id is required for meter upsert');
        }
        const model = this.coerceOptionalStr(meterModel);
        const serial = this.coerceOptionalStr(meterSerialNumber);
        const accuracy = this.coerceOptionalStr(meterAccuracyClass);
        const parsedInstallationDate = options.installationDate instanceof Date
            ? options.installationDate
            : this.parseDate(options.installationDate != null
                ? String(options.installationDate)
                : null);
        const hasPayload = Boolean(model || serial || accuracy || parsedInstallationDate);
        const current = await repo.findOne({
            where: {
                meterType,
                waterSystemId: waterSystemId ?? undefined,
                solarSystemId: solarSystemId ?? undefined,
                isActive: true,
            },
            order: { createdAt: 'DESC' },
        });
        if (!hasPayload) {
            if (current) {
                current.isActive = false;
                await repo.save(current);
            }
            return null;
        }
        if (!['auto', 'update_current', 'switch_new'].includes(updateMode)) {
            throw new Error('Invalid meter update mode');
        }
        if (updateMode === 'update_current' && current) {
            current.meterModel = model;
            current.meterSerialNumber = serial;
            current.meterAccuracyClass = accuracy;
            current.installationDate = parsedInstallationDate;
            current.isActive = true;
            return repo.save(current);
        }
        if (current &&
            current.meterModel === model &&
            current.meterSerialNumber === serial &&
            current.meterAccuracyClass === accuracy &&
            current.installationDate?.getTime() === parsedInstallationDate?.getTime()) {
            return current;
        }
        if (current) {
            current.isActive = false;
            await repo.save(current);
        }
        const meter = repo.create({
            meterType,
            waterSystemId: waterSystemId ?? null,
            solarSystemId: solarSystemId ?? null,
            meterModel: model,
            meterSerialNumber: serial,
            meterAccuracyClass: accuracy,
            installationDate: parsedInstallationDate,
            isActive: true,
        });
        return repo.save(meter);
    }
};
exports.OperatorHelpersService = OperatorHelpersService;
exports.OperatorHelpersService = OperatorHelpersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(solar_system_entity_1.SolarSystem)),
    __param(1, (0, typeorm_1.InjectRepository)(system_meter_entity_1.SystemMeter)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], OperatorHelpersService);
//# sourceMappingURL=operator-helpers.service.js.map