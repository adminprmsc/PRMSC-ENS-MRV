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
exports.VerificationLog = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const submission_entity_1 = require("./submission.entity");
const user_entity_1 = require("./user.entity");
let VerificationLog = class VerificationLog {
    id;
    submissionId;
    actionType;
    performedBy;
    role;
    comment;
    createdAt;
    updatedAt;
    submission;
    user;
};
exports.VerificationLog = VerificationLog;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 36, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], VerificationLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'submission_id', type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], VerificationLog.prototype, "submissionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'action_type', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], VerificationLog.prototype, "actionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'performed_by', type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], VerificationLog.prototype, "performedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], VerificationLog.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], VerificationLog.prototype, "comment", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], VerificationLog.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], VerificationLog.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => submission_entity_1.Submission, (s) => s.logs),
    (0, typeorm_1.JoinColumn)({ name: 'submission_id' }),
    __metadata("design:type", submission_entity_1.Submission)
], VerificationLog.prototype, "submission", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'performed_by' }),
    __metadata("design:type", user_entity_1.User)
], VerificationLog.prototype, "user", void 0);
exports.VerificationLog = VerificationLog = __decorate([
    (0, typeorm_1.Entity)('verification_logs')
], VerificationLog);
//# sourceMappingURL=verification-log.entity.js.map