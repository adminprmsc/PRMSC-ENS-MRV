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
exports.TehsilManagerController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../infrastructure/auth/jwt-auth.guard");
const min_role_guard_1 = require("../../infrastructure/auth/min-role.guard");
const tehsil_manager_guard_1 = require("../../infrastructure/auth/tehsil-manager.guard");
const min_role_decorator_1 = require("../../infrastructure/auth/decorators/min-role.decorator");
const tehsil_manager_service_1 = require("../../application/services/tehsil-manager.service");
const roles_1 = require("../../domain/constants/roles");
let TehsilManagerController = class TehsilManagerController {
    tehsilManagerService;
    constructor(tehsilManagerService) {
        this.tehsilManagerService = tehsilManagerService;
    }
    jwtFromRequest(req) {
        const user = req.user;
        return user;
    }
    async respond(result) {
        const resolved = await result;
        if (resolved.statusCode >= 400) {
            throw new common_1.HttpException(resolved.body, resolved.statusCode);
        }
        return resolved.body;
    }
    getWaterAnomalies(req, query) {
        return this.respond(this.tehsilManagerService.getWaterAnomalies(this.jwtFromRequest(req), query));
    }
    getLoggingCompliance(req, query) {
        return this.respond(this.tehsilManagerService.getLoggingCompliance(this.jwtFromRequest(req), query));
    }
    getWaterDailyLoggingRange(req, query) {
        return this.respond(this.tehsilManagerService.getWaterDailyLoggingRange(this.jwtFromRequest(req), query));
    }
    getSolarMonthlyYearRange(req, query) {
        return this.respond(this.tehsilManagerService.getSolarMonthlyYearRange(this.jwtFromRequest(req), query));
    }
    listWaterOperatorAssignments(req) {
        return this.respond(this.tehsilManagerService.listWaterOperatorAssignments(this.jwtFromRequest(req)));
    }
    replaceWaterOperatorAssignments(req, operatorId, body) {
        return this.respond(this.tehsilManagerService.replaceWaterOperatorAssignments(this.jwtFromRequest(req), operatorId, body));
    }
    getTehsilManagerWaterSubmissionDetail(req, submissionId) {
        return this.respond(this.tehsilManagerService.getTehsilManagerWaterSubmissionDetail(this.jwtFromRequest(req), submissionId));
    }
    addWaterSystem(req, body) {
        return this.respond(this.tehsilManagerService.addWaterSystem(this.jwtFromRequest(req), body));
    }
    addSolarSystem(req, body) {
        return this.respond(this.tehsilManagerService.addSolarSystem(this.jwtFromRequest(req), body));
    }
    submitSolarData(req, body) {
        return this.respond(this.tehsilManagerService.submitSolarData(this.jwtFromRequest(req), body));
    }
    updateWaterSystem(req, systemId, body) {
        return this.respond(this.tehsilManagerService.updateWaterSystem(this.jwtFromRequest(req), systemId, body));
    }
    getWaterSystem(req, systemId) {
        return this.respond(this.tehsilManagerService.getWaterSystem(this.jwtFromRequest(req), systemId));
    }
    getWaterSystemCalibrationCertificate(req, systemId) {
        return this.respond(this.tehsilManagerService.getWaterSystemCalibrationCertificate(this.jwtFromRequest(req), systemId));
    }
    putWaterSystemCalibrationCertificate(req, systemId, body) {
        return this.respond(this.tehsilManagerService.putWaterSystemCalibrationCertificate(this.jwtFromRequest(req), systemId, body));
    }
    listActiveWaterSystemCalibrationCertificates(req) {
        return this.respond(this.tehsilManagerService.listActiveWaterSystemCalibrationCertificates(this.jwtFromRequest(req)));
    }
    deleteWaterSystem(req, systemId) {
        return this.respond(this.tehsilManagerService.deleteWaterSystem(this.jwtFromRequest(req), systemId));
    }
    getSolarSystems(req, query) {
        return this.respond(this.tehsilManagerService.getSolarSystems(this.jwtFromRequest(req), query));
    }
    deleteSolarSystem(req, systemId) {
        return this.respond(this.tehsilManagerService.deleteSolarSystem(this.jwtFromRequest(req), systemId));
    }
    getSolarSystem(req, systemId) {
        return this.respond(this.tehsilManagerService.getSolarSystem(this.jwtFromRequest(req), systemId));
    }
    updateSolarSystem(req, systemId, body) {
        return this.respond(this.tehsilManagerService.updateSolarSystem(this.jwtFromRequest(req), systemId, body));
    }
    getSolarSystemConfig(req, query) {
        return this.respond(this.tehsilManagerService.getSolarSystemConfig(this.jwtFromRequest(req), query));
    }
    getSolarSupplyData(req, query) {
        return this.respond(this.tehsilManagerService.getSolarSupplyData(this.jwtFromRequest(req), query));
    }
    getSolarSupplyDataRecord(req, recordId) {
        return this.respond(this.tehsilManagerService.getSolarSupplyDataRecord(this.jwtFromRequest(req), recordId));
    }
    updateSolarSupplyDataRecord(req, recordId, body) {
        return this.respond(this.tehsilManagerService.updateSolarSupplyDataRecord(this.jwtFromRequest(req), recordId, body));
    }
    deleteSolarSupplyDataRecord(req, recordId) {
        return this.respond(this.tehsilManagerService.deleteSolarSupplyDataRecord(this.jwtFromRequest(req), recordId));
    }
    saveSolarSupplyData(req, body) {
        return this.respond(this.tehsilManagerService.saveSolarSupplyData(this.jwtFromRequest(req), body));
    }
    getPendingSubmissions(req) {
        return this.respond(this.tehsilManagerService.getPendingSubmissions(this.jwtFromRequest(req)));
    }
    acceptSubmission(req, submissionId, body) {
        return this.respond(this.tehsilManagerService.acceptSubmission(this.jwtFromRequest(req), submissionId, body));
    }
    rejectSubmission(req, submissionId, body) {
        return this.respond(this.tehsilManagerService.rejectSubmission(this.jwtFromRequest(req), submissionId, body));
    }
    revertSubmission(req, submissionId, body) {
        return this.respond(this.tehsilManagerService.revertSubmission(this.jwtFromRequest(req), submissionId, body));
    }
    getVerificationAuditLogs(req, query) {
        return this.respond(this.tehsilManagerService.getVerificationAuditLogs(this.jwtFromRequest(req), query));
    }
    getVerificationStats(req) {
        return this.respond(this.tehsilManagerService.getVerificationStats(this.jwtFromRequest(req)));
    }
    getNotifications(req) {
        return this.respond(this.tehsilManagerService.getNotifications(this.jwtFromRequest(req)));
    }
    markNotificationRead(req, notificationId) {
        return this.respond(this.tehsilManagerService.markNotificationRead(this.jwtFromRequest(req), notificationId));
    }
    markAllNotificationsRead(req) {
        return this.respond(this.tehsilManagerService.markAllNotificationsRead(this.jwtFromRequest(req)));
    }
};
exports.TehsilManagerController = TehsilManagerController;
__decorate([
    (0, common_1.Get)('water-anomalies'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getWaterAnomalies", null);
__decorate([
    (0, common_1.Get)('logging-compliance'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getLoggingCompliance", null);
__decorate([
    (0, common_1.Get)('logging-compliance/water-daily-range'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getWaterDailyLoggingRange", null);
__decorate([
    (0, common_1.Get)('logging-compliance/solar-monthly-year'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getSolarMonthlyYearRange", null);
__decorate([
    (0, common_1.Get)('water-operator-assignments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tehsil_manager_guard_1.TehsilManagerGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "listWaterOperatorAssignments", null);
__decorate([
    (0, common_1.Put)('water-operator-assignments/:operatorId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tehsil_manager_guard_1.TehsilManagerGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('operatorId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "replaceWaterOperatorAssignments", null);
__decorate([
    (0, common_1.Get)('tehsil-manager/submission/:submissionId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('submissionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getTehsilManagerWaterSubmissionDetail", null);
__decorate([
    (0, common_1.Post)('water-system'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "addWaterSystem", null);
__decorate([
    (0, common_1.Post)('solar-system'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "addSolarSystem", null);
__decorate([
    (0, common_1.Post)('solar-data'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "submitSolarData", null);
__decorate([
    (0, common_1.Put)('water-system/:systemId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('systemId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "updateWaterSystem", null);
__decorate([
    (0, common_1.Get)('water-system/:systemId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('systemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getWaterSystem", null);
__decorate([
    (0, common_1.Get)('water-system/:systemId/calibration-certificate'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('systemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getWaterSystemCalibrationCertificate", null);
__decorate([
    (0, common_1.Put)('water-system/:systemId/calibration-certificate'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('systemId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "putWaterSystemCalibrationCertificate", null);
__decorate([
    (0, common_1.Get)('water-system-calibration-certificates/active'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "listActiveWaterSystemCalibrationCertificates", null);
__decorate([
    (0, common_1.Delete)('water-system/:systemId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('systemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "deleteWaterSystem", null);
__decorate([
    (0, common_1.Get)('solar-systems'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getSolarSystems", null);
__decorate([
    (0, common_1.Delete)('solar-system/:systemId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('systemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "deleteSolarSystem", null);
__decorate([
    (0, common_1.Get)('solar-system/:systemId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('systemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getSolarSystem", null);
__decorate([
    (0, common_1.Put)('solar-system/:systemId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('systemId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "updateSolarSystem", null);
__decorate([
    (0, common_1.Get)('solar-system-config'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getSolarSystemConfig", null);
__decorate([
    (0, common_1.Get)('solar-supply-data'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getSolarSupplyData", null);
__decorate([
    (0, common_1.Get)('solar-supply-data/record/:recordId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('recordId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getSolarSupplyDataRecord", null);
__decorate([
    (0, common_1.Put)('solar-supply-data/record/:recordId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('recordId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "updateSolarSupplyDataRecord", null);
__decorate([
    (0, common_1.Delete)('solar-supply-data/record/:recordId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('recordId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "deleteSolarSupplyDataRecord", null);
__decorate([
    (0, common_1.Post)('solar-supply-data'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "saveSolarSupplyData", null);
__decorate([
    (0, common_1.Get)('verification/pending'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getPendingSubmissions", null);
__decorate([
    (0, common_1.Post)('verification/:submissionId/verify'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('submissionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "acceptSubmission", null);
__decorate([
    (0, common_1.Post)('verification/:submissionId/reject'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('submissionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "rejectSubmission", null);
__decorate([
    (0, common_1.Post)('verification/:submissionId/revert'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('submissionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "revertSubmission", null);
__decorate([
    (0, common_1.Get)('verification/audit-logs'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getVerificationAuditLogs", null);
__decorate([
    (0, common_1.Get)('verification/stats'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, min_role_guard_1.MinRoleGuard),
    (0, min_role_decorator_1.MinRole)(roles_1.ADMIN),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getVerificationStats", null);
__decorate([
    (0, common_1.Get)('notifications'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "getNotifications", null);
__decorate([
    (0, common_1.Post)('notifications/:notificationId/read'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('notificationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "markNotificationRead", null);
__decorate([
    (0, common_1.Post)('notifications/read-all'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TehsilManagerController.prototype, "markAllNotificationsRead", null);
exports.TehsilManagerController = TehsilManagerController = __decorate([
    (0, common_1.Controller)('api/operator'),
    __metadata("design:paramtypes", [tehsil_manager_service_1.TehsilManagerService])
], TehsilManagerController);
//# sourceMappingURL=tehsil-manager.controller.js.map