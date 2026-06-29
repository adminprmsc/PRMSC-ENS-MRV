"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../infrastructure/database/database.module");
const auth_service_1 = require("./auth.service");
const dashboard_service_1 = require("./dashboard.service");
const email_service_1 = require("./email.service");
const notifications_service_1 = require("./notifications.service");
const operator_helpers_service_1 = require("./operator-helpers.service");
const pump_times_service_1 = require("./pump-times.service");
const rbac_service_1 = require("./rbac.service");
const storage_service_1 = require("./storage.service");
const tehsil_access_service_1 = require("./tehsil-access.service");
const tehsil_manager_service_1 = require("./tehsil-manager.service");
const tubewell_operator_service_1 = require("./tubewell-operator.service");
const user_service_1 = require("./user.service");
const water_meter_backfill_service_1 = require("./water-meter-backfill.service");
const water_meter_volume_service_1 = require("./water-meter-volume.service");
const water_submission_detail_service_1 = require("./water-submission-detail.service");
const workflow_service_1 = require("./workflow.service");
const SERVICES = [
    auth_service_1.AuthService,
    dashboard_service_1.DashboardService,
    email_service_1.EmailService,
    notifications_service_1.NotificationsService,
    operator_helpers_service_1.OperatorHelpersService,
    pump_times_service_1.PumpTimesService,
    rbac_service_1.RbacService,
    storage_service_1.StorageService,
    tehsil_access_service_1.TehsilAccessService,
    tehsil_manager_service_1.TehsilManagerService,
    tubewell_operator_service_1.TubewellOperatorService,
    user_service_1.UserService,
    water_meter_backfill_service_1.WaterMeterBackfillService,
    water_meter_volume_service_1.WaterMeterVolumeService,
    water_submission_detail_service_1.WaterSubmissionDetailService,
    workflow_service_1.WorkflowService,
];
let ApplicationModule = class ApplicationModule {
};
exports.ApplicationModule = ApplicationModule;
exports.ApplicationModule = ApplicationModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        providers: [...SERVICES],
        exports: [...SERVICES, database_module_1.DatabaseModule],
    })
], ApplicationModule);
//# sourceMappingURL=application.module.js.map