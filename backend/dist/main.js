"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const cors_options_1 = require("./config/cors-options");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    const corsOrigins = config.get('app.corsOrigins', []);
    app.enableCors((0, cors_options_1.buildCorsOptions)(corsOrigins));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
    }));
    const port = parseInt(process.env.PORT ?? '5001', 10);
    await app.listen(port);
    console.info(`CORS allowlist: ${corsOrigins.length} origin(s) from CORS_ORIGINS`);
}
bootstrap();
//# sourceMappingURL=main.js.map