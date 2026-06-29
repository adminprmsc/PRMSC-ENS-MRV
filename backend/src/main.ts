import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildCorsOptions } from './config/cors-options';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const corsOrigins = config.get<string[]>('app.corsOrigins', []);
  app.enableCors(buildCorsOptions(corsOrigins));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = parseInt(process.env.PORT ?? '5001', 10);
  await app.listen(port);
  console.info(
    `CORS allowlist: ${corsOrigins.length} origin(s) from CORS_ORIGINS`,
  );
}

bootstrap();
