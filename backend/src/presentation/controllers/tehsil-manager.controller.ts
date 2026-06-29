import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { MinRoleGuard } from '../../infrastructure/auth/min-role.guard';
import { TehsilManagerGuard } from '../../infrastructure/auth/tehsil-manager.guard';
import { MinRole } from '../../infrastructure/auth/decorators/min-role.decorator';
import {
  JwtContext,
  ServiceResult,
  TehsilManagerService,
} from '../../application/services/tehsil-manager.service';
import { ADMIN } from '../../domain/constants/roles';

@Controller('api/operator')
export class TehsilManagerController {
  constructor(private readonly tehsilManagerService: TehsilManagerService) {}

  private jwtFromRequest(req: Request): JwtContext {
    const user = req.user as JwtContext;
    return user;
  }

  private async respond<T extends Record<string, unknown>>(
    result: ServiceResult<T> | Promise<ServiceResult<T>>,
  ) {
    const resolved = await result;
    if (resolved.statusCode >= 400) {
      throw new HttpException(resolved.body, resolved.statusCode);
    }
    return resolved.body;
  }

  @Get('water-anomalies')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getWaterAnomalies(
    @Req() req: Request,
    @Query()
    query: {
      days?: string;
      end_date?: string;
      tehsil?: string;
      village?: string;
    },
  ) {
    return this.respond(
      this.tehsilManagerService.getWaterAnomalies(
        this.jwtFromRequest(req),
        query,
      ),
    );
  }

  @Get('logging-compliance')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getLoggingCompliance(
    @Req() req: Request,
    @Query()
    query: {
      water_date?: string;
      solar_year?: string;
      solar_month?: string;
    },
  ) {
    return this.respond(
      this.tehsilManagerService.getLoggingCompliance(
        this.jwtFromRequest(req),
        query,
      ),
    );
  }

  @Get('logging-compliance/water-daily-range')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getWaterDailyLoggingRange(
    @Req() req: Request,
    @Query()
    query: { water_system_id?: string; date_from?: string; date_to?: string },
  ) {
    return this.respond(
      this.tehsilManagerService.getWaterDailyLoggingRange(
        this.jwtFromRequest(req),
        query,
      ),
    );
  }

  @Get('logging-compliance/solar-monthly-year')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getSolarMonthlyYearRange(
    @Req() req: Request,
    @Query() query: { solar_system_id?: string; year?: string },
  ) {
    return this.respond(
      this.tehsilManagerService.getSolarMonthlyYearRange(
        this.jwtFromRequest(req),
        query,
      ),
    );
  }

  @Get('water-operator-assignments')
  @UseGuards(JwtAuthGuard, TehsilManagerGuard)
  listWaterOperatorAssignments(@Req() req: Request) {
    return this.respond(
      this.tehsilManagerService.listWaterOperatorAssignments(
        this.jwtFromRequest(req),
      ),
    );
  }

  @Put('water-operator-assignments/:operatorId')
  @UseGuards(JwtAuthGuard, TehsilManagerGuard)
  replaceWaterOperatorAssignments(
    @Req() req: Request,
    @Param('operatorId') operatorId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.respond(
      this.tehsilManagerService.replaceWaterOperatorAssignments(
        this.jwtFromRequest(req),
        operatorId,
        body,
      ),
    );
  }

  @Get('tehsil-manager/submission/:submissionId')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getTehsilManagerWaterSubmissionDetail(
    @Req() req: Request,
    @Param('submissionId') submissionId: string,
  ) {
    return this.respond(
      this.tehsilManagerService.getTehsilManagerWaterSubmissionDetail(
        this.jwtFromRequest(req),
        submissionId,
      ),
    );
  }

  @Post('water-system')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  addWaterSystem(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.respond(
      this.tehsilManagerService.addWaterSystem(this.jwtFromRequest(req), body),
    );
  }

  @Post('solar-system')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  addSolarSystem(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.respond(
      this.tehsilManagerService.addSolarSystem(this.jwtFromRequest(req), body),
    );
  }

  @Post('solar-data')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  submitSolarData(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.respond(
      this.tehsilManagerService.submitSolarData(this.jwtFromRequest(req), body),
    );
  }

  @Put('water-system/:systemId')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  updateWaterSystem(
    @Req() req: Request,
    @Param('systemId') systemId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.respond(
      this.tehsilManagerService.updateWaterSystem(
        this.jwtFromRequest(req),
        systemId,
        body,
      ),
    );
  }

  @Get('water-system/:systemId')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getWaterSystem(@Req() req: Request, @Param('systemId') systemId: string) {
    return this.respond(
      this.tehsilManagerService.getWaterSystem(
        this.jwtFromRequest(req),
        systemId,
      ),
    );
  }

  @Get('water-system/:systemId/calibration-certificate')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getWaterSystemCalibrationCertificate(
    @Req() req: Request,
    @Param('systemId') systemId: string,
  ) {
    return this.respond(
      this.tehsilManagerService.getWaterSystemCalibrationCertificate(
        this.jwtFromRequest(req),
        systemId,
      ),
    );
  }

  @Put('water-system/:systemId/calibration-certificate')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  putWaterSystemCalibrationCertificate(
    @Req() req: Request,
    @Param('systemId') systemId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.respond(
      this.tehsilManagerService.putWaterSystemCalibrationCertificate(
        this.jwtFromRequest(req),
        systemId,
        body,
      ),
    );
  }

  @Get('water-system-calibration-certificates/active')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  listActiveWaterSystemCalibrationCertificates(@Req() req: Request) {
    return this.respond(
      this.tehsilManagerService.listActiveWaterSystemCalibrationCertificates(
        this.jwtFromRequest(req),
      ),
    );
  }

  @Delete('water-system/:systemId')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  deleteWaterSystem(@Req() req: Request, @Param('systemId') systemId: string) {
    return this.respond(
      this.tehsilManagerService.deleteWaterSystem(
        this.jwtFromRequest(req),
        systemId,
      ),
    );
  }

  @Get('solar-systems')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getSolarSystems(
    @Req() req: Request,
    @Query() query: { tehsil?: string; village?: string },
  ) {
    return this.respond(
      this.tehsilManagerService.getSolarSystems(
        this.jwtFromRequest(req),
        query,
      ),
    );
  }

  @Delete('solar-system/:systemId')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  deleteSolarSystem(@Req() req: Request, @Param('systemId') systemId: string) {
    return this.respond(
      this.tehsilManagerService.deleteSolarSystem(
        this.jwtFromRequest(req),
        systemId,
      ),
    );
  }

  @Get('solar-system/:systemId')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getSolarSystem(@Req() req: Request, @Param('systemId') systemId: string) {
    return this.respond(
      this.tehsilManagerService.getSolarSystem(
        this.jwtFromRequest(req),
        systemId,
      ),
    );
  }

  @Put('solar-system/:systemId')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  updateSolarSystem(
    @Req() req: Request,
    @Param('systemId') systemId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.respond(
      this.tehsilManagerService.updateSolarSystem(
        this.jwtFromRequest(req),
        systemId,
        body,
      ),
    );
  }

  @Get('solar-system-config')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getSolarSystemConfig(
    @Req() req: Request,
    @Query() query: { tehsil?: string; village?: string; settlement?: string },
  ) {
    return this.respond(
      this.tehsilManagerService.getSolarSystemConfig(
        this.jwtFromRequest(req),
        query,
      ),
    );
  }

  @Get('solar-supply-data')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getSolarSupplyData(
    @Req() req: Request,
    @Query()
    query: {
      tehsil?: string;
      village?: string;
      settlement?: string;
      year?: string;
    },
  ) {
    return this.respond(
      this.tehsilManagerService.getSolarSupplyData(
        this.jwtFromRequest(req),
        query,
      ),
    );
  }

  @Get('solar-supply-data/record/:recordId')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getSolarSupplyDataRecord(
    @Req() req: Request,
    @Param('recordId') recordId: string,
  ) {
    return this.respond(
      this.tehsilManagerService.getSolarSupplyDataRecord(
        this.jwtFromRequest(req),
        recordId,
      ),
    );
  }

  @Put('solar-supply-data/record/:recordId')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  updateSolarSupplyDataRecord(
    @Req() req: Request,
    @Param('recordId') recordId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.respond(
      this.tehsilManagerService.updateSolarSupplyDataRecord(
        this.jwtFromRequest(req),
        recordId,
        body,
      ),
    );
  }

  @Delete('solar-supply-data/record/:recordId')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  deleteSolarSupplyDataRecord(
    @Req() req: Request,
    @Param('recordId') recordId: string,
  ) {
    return this.respond(
      this.tehsilManagerService.deleteSolarSupplyDataRecord(
        this.jwtFromRequest(req),
        recordId,
      ),
    );
  }

  @Post('solar-supply-data')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  saveSolarSupplyData(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.respond(
      this.tehsilManagerService.saveSolarSupplyData(
        this.jwtFromRequest(req),
        body,
      ),
    );
  }

  @Get('verification/pending')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getPendingSubmissions(@Req() req: Request) {
    return this.respond(
      this.tehsilManagerService.getPendingSubmissions(this.jwtFromRequest(req)),
    );
  }

  @Post('verification/:submissionId/verify')
  @UseGuards(JwtAuthGuard)
  acceptSubmission(
    @Req() req: Request,
    @Param('submissionId') submissionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.respond(
      this.tehsilManagerService.acceptSubmission(
        this.jwtFromRequest(req),
        submissionId,
        body,
      ),
    );
  }

  @Post('verification/:submissionId/reject')
  @UseGuards(JwtAuthGuard)
  rejectSubmission(
    @Req() req: Request,
    @Param('submissionId') submissionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.respond(
      this.tehsilManagerService.rejectSubmission(
        this.jwtFromRequest(req),
        submissionId,
        body,
      ),
    );
  }

  @Post('verification/:submissionId/revert')
  @UseGuards(JwtAuthGuard)
  revertSubmission(
    @Req() req: Request,
    @Param('submissionId') submissionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.respond(
      this.tehsilManagerService.revertSubmission(
        this.jwtFromRequest(req),
        submissionId,
        body,
      ),
    );
  }

  @Get('verification/audit-logs')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getVerificationAuditLogs(
    @Req() req: Request,
    @Query()
    query: {
      submission_id?: string;
      action_type?: string;
      user_id?: string;
    },
  ) {
    return this.respond(
      this.tehsilManagerService.getVerificationAuditLogs(
        this.jwtFromRequest(req),
        query,
      ),
    );
  }

  @Get('verification/stats')
  @UseGuards(JwtAuthGuard, MinRoleGuard)
  @MinRole(ADMIN)
  getVerificationStats(@Req() req: Request) {
    return this.respond(
      this.tehsilManagerService.getVerificationStats(this.jwtFromRequest(req)),
    );
  }

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  getNotifications(@Req() req: Request) {
    return this.respond(
      this.tehsilManagerService.getNotifications(this.jwtFromRequest(req)),
    );
  }

  @Post('notifications/:notificationId/read')
  @UseGuards(JwtAuthGuard)
  markNotificationRead(
    @Req() req: Request,
    @Param('notificationId') notificationId: string,
  ) {
    return this.respond(
      this.tehsilManagerService.markNotificationRead(
        this.jwtFromRequest(req),
        notificationId,
      ),
    );
  }

  @Post('notifications/read-all')
  @UseGuards(JwtAuthGuard)
  markAllNotificationsRead(@Req() req: Request) {
    return this.respond(
      this.tehsilManagerService.markAllNotificationsRead(
        this.jwtFromRequest(req),
      ),
    );
  }
}
