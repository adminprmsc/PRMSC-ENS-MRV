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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const dashboard_service_1 = require("../../application/services/dashboard.service");
let DashboardController = class DashboardController {
    dashboardService;
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
    }
    getProgramSummary(tehsil, village) {
        return this.dashboardService.getProgramSummary(tehsil, village);
    }
    getWaterSupplied(tehsil, village, month, year) {
        return this.dashboardService.getWaterSupplied(tehsil, village, month ? parseInt(month, 10) : undefined, year ? parseInt(year, 10) : undefined);
    }
    getPumpHours(tehsil, village, month, year) {
        return this.dashboardService.getPumpHours(tehsil, village, month ? parseInt(month, 10) : undefined, year ? parseInt(year, 10) : undefined);
    }
    getSolarGeneration(tehsil, village, month, year) {
        return this.dashboardService.getSolarGeneration(tehsil, village, month ? parseInt(month, 10) : undefined, year ? parseInt(year, 10) : undefined);
    }
    getGridImport(tehsil, village, month, year) {
        return this.dashboardService.getGridImport(tehsil, village, month ? parseInt(month, 10) : undefined, year ? parseInt(year, 10) : undefined);
    }
    getWaterSystemsDetail(tehsil, village, month, year) {
        return this.dashboardService.getWaterSystemsDetail(tehsil, village, month ? parseInt(month, 10) : undefined, year ? parseInt(year, 10) : undefined);
    }
    getSolarSystemsDetail(tehsil, village, month, year) {
        return this.dashboardService.getSolarSystemsDetail(tehsil, village, month ? parseInt(month, 10) : undefined, year ? parseInt(year, 10) : undefined);
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('program-summary'),
    __param(0, (0, common_1.Query)('tehsil')),
    __param(1, (0, common_1.Query)('village')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getProgramSummary", null);
__decorate([
    (0, common_1.Get)('water-supplied'),
    __param(0, (0, common_1.Query)('tehsil')),
    __param(1, (0, common_1.Query)('village')),
    __param(2, (0, common_1.Query)('month')),
    __param(3, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getWaterSupplied", null);
__decorate([
    (0, common_1.Get)('pump-hours'),
    __param(0, (0, common_1.Query)('tehsil')),
    __param(1, (0, common_1.Query)('village')),
    __param(2, (0, common_1.Query)('month')),
    __param(3, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getPumpHours", null);
__decorate([
    (0, common_1.Get)('solar-generation'),
    __param(0, (0, common_1.Query)('tehsil')),
    __param(1, (0, common_1.Query)('village')),
    __param(2, (0, common_1.Query)('month')),
    __param(3, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getSolarGeneration", null);
__decorate([
    (0, common_1.Get)('grid-import'),
    __param(0, (0, common_1.Query)('tehsil')),
    __param(1, (0, common_1.Query)('village')),
    __param(2, (0, common_1.Query)('month')),
    __param(3, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getGridImport", null);
__decorate([
    (0, common_1.Get)('water-systems-detail'),
    __param(0, (0, common_1.Query)('tehsil')),
    __param(1, (0, common_1.Query)('village')),
    __param(2, (0, common_1.Query)('month')),
    __param(3, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getWaterSystemsDetail", null);
__decorate([
    (0, common_1.Get)('solar-systems-detail'),
    __param(0, (0, common_1.Query)('tehsil')),
    __param(1, (0, common_1.Query)('village')),
    __param(2, (0, common_1.Query)('month')),
    __param(3, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getSolarSystemsDetail", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('api/dashboard'),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map