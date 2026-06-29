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
exports.WaterSystemCalibrationCertificate = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const date_transformer_1 = require("../transformers/date.transformer");
const water_system_entity_1 = require("./water-system.entity");
let WaterSystemCalibrationCertificate = class WaterSystemCalibrationCertificate {
    id;
    waterSystemId;
    fileUrl;
    uploadedAt;
    expiryDate;
    isActive;
    createdAt;
    updatedAt;
    waterSystem;
};
exports.WaterSystemCalibrationCertificate = WaterSystemCalibrationCertificate;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 36, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], WaterSystemCalibrationCertificate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'water_system_id', type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], WaterSystemCalibrationCertificate.prototype, "waterSystemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_url', type: 'text' }),
    __metadata("design:type", String)
], WaterSystemCalibrationCertificate.prototype, "fileUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'uploaded_at',
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], WaterSystemCalibrationCertificate.prototype, "uploadedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'expiry_date',
        type: 'date',
        nullable: true,
        transformer: date_transformer_1.dateColumnTransformer,
    }),
    __metadata("design:type", Object)
], WaterSystemCalibrationCertificate.prototype, "expiryDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], WaterSystemCalibrationCertificate.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: 'created_at',
        type: 'timestamp',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], WaterSystemCalibrationCertificate.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        name: 'updated_at',
        type: 'timestamp',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], WaterSystemCalibrationCertificate.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => water_system_entity_1.WaterSystem, (ws) => ws.calibrationCertificates, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'water_system_id' }),
    __metadata("design:type", water_system_entity_1.WaterSystem)
], WaterSystemCalibrationCertificate.prototype, "waterSystem", void 0);
exports.WaterSystemCalibrationCertificate = WaterSystemCalibrationCertificate = __decorate([
    (0, typeorm_1.Entity)('water_system_calibration_certificates')
], WaterSystemCalibrationCertificate);
//# sourceMappingURL=water-system-calibration-certificate.entity.js.map