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
exports.SystemMeter = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const date_transformer_1 = require("../transformers/date.transformer");
const solar_system_entity_1 = require("./solar-system.entity");
const water_system_entity_1 = require("./water-system.entity");
let SystemMeter = class SystemMeter {
    id;
    meterType;
    waterSystemId;
    solarSystemId;
    meterModel;
    meterSerialNumber;
    meterAccuracyClass;
    installationDate;
    isActive;
    createdAt;
    updatedAt;
    waterSystem;
    solarSystem;
};
exports.SystemMeter = SystemMeter;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 36, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], SystemMeter.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'meter_type', type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], SystemMeter.prototype, "meterType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'water_system_id',
        type: 'varchar',
        length: 36,
        nullable: true,
    }),
    __metadata("design:type", Object)
], SystemMeter.prototype, "waterSystemId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'solar_system_id',
        type: 'varchar',
        length: 36,
        nullable: true,
    }),
    __metadata("design:type", Object)
], SystemMeter.prototype, "solarSystemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'meter_model', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], SystemMeter.prototype, "meterModel", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'meter_serial_number',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], SystemMeter.prototype, "meterSerialNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'meter_accuracy_class',
        type: 'varchar',
        length: 50,
        nullable: true,
    }),
    __metadata("design:type", Object)
], SystemMeter.prototype, "meterAccuracyClass", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'installation_date',
        type: 'date',
        nullable: true,
        transformer: date_transformer_1.dateColumnTransformer,
    }),
    __metadata("design:type", Object)
], SystemMeter.prototype, "installationDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], SystemMeter.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: 'created_at',
        type: 'timestamp',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], SystemMeter.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        name: 'updated_at',
        type: 'timestamp',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], SystemMeter.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => water_system_entity_1.WaterSystem, (ws) => ws.meters, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'water_system_id' }),
    __metadata("design:type", Object)
], SystemMeter.prototype, "waterSystem", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => solar_system_entity_1.SolarSystem, (ss) => ss.meters, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'solar_system_id' }),
    __metadata("design:type", Object)
], SystemMeter.prototype, "solarSystem", void 0);
exports.SystemMeter = SystemMeter = __decorate([
    (0, typeorm_1.Entity)('system_meters')
], SystemMeter);
//# sourceMappingURL=system-meter.entity.js.map