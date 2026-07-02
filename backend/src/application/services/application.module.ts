import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthService } from './auth.service';
import { DashboardService } from './dashboard.service';
import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';
import { OperatorHelpersService } from './operator-helpers.service';
import { PumpTimesService } from './pump-times.service';
import { RbacService } from './rbac.service';
import { StorageService } from './storage.service';
import { TehsilAccessService } from './tehsil-access.service';
import { TehsilManagerService } from './tehsil-manager.service';
import { TrainingService } from './training.service';
import { TubewellOperatorService } from './tubewell-operator.service';
import { UserService } from './user.service';
import { WaterMeterBackfillService } from './water-meter-backfill.service';
import { WaterMeterVolumeService } from './water-meter-volume.service';
import { WaterSubmissionDetailService } from './water-submission-detail.service';
import { WorkflowService } from './workflow.service';

const SERVICES = [
  AuthService,
  DashboardService,
  EmailService,
  NotificationsService,
  OperatorHelpersService,
  PumpTimesService,
  RbacService,
  StorageService,
  TehsilAccessService,
  TehsilManagerService,
  TrainingService,
  TubewellOperatorService,
  UserService,
  WaterMeterBackfillService,
  WaterMeterVolumeService,
  WaterSubmissionDetailService,
  WorkflowService,
];

@Module({
  imports: [DatabaseModule],
  providers: [...SERVICES],
  exports: [...SERVICES, DatabaseModule],
})
export class ApplicationModule {}
