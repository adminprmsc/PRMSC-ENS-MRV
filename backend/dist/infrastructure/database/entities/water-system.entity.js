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
exports.WaterSystem = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const submission_constants_1 = require("../../../domain/constants/submission.constants");
const date_transformer_1 = require("../transformers/date.transformer");
const system_meter_entity_1 = require("./system-meter.entity");
const water_energy_logging_daily_entity_1 = require("./water-energy-logging-daily.entity");
const water_system_calibration_certificate_entity_1 = require("./water-system-calibration-certificate.entity");
let WaterSystem = class WaterSystem {
    id;
    tehsil;
    village;
    settlement;
    uniqueIdentifier;
    latitude;
    longitude;
    pumpModel;
    pumpSerialNumber;
    startOfOperation;
    depthOfWaterIntake;
    heightToOhr;
    pumpFlowRate;
    bulkMeterInstalled;
    ohrTankCapacity;
    ohrFillRequired;
    pumpCapacity;
    pumpHead;
    pumpHorsePower;
    timeToFill;
    meterModel;
    meterSerialNumber;
    meterAccuracyClass;
    installationDate;
    createdBy;
    createdAt;
    updatedAt;
    meters;
    records;
    calibrationCertificates;
    get activeMeter() {
        const tubewellMeters = (this.meters ?? [])
            .filter((m) => m.isActive && m.meterType === submission_constants_1.METER_TYPE_TUBEWELL)
            .sort((a, b) => {
            const aKey = (a.createdAt?.getTime() ?? 0).toString() + String(a.id);
            const bKey = (b.createdAt?.getTime() ?? 0).toString() + String(b.id);
            return bKey.localeCompare(aKey);
        });
        return tubewellMeters[0];
    }
};
exports.WaterSystem = WaterSystem;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 36, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], WaterSystem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], WaterSystem.prototype, "tehsil", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], WaterSystem.prototype, "village", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "settlement", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'unique_identifier',
        type: 'varchar',
        length: 100,
        unique: true,
    }),
    __metadata("design:type", String)
], WaterSystem.prototype, "uniqueIdentifier", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pump_model', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "pumpModel", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'pump_serial_number',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "pumpSerialNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'start_of_operation',
        type: 'date',
        nullable: true,
        transformer: date_transformer_1.dateColumnTransformer,
    }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "startOfOperation", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'depth_of_water_intake', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "depthOfWaterIntake", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'height_to_ohr', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "heightToOhr", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pump_flow_rate', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "pumpFlowRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'bulk_meter_installed', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], WaterSystem.prototype, "bulkMeterInstalled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ohr_tank_capacity', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "ohrTankCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ohr_fill_required', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "ohrFillRequired", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pump_capacity', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "pumpCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pump_head', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "pumpHead", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pump_horse_power', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "pumpHorsePower", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'time_to_fill', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "timeToFill", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'meter_model', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "meterModel", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'meter_serial_number',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "meterSerialNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'meter_accuracy_class',
        type: 'varchar',
        length: 50,
        nullable: true,
    }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "meterAccuracyClass", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'installation_date',
        type: 'date',
        nullable: true,
        transformer: date_transformer_1.dateColumnTransformer,
    }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "installationDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], WaterSystem.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: 'created_at',
        type: 'timestamp',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], WaterSystem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        name: 'updated_at',
        type: 'timestamp',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], WaterSystem.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => system_meter_entity_1.SystemMeter, (meter) => meter.waterSystem, { cascade: true }),
    __metadata("design:type", Array)
], WaterSystem.prototype, "meters", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => water_energy_logging_daily_entity_1.WaterEnergyLoggingDaily, (record) => record.system),
    __metadata("design:type", Array)
], WaterSystem.prototype, "records", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => water_system_calibration_certificate_entity_1.WaterSystemCalibrationCertificate, (cert) => cert.waterSystem),
    __metadata("design:type", Array)
], WaterSystem.prototype, "calibrationCertificates", void 0);
exports.WaterSystem = WaterSystem = __decorate([
    (0, typeorm_1.Entity)('water_systems')
], WaterSystem);
//# sourceMappingURL=water-system.entity.js.map