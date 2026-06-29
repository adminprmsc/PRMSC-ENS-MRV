"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const application_module_1 = require("../../application/services/application.module");
const jwt_strategy_1 = require("./jwt.strategy");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const min_role_guard_1 = require("./min-role.guard");
const tehsil_manager_guard_1 = require("./tehsil-manager.guard");
const tubewell_user_guard_1 = require("./tubewell-user.guard");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            application_module_1.ApplicationModule,
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: config.get('app.jwtSecretKey', 'jwt-dev-key'),
                    signOptions: { expiresIn: '24h' },
                }),
            }),
        ],
        providers: [
            jwt_strategy_1.JwtStrategy,
            jwt_auth_guard_1.JwtAuthGuard,
            min_role_guard_1.MinRoleGuard,
            tehsil_manager_guard_1.TehsilManagerGuard,
            tubewell_user_guard_1.TubewellUserGuard,
        ],
        exports: [
            jwt_1.JwtModule,
            jwt_auth_guard_1.JwtAuthGuard,
            min_role_guard_1.MinRoleGuard,
            tehsil_manager_guard_1.TehsilManagerGuard,
            tubewell_user_guard_1.TubewellUserGuard,
            application_module_1.ApplicationModule,
        ],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map