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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaterEnergyLoggingDaily = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const submission_constants_1 = require("../../../domain/constants/submission.constants");
const date_transformer_1 = require("../transformers/date.transformer");
const water_system_entity_1 = require("./water-system.entity");
let WaterEnergyLoggingDaily = class WaterEnergyLoggingDaily {
    id;
    waterSystemId;
    logDate;
    pumpStartTime;
    pumpEndTime;
    pumpOperatingHours;
    totalWaterPumped;
    meterReadingStart;
    meterReadingEnd;
    bulkMeterImageUrl;
    signed;
    signatureSvgSnapshot;
    status;
    remarks;
    createdAt;
    updatedAt;
    system;
};
exports.WaterEnergyLoggingDaily = WaterEnergyLoggingDaily;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 36, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], WaterEnergyLoggingDaily.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'water_system_id', type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], WaterEnergyLoggingDaily.prototype, "waterSystemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'log_date', type: 'date', transformer: date_transformer_1.dateColumnTransformer }),
    __metadata("design:type", Date)
], WaterEnergyLoggingDaily.prototype, "logDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pump_start_time', type: 'time', nullable: true }),
    __metadata("design:type", Object)
], WaterEnergyLoggingDaily.prototype, "pumpStartTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pump_end_time', type: 'time', nullable: true }),
    __metadata("design:type", Object)
], WaterEnergyLoggingDaily.prototype, "pumpEndTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pump_operating_hours', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterEnergyLoggingDaily.prototype, "pumpOperatingHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_water_pumped', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterEnergyLoggingDaily.prototype, "totalWaterPumped", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'meter_reading_start', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterEnergyLoggingDaily.prototype, "meterReadingStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'meter_reading_end', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterEnergyLoggingDaily.prototype, "meterReadingEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'bulk_meter_image_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WaterEnergyLoggingDaily.prototype, "bulkMeterImageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], WaterEnergyLoggingDaily.prototype, "signed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'signature_svg_snapshot', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WaterEnergyLoggingDaily.prototype, "signatureSvgSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 24, default: submission_constants_1.SUBMISSION_STATUS_DRAFTED }),
    __metadata("design:type", String)
], WaterEnergyLoggingDaily.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WaterEnergyLoggingDaily.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: 'created_at',
        type: 'timestamp',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], WaterEnergyLoggingDaily.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        name: 'updated_at',
        type: 'timestamp',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], WaterEnergyLoggingDaily.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => water_system_entity_1.WaterSystem, (ws) => ws.records),
    (0, typeorm_1.JoinColumn)({ name: 'water_system_id' }),
    __metadata("design:type", water_system_entity_1.WaterSystem)
], WaterEnergyLoggingDaily.prototype, "system", void 0);
exports.WaterEnergyLoggingDaily = WaterEnergyLoggingDaily = __decorate([
    (0, typeorm_1.Entity)('water_energy_logging_daily'),
    (0, typeorm_1.Unique)('uq_water_energy_logging_daily_sid_date_times', [
        'waterSystemId',
        'logDate',
        'pumpStartTime',
        'pumpEndTime',
    ])
], WaterEnergyLoggingDaily);
//# sourceMappingURL=water-energy-logging-daily.entity.js.map