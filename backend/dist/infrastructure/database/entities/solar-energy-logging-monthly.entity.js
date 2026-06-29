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
exports.SolarEnergyLoggingMonthly = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const solar_system_entity_1 = require("./solar-system.entity");
let SolarEnergyLoggingMonthly = class SolarEnergyLoggingMonthly {
    id;
    solarSystemId;
    year;
    month;
    exportOffPeak;
    exportPeak;
    importOffPeak;
    importPeak;
    netOffPeak;
    netPeak;
    electricityBillImageUrl;
    remarks;
    createdAt;
    updatedAt;
    system;
};
exports.SolarEnergyLoggingMonthly = SolarEnergyLoggingMonthly;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 36, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], SolarEnergyLoggingMonthly.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'solar_system_id', type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], SolarEnergyLoggingMonthly.prototype, "solarSystemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], SolarEnergyLoggingMonthly.prototype, "year", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], SolarEnergyLoggingMonthly.prototype, "month", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'export_off_peak', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], SolarEnergyLoggingMonthly.prototype, "exportOffPeak", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'export_peak', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], SolarEnergyLoggingMonthly.prototype, "exportPeak", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'import_off_peak', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], SolarEnergyLoggingMonthly.prototype, "importOffPeak", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'import_peak', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], SolarEnergyLoggingMonthly.prototype, "importPeak", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'net_off_peak', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], SolarEnergyLoggingMonthly.prototype, "netOffPeak", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'net_peak', type: 'float', nullable: true }),
    __metadata("design:type", Object)
], SolarEnergyLoggingMonthly.prototype, "netPeak", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'electricity_bill_image_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], SolarEnergyLoggingMonthly.prototype, "electricityBillImageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], SolarEnergyLoggingMonthly.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], SolarEnergyLoggingMonthly.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], SolarEnergyLoggingMonthly.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => solar_system_entity_1.SolarSystem, (ss) => ss.records),
    (0, typeorm_1.JoinColumn)({ name: 'solar_system_id' }),
    __metadata("design:type", solar_system_entity_1.SolarSystem)
], SolarEnergyLoggingMonthly.prototype, "system", void 0);
exports.SolarEnergyLoggingMonthly = SolarEnergyLoggingMonthly = __decorate([
    (0, typeorm_1.Entity)('solar_energy_logging_monthly')
], SolarEnergyLoggingMonthly);
//# sourceMappingURL=solar-energy-logging-monthly.entity.js.map