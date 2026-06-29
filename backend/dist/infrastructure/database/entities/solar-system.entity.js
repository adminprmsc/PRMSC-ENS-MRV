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
exports.SolarSystem = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const submission_constants_1 = require("../../../domain/constants/submission.constants");
const date_transformer_1 = require("../transformers/date.transformer");
const solar_energy_logging_monthly_entity_1 = require("./solar-energy-logging-monthly.entity");
const system_meter_entity_1 = require("./system-meter.entity");
let SolarSystem = class SolarSystem {
    id;
    tehsil;
    village;
    settlement;
    uniqueIdentifier;
    latitude;
    longitude;
    installationLocation;
    discoInfo;
    billReferenceNumber;
    solarPanelCapacity;
    inverterCapacity;
    inverterSerialNumber;
    installationDate;
    solarConnectionDate;
    electricityConnectionDate;
    greenConnectionDate;
    meterModel;
    meterSerialNumber;
    greenMeterConnectionDate;
    remarks;
    createdBy;
    createdAt;
    updatedAt;
    meters;
    records;
    get activeMeter() {
        const solarMeters = (this.meters ?? [])
            .filter((m) => m.isActive && m.meterType === submission_constants_1.METER_TYPE_SOLAR)
            .sort((a, b) => {
            const aKey = (a.createdAt?.getTime() ?? 0).toString() + String(a.id);
            const bKey = (b.createdAt?.getTime() ?? 0).toString() + String(b.id);
            return bKey.localeCompare(aKey);
        });
        return solarMeters[0];
    }
};
exports.SolarSystem = SolarSystem;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 36, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], SolarSystem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], SolarSystem.prototype, "tehsil", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], SolarSystem.prototype, "village", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, nullable: true }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "settlement", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'unique_identifier',
        type: 'varchar',
        length: 100,
        unique: true,
    }),
    __metadata("design:type", String)
], SolarSystem.prototype, "uniqueIdentifier", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'installation_location',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "installationLocation", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'disco_info', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "discoInfo", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'bill_reference_number',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "billReferenceNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'solar_panel_capacity', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "solarPanelCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'inverter_capacity', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "inverterCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'inverter_serial_number',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "inverterSerialNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'installation_date',
        type: 'date',
        nullable: true,
        transformer: date_transformer_1.dateColumnTransformer,
    }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "installationDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'solar_connection_date',
        type: 'date',
        nullable: true,
        transformer: date_transformer_1.dateColumnTransformer,
    }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "solarConnectionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'electricity_connection_date',
        type: 'date',
        nullable: true,
        transformer: date_transformer_1.dateColumnTransformer,
    }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "electricityConnectionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'green_connection_date',
        type: 'date',
        nullable: true,
        transformer: date_transformer_1.dateColumnTransformer,
    }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "greenConnectionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'meter_model', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "meterModel", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'meter_serial_number',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "meterSerialNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'green_meter_connection_date',
        type: 'date',
        nullable: true,
        transformer: date_transformer_1.dateColumnTransformer,
    }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "greenMeterConnectionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], SolarSystem.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: 'created_at',
        type: 'timestamp',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], SolarSystem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        name: 'updated_at',
        type: 'timestamp',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], SolarSystem.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => system_meter_entity_1.SystemMeter, (meter) => meter.solarSystem, { cascade: true }),
    __metadata("design:type", Array)
], SolarSystem.prototype, "meters", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => solar_energy_logging_monthly_entity_1.SolarEnergyLoggingMonthly, (record) => record.system),
    __metadata("design:type", Array)
], SolarSystem.prototype, "records", void 0);
exports.SolarSystem = SolarSystem = __decorate([
    (0, typeorm_1.Entity)('solar_systems')
], SolarSystem);
//# sourceMappingURL=solar-system.entity.js.map