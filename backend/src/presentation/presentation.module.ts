import { Module } from '@nestjs/common';
import { ApplicationModule } from '../application/services/application.module';
import { AuthModule } from '../infrastructure/auth/auth.module';
import { AuthController } from './controllers/auth.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { GeographyController } from './controllers/geography.controller';
import { HealthController } from './controllers/health.controller';
import { LocationsController } from './controllers/locations.controller';
import { ManagerOperationsController } from './controllers/manager-operations.controller';
import { ReleaseNotesController } from './controllers/release-notes.controller';
import { TehsilManagerController } from './controllers/tehsil-manager.controller';
import { TrainingController } from './controllers/training.controller';
import { TubewellOperatorController } from './controllers/tubewell-operator.controller';
import { UsersController } from './controllers/users.controller';

@Module({
  imports: [ApplicationModule, AuthModule],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    LocationsController,
    GeographyController,
    ReleaseNotesController,
    DashboardController,
    ManagerOperationsController,
    TehsilManagerController,
    TrainingController,
    TubewellOperatorController,
  ],
})
export class PresentationModule {}
