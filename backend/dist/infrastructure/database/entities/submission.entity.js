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
exports.Submission = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const submission_constants_1 = require("../../../domain/constants/submission.constants");
const date_transformer_1 = require("../transformers/date.transformer");
const user_entity_1 = require("./user.entity");
const notification_entity_1 = require("./notification.entity");
const verification_log_entity_1 = require("./verification-log.entity");
let Submission = class Submission {
    id;
    operatorId;
    submissionType;
    recordId;
    status;
    submittedAt;
    reviewedAt;
    approvedAt;
    reviewedBy;
    approvedBy;
    remarks;
    createdAt;
    updatedAt;
    operator;
    reviewer;
    approver;
    logs;
    notifications;
};
exports.Submission = Submission;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 36, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], Submission.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'operator_id', type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], Submission.prototype, "operatorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'submission_type', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], Submission.prototype, "submissionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'record_id', type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], Submission.prototype, "recordId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: submission_constants_1.SUBMISSION_STATUS_DRAFTED }),
    __metadata("design:type", String)
], Submission.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'submitted_at',
        type: 'timestamp',
        nullable: true,
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Object)
], Submission.prototype, "submittedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'reviewed_at',
        type: 'timestamp',
        nullable: true,
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Object)
], Submission.prototype, "reviewedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'approved_at',
        type: 'timestamp',
        nullable: true,
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Object)
], Submission.prototype, "approvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reviewed_by', type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], Submission.prototype, "reviewedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'approved_by', type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], Submission.prototype, "approvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Submission.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        name: 'created_at',
        type: 'timestamp',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], Submission.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        name: 'updated_at',
        type: 'timestamp',
        transformer: date_transformer_1.timestampColumnTransformer,
    }),
    __metadata("design:type", Date)
], Submission.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'operator_id' }),
    __metadata("design:type", user_entity_1.User)
], Submission.prototype, "operator", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'reviewed_by' }),
    __metadata("design:type", Object)
], Submission.prototype, "reviewer", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'approved_by' }),
    __metadata("design:type", Object)
], Submission.prototype, "approver", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => verification_log_entity_1.VerificationLog, (log) => log.submission),
    __metadata("design:type", Array)
], Submission.prototype, "logs", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => notification_entity_1.Notification, (n) => n.submission),
    __metadata("design:type", Array)
], Submission.prototype, "notifications", void 0);
exports.Submission = Submission = __decorate([
    (0, typeorm_1.Entity)('submissions')
], Submission);
//# sourceMappingURL=submission.entity.js.map