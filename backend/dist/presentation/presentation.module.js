"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresentationModule = void 0;
const common_1 = require("@nestjs/common");
const application_module_1 = require("../application/services/application.module");
const auth_module_1 = require("../infrastructure/auth/auth.module");
const auth_controller_1 = require("./controllers/auth.controller");
const dashboard_controller_1 = require("./controllers/dashboard.controller");
const health_controller_1 = require("./controllers/health.controller");
const tehsil_manager_controller_1 = require("./controllers/tehsil-manager.controller");
const tubewell_operator_controller_1 = require("./controllers/tubewell-operator.controller");
const users_controller_1 = require("./controllers/users.controller");
let PresentationModule = class PresentationModule {
};
exports.PresentationModule = PresentationModule;
exports.PresentationModule = PresentationModule = __decorate([
    (0, common_1.Module)({
        imports: [application_module_1.ApplicationModule, auth_module_1.AuthModule],
        controllers: [
            health_controller_1.HealthController,
            auth_controller_1.AuthController,
            users_controller_1.UsersController,
            dashboard_controller_1.DashboardController,
            tehsil_manager_controller_1.TehsilManagerController,
            tubewell_operator_controller_1.TubewellOperatorController,
        ],
    })
], PresentationModule);
//# sourceMappingURL=presentation.module.js.map