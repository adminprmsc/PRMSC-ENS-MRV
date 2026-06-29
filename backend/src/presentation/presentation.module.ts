import { Module } from '@nestjs/common';
import { ApplicationModule } from '../application/services/application.module';
import { AuthModule } from '../infrastructure/auth/auth.module';
import { AuthController } from './controllers/auth.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { HealthController } from './controllers/health.controller';
import { TehsilManagerController } from './controllers/tehsil-manager.controller';
import { TubewellOperatorController } from './controllers/tubewell-operator.controller';
import { UsersController } from './controllers/users.controller';

@Module({
  imports: [ApplicationModule, AuthModule],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    DashboardController,
    TehsilManagerController,
    TubewellOperatorController,
  ],
})
export class PresentationModule {}
