import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TubewellOperatorService } from '../../application/services/tubewell-operator.service';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { MinRoleGuard } from '../../infrastructure/auth/min-role.guard';
import { TubewellUserGuard } from '../../infrastructure/auth/tubewell-user.guard';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { MinRole } from '../../infrastructure/auth/decorators/min-role.decorator';

@Controller('api/operator')
@UseGuards(JwtAuthGuard)
export class TubewellOperatorController {
  constructor(
    private readonly tubewellOperatorService: TubewellOperatorService,
  ) {}

  @Get('notifications')
  getNotifications(@CurrentUser() userId: string) {
    return this.tubewellOperatorService.getNotifications(userId);
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  markAllNotificationsRead(@CurrentUser() userId: string) {
    return this.tubewellOperatorService.markAllNotificationsRead(userId);
  }

  @Post('notifications/:notificationId/read')
  @HttpCode(200)
  markNotificationRead(
    @CurrentUser() userId: string,
    @Param('notificationId') notificationId: string,
  ) {
    return this.tubewellOperatorService.markNotificationRead(
      userId,
      notificationId,
    );
  }

  @Post('submit')
  @HttpCode(201)
  submitDataForVerification(
    @CurrentUser() userId: string,
    @Body() body: { record_id?: string },
  ) {
    return this.tubewellOperatorService.submitDataForVerification(userId, body);
  }

  @Get('my-submissions')
  getMySubmissions(
    @CurrentUser() userId: string,
    @Query('status') status?: string,
  ) {
    return this.tubewellOperatorService.getMySubmissions(userId, status);
  }

  @Get('signature')
  @UseGuards(MinRoleGuard)
  @MinRole('USER')
  getOperatorSignature(@CurrentUser() userId: string) {
    return this.tubewellOperatorService.getOperatorSignature(userId);
  }

  @Put('signature')
  @UseGuards(MinRoleGuard)
  @MinRole('USER')
  putOperatorSignature(
    @CurrentUser() userId: string,
    @Body() body: { signature_svg?: unknown },
  ) {
    return this.tubewellOperatorService.putOperatorSignature(userId, body);
  }

  @Delete('signature')
  @UseGuards(MinRoleGuard)
  @MinRole('USER')
  deleteOperatorSignature(@CurrentUser() userId: string) {
    return this.tubewellOperatorService.deleteOperatorSignature(userId);
  }

  @Get('tubewell/submission/:submissionId')
  getTubewellWaterSubmissionDetail(
    @CurrentUser() userId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.tubewellOperatorService.getTubewellWaterSubmissionDetail(
      userId,
      submissionId,
    );
  }

  @Post('upload')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('record_type') recordType?: string,
    @Body('record_id') recordId?: string,
  ) {
    return this.tubewellOperatorService.uploadImage(
      userId,
      file,
      recordType ?? 'water',
      recordId,
    );
  }

  @Get('water-systems')
  @UseGuards(MinRoleGuard)
  @MinRole('USER')
  getWaterSystems(
    @CurrentUser() userId: string,
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
  ) {
    return this.tubewellOperatorService.getWaterSystems(
      userId,
      tehsil,
      village,
    );
  }

  @Get('water-system-config')
  @UseGuards(MinRoleGuard)
  @MinRole('USER')
  getWaterSystemConfig(
    @CurrentUser() userId: string,
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
    @Query('settlement') settlement?: string,
  ) {
    return this.tubewellOperatorService.getWaterSystemConfig(
      userId,
      tehsil,
      village,
      settlement ?? '',
    );
  }

  @Get('water-meter-context')
  @UseGuards(MinRoleGuard)
  @MinRole('USER')
  getWaterMeterContext(
    @CurrentUser() userId: string,
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
    @Query('settlement') settlement?: string,
    @Query('system_id') systemId?: string,
    @Query('exclude_record_id') excludeRecordId?: string,
    @Query('log_date') logDate?: string,
    @Query('pump_end_time') pumpEndTime?: string,
  ) {
    return this.tubewellOperatorService.getWaterMeterContext(userId, {
      tehsil,
      village,
      settlement,
      system_id: systemId,
      exclude_record_id: excludeRecordId,
      log_date: logDate,
      pump_end_time: pumpEndTime,
    });
  }

  @Get('water-data/drafts')
  @UseGuards(MinRoleGuard)
  @MinRole('USER')
  getWaterDrafts(@CurrentUser() userId: string) {
    return this.tubewellOperatorService.getWaterDrafts(userId);
  }

  @Get('water-data/draft/:recordId')
  getWaterDraft(
    @CurrentUser() userId: string,
    @Param('recordId') recordId: string,
  ) {
    return this.tubewellOperatorService.getWaterDraft(userId, recordId);
  }

  @Put('water-data/draft/:recordId')
  updateWaterDraft(
    @CurrentUser() userId: string,
    @Param('recordId') recordId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.tubewellOperatorService.updateWaterDraft(
      userId,
      recordId,
      body,
    );
  }

  @Post('water-data/draft/:recordId/submit')
  @HttpCode(200)
  submitWaterDraft(
    @CurrentUser() userId: string,
    @Param('recordId') recordId: string,
  ) {
    return this.tubewellOperatorService.submitWaterDraft(userId, recordId);
  }

  @Delete('water-data/draft/:recordId')
  deleteWaterDraft(
    @CurrentUser() userId: string,
    @Param('recordId') recordId: string,
  ) {
    return this.tubewellOperatorService.deleteWaterDraft(userId, recordId);
  }

  @Get('water-supply-data')
  @UseGuards(TubewellUserGuard)
  getWaterSupplyData(
    @CurrentUser() userId: string,
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
    @Query('settlement') settlement?: string,
    @Query('system_id') systemId?: string,
    @Query('year') year?: string,
  ) {
    return this.tubewellOperatorService.getWaterSupplyData(userId, {
      tehsil,
      village,
      settlement,
      system_id: systemId,
      year: year !== undefined ? Number(year) : undefined,
    });
  }

  @Post('water-supply-data')
  @HttpCode(201)
  @UseGuards(TubewellUserGuard)
  saveWaterSupplyData(
    @CurrentUser() userId: string,
    @Body()
    body: {
      data?: unknown;
      year?: unknown;
      status?: string;
      image_url?: string;
      image_path?: string;
    },
  ) {
    return this.tubewellOperatorService.saveWaterSupplyData(userId, body);
  }
}
