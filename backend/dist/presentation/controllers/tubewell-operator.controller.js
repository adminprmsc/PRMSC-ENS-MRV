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
exports.TubewellOperatorController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const tubewell_operator_service_1 = require("../../application/services/tubewell-operator.service");
const jwt_auth_guard_1 = require("../../infrastructure/auth/jwt-auth.guard");
const min_role_guard_1 = require("../../infrastructure/auth/min-role.guard");
const tubewell_user_guard_1 = require("../../infrastructure/auth/tubewell-user.guard");
const current_user_decorator_1 = require("../../infrastructure/auth/decorators/current-user.decorator");
const min_role_decorator_1 = require("../../infrastructure/auth/decorators/min-role.decorator");
let TubewellOperatorController = class TubewellOperatorController {
    tubewellOperatorService;
    constructor(tubewellOperatorService) {
        this.tubewellOperatorService = tubewellOperatorService;
    }
    getNotifications(userId) {
        return this.tubewellOperatorService.getNotifications(userId);
    }
    markAllNotificationsRead(userId) {
        return this.tubewellOperatorService.markAllNotificationsRead(userId);
    }
    markNotificationRead(userId, notificationId) {
        return this.tubewellOperatorService.markNotificationRead(userId, notificationId);
    }
    submitDataForVerification(userId, body) {
        return this.tubewellOperatorService.submitDataForVerification(userId, body);
    }
    getMySubmissions(userId, status) {
        return this.tubewellOperatorService.getMySubmissions(userId, status);
    }
    getOperatorSignature(userId) {
        return this.tubewellOperatorService.getOperatorSignature(userId);
    }
    putOperatorSignature(userId, body) {
        return this.tubewellOperatorService.putOperatorSignature(userId, body);
    }
    deleteOperatorSignature(userId) {
        return this.tubewellOperatorService.deleteOperatorSignature(userId);
    }
    getTubewellWaterSubmissionDetail(userId, submissionId) {
        return this.tubewellOperatorService.getTubewellWaterSubmissionDetail(userId, submissionId);
    }
    uploadImage(userId, file, recordType, recordId) {
        return this.tubewellOperatorService.uploadImage(userId, file, recordType ?? 'water', recordId);
    }
    getWaterSystems(userId, tehsil, village) {
        return this.tubewellOperatorService.getWaterSystems(userId, tehsil, village);
    }
    getWaterSystemConfig(userId, tehsil, village, settlement) {
        return this.tubewellOperatorService.getWaterSystemConfig(userId, tehsil, village, settlement ?? '');
    }
    getWaterMeterContext(userId, tehsil, village, settlement, systemId, excludeRecordId, logDate, pumpEndTime) {
        return this.tubewellOperatorService.getWaterMeterContext(userId, {
            tehsil,
            village,
            settlement,
            system_id: systemId,
            exclude_record_id: excludeRecordId,
            log_date: logDate,
            pump_end_time: pumpEndTime,
        });
    }
    getWaterDrafts(userId) {
        return this.tubewellOperatorService.getWaterDrafts(userId);
    }
    getWaterDraft(userId, recordId) {
        return this.tubewellOperatorService.getWaterDraft(userId, recordId);
    }
    updateWaterDraft(userId, recordId, body) {
        return this.tubewellOperatorService.updateWaterDraft(userId, recordId, body);
    }
    submitWaterDraft(userId, recordId) {
        return this.tubewellOperatorService.submitWaterDraft(userId, recordId);
    }
    deleteWaterDraft(userId, recordId) {
        return this.tubewellOperatorService.deleteWaterDraft(userId, recordId);
    }
    getWaterSupplyData(userId, tehsil, village, settlement, systemId, year) {
        return this.tubewellOperatorService.getWaterSupplyData(userId, {
            tehsil,
            village,
            settlement,
            system_id: systemId,
            year: year !== undefined ? Number(year) : undefined,
        });
    }
    saveWaterSupplyData(userId, body) {
        return this.tubewellOperatorService.saveWaterSupplyData(userId, body);
    }
};
exports.TubewellOperatorController = TubewellOperatorController;
__decorate([
    (0, common_1.Get)('notifications'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "getNotifications", null);
__decorate([
    (0, common_1.Post)('notifications/read-all'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "markAllNotificationsRead", null);
__decorate([
    (0, common_1.Post)('notifications/:notificationId/read'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('notificationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "markNotificationRead", null);
__decorate([
    (0, common_1.Post)('submit'),
    (0, common_1.HttpCode)(201),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "submitDataForVerification", null);
__decorate([
    (0, common_1.Get)('my-submissions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "getMySubmissions", null);
__decorate([
    (0, common_1.Get)('signature'),
    (0, common_1.UseGuards)(min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)('USER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "getOperatorSignature", null);
__decorate([
    (0, common_1.Put)('signature'),
    (0, common_1.UseGuards)(min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)('USER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "putOperatorSignature", null);
__decorate([
    (0, common_1.Delete)('signature'),
    (0, common_1.UseGuards)(min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)('USER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "deleteOperatorSignature", null);
__decorate([
    (0, common_1.Get)('tubewell/submission/:submissionId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('submissionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "getTubewellWaterSubmissionDetail", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.HttpCode)(201),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)('record_type')),
    __param(3, (0, common_1.Body)('record_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "uploadImage", null);
__decorate([
    (0, common_1.Get)('water-systems'),
    (0, common_1.UseGuards)(min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)('USER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('tehsil')),
    __param(2, (0, common_1.Query)('village')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "getWaterSystems", null);
__decorate([
    (0, common_1.Get)('water-system-config'),
    (0, common_1.UseGuards)(min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)('USER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('tehsil')),
    __param(2, (0, common_1.Query)('village')),
    __param(3, (0, common_1.Query)('settlement')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "getWaterSystemConfig", null);
__decorate([
    (0, common_1.Get)('water-meter-context'),
    (0, common_1.UseGuards)(min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)('USER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('tehsil')),
    __param(2, (0, common_1.Query)('village')),
    __param(3, (0, common_1.Query)('settlement')),
    __param(4, (0, common_1.Query)('system_id')),
    __param(5, (0, common_1.Query)('exclude_record_id')),
    __param(6, (0, common_1.Query)('log_date')),
    __param(7, (0, common_1.Query)('pump_end_time')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "getWaterMeterContext", null);
__decorate([
    (0, common_1.Get)('water-data/drafts'),
    (0, common_1.UseGuards)(min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)('USER'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "getWaterDrafts", null);
__decorate([
    (0, common_1.Get)('water-data/draft/:recordId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('recordId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "getWaterDraft", null);
__decorate([
    (0, common_1.Put)('water-data/draft/:recordId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('recordId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "updateWaterDraft", null);
__decorate([
    (0, common_1.Post)('water-data/draft/:recordId/submit'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('recordId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "submitWaterDraft", null);
__decorate([
    (0, common_1.Delete)('water-data/draft/:recordId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('recordId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "deleteWaterDraft", null);
__decorate([
    (0, common_1.Get)('water-supply-data'),
    (0, common_1.UseGuards)(tubewell_user_guard_1.TubewellUserGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('tehsil')),
    __param(2, (0, common_1.Query)('village')),
    __param(3, (0, common_1.Query)('settlement')),
    __param(4, (0, common_1.Query)('system_id')),
    __param(5, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "getWaterSupplyData", null);
__decorate([
    (0, common_1.Post)('water-supply-data'),
    (0, common_1.HttpCode)(201),
    (0, common_1.UseGuards)(tubewell_user_guard_1.TubewellUserGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TubewellOperatorController.prototype, "saveWaterSupplyData", null);
exports.TubewellOperatorController = TubewellOperatorController = __decorate([
    (0, common_1.Controller)('api/operator'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [tubewell_operator_service_1.TubewellOperatorService])
], TubewellOperatorController);
//# sourceMappingURL=tubewell-operator.controller.js.map