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
exports.WaterMeterBackfillService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const submission_constants_1 = require("../../domain/constants/submission.constants");
const water_energy_logging_daily_entity_1 = require("../../infrastructure/database/entities/water-energy-logging-daily.entity");
const water_system_entity_1 = require("../../infrastructure/database/entities/water-system.entity");
const water_meter_volume_service_1 = require("./water-meter-volume.service");
let WaterMeterBackfillService = class WaterMeterBackfillService {
    waterSystemRepo;
    waterLogRepo;
    waterMeterVolume;
    constructor(waterSystemRepo, waterLogRepo, waterMeterVolume) {
        this.waterSystemRepo = waterSystemRepo;
        this.waterLogRepo = waterLogRepo;
        this.waterMeterVolume = waterMeterVolume;
    }
    isRejected(log) {
        return log.status === submission_constants_1.SUBMISSION_STATUS_REJECTED;
    }
    floatOrNone(value) {
        if (value == null) {
            return null;
        }
        return Number(value);
    }
    valuesDiffer(a, b, epsilon = 1e-6) {
        if (a == null && b == null) {
            return false;
        }
        if (a == null || b == null) {
            return true;
        }
        return Math.abs(Number(a) - Number(b)) > epsilon;
    }
    cumulativeStopReading(log) {
        if (log.meterReadingEnd != null) {
            return Number(log.meterReadingEnd);
        }
        if (log.meterReadingStart != null && log.totalWaterPumped != null) {
            return Number(log.meterReadingStart) + Number(log.totalWaterPumped);
        }
        if (log.totalWaterPumped != null) {
            return Number(log.totalWaterPumped);
        }
        return null;
    }
    formatLogDate(log) {
        if (!log.logDate) {
            return null;
        }
        if (log.logDate instanceof Date) {
            return log.logDate.toISOString().slice(0, 10);
        }
        return String(log.logDate).slice(0, 10);
    }
    planMeterCorrectionsForLogs(logs, bulkMeterInstalled) {
        const corrections = [];
        const issues = [];
        const ordered = this.waterMeterVolume.sortWaterLogs(logs);
        if (!bulkMeterInstalled) {
            for (const log of ordered) {
                if (this.isRejected(log)) {
                    continue;
                }
                if (log.meterReadingStart != null ||
                    log.meterReadingEnd != null ||
                    log.totalWaterPumped != null) {
                    corrections.push({
                        logId: String(log.id),
                        waterSystemId: String(log.waterSystemId),
                        logDate: this.formatLogDate(log),
                        oldMeterReadingStart: this.floatOrNone(log.meterReadingStart),
                        oldMeterReadingEnd: this.floatOrNone(log.meterReadingEnd),
                        oldTotalWaterPumped: this.floatOrNone(log.totalWaterPumped),
                        newMeterReadingStart: null,
                        newMeterReadingEnd: null,
                        newTotalWaterPumped: null,
                        note: 'No bulk meter installed — clearing meter and volume fields',
                    });
                }
            }
            return { corrections, issues };
        }
        let prevEnd = null;
        for (const log of ordered) {
            if (this.isRejected(log)) {
                continue;
            }
            const cumulativeEnd = this.cumulativeStopReading(log);
            if (cumulativeEnd == null) {
                continue;
            }
            const newEnd = cumulativeEnd;
            let newStart;
            let newTotal;
            let note = '';
            if (prevEnd == null) {
                if (log.meterReadingStart != null) {
                    newStart = Number(log.meterReadingStart);
                    newTotal = newEnd > newStart ? newEnd - newStart : null;
                    if (newTotal == null) {
                        issues.push({
                            logId: String(log.id),
                            waterSystemId: String(log.waterSystemId),
                            logDate: this.formatLogDate(log),
                            message: `The first log's pump-stop reading (${newEnd}) is not greater than the stored initial reading (${newStart})`,
                        });
                        continue;
                    }
                    note =
                        'First log — interval calculated from the stored initial reading';
                }
                else {
                    newStart = null;
                    newTotal = null;
                    note =
                        'First log — only the pump-stop reading is known; interval left empty (no initial reading on record)';
                }
            }
            else if (newEnd <= prevEnd) {
                issues.push({
                    logId: String(log.id),
                    waterSystemId: String(log.waterSystemId),
                    logDate: this.formatLogDate(log),
                    message: `Non-monotonic cumulative reading: pump-stop reading ${newEnd} is not greater than the previous pump-stop reading ${prevEnd}`,
                });
                continue;
            }
            else {
                newStart = prevEnd;
                newTotal = newEnd - newStart;
                note = 'Interval calculated from the previous pump-stop reading';
            }
            if (this.valuesDiffer(log.meterReadingStart, newStart) ||
                this.valuesDiffer(log.meterReadingEnd, newEnd) ||
                this.valuesDiffer(log.totalWaterPumped, newTotal)) {
                corrections.push({
                    logId: String(log.id),
                    waterSystemId: String(log.waterSystemId),
                    logDate: this.formatLogDate(log),
                    oldMeterReadingStart: this.floatOrNone(log.meterReadingStart),
                    oldMeterReadingEnd: this.floatOrNone(log.meterReadingEnd),
                    oldTotalWaterPumped: this.floatOrNone(log.totalWaterPumped),
                    newMeterReadingStart: newStart,
                    newMeterReadingEnd: newEnd,
                    newTotalWaterPumped: newTotal,
                    note,
                });
            }
            prevEnd = newEnd;
        }
        return { corrections, issues };
    }
    async planMeterCorrections(systemId) {
        const qb = this.waterSystemRepo
            .createQueryBuilder('ws')
            .orderBy('ws.tehsil', 'ASC')
            .addOrderBy('ws.village', 'ASC')
            .addOrderBy('ws.unique_identifier', 'ASC');
        if (systemId) {
            qb.where('ws.id = :systemId', { systemId });
        }
        const systems = await qb.getMany();
        const allCorrections = [];
        const allIssues = [];
        for (const system of systems) {
            const logs = await this.waterLogRepo.find({
                where: { waterSystemId: system.id },
                order: { logDate: 'ASC' },
            });
            const bulk = system.bulkMeterInstalled !== false;
            const { corrections, issues } = this.planMeterCorrectionsForLogs(logs, bulk);
            allCorrections.push(...corrections);
            allIssues.push(...issues);
        }
        return { corrections: allCorrections, issues: allIssues };
    }
    async applyMeterCorrections(corrections) {
        let updated = 0;
        for (const item of corrections) {
            const log = await this.waterLogRepo.findOne({
                where: { id: item.logId },
            });
            if (!log) {
                continue;
            }
            log.meterReadingStart = item.newMeterReadingStart;
            log.meterReadingEnd = item.newMeterReadingEnd;
            log.totalWaterPumped = item.newTotalWaterPumped;
            await this.waterLogRepo.save(log);
            updated += 1;
        }
        return updated;
    }
};
exports.WaterMeterBackfillService = WaterMeterBackfillService;
exports.WaterMeterBackfillService = WaterMeterBackfillService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(water_system_entity_1.WaterSystem)),
    __param(1, (0, typeorm_1.InjectRepository)(water_energy_logging_daily_entity_1.WaterEnergyLoggingDaily)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        water_meter_volume_service_1.WaterMeterVolumeService])
], WaterMeterBackfillService);
//# sourceMappingURL=water-meter-backfill.service.js.map