import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { MinRoleGuard } from '../../infrastructure/auth/min-role.guard';
import { MinRole } from '../../infrastructure/auth/decorators/min-role.decorator';
import { ADMIN, SUPER_ADMIN } from '../../domain/constants/roles';
import {
  EntryModerationService,
  ModerationJwt,
  ModerationResult,
} from '../../application/services/entry-moderation.service';

/**
 * Manager Operations overrides on already-approved data entries.
 * Mutations are SUPER_ADMIN only (re-checked against the DB in the service);
 * the change history is readable by tehsil managers for their own tehsils too.
 */
@Controller('api/operator/manager-ops')
@UseGuards(JwtAuthGuard, MinRoleGuard)
export class ManagerOperationsController {
  constructor(private readonly moderation: EntryModerationService) {}

  private jwt(req: Request): ModerationJwt {
    return req.user as ModerationJwt;
  }

  private async respond(result: Promise<ModerationResult>) {
    const r = await result;
    if (r.statusCode >= 400) throw new HttpException(r.body, r.statusCode);
    return r.body;
  }

  @Post('water-logs/:recordId/reject')
  @HttpCode(200)
  @MinRole(SUPER_ADMIN)
  rejectWaterLog(
    @Req() req: Request,
    @Param('recordId') recordId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.respond(
      this.moderation.rejectWaterLog(this.jwt(req), recordId, body),
    );
  }

  @Post('water-logs/:recordId/delete')
  @HttpCode(200)
  @MinRole(SUPER_ADMIN)
  deleteWaterLog(
    @Req() req: Request,
    @Param('recordId') recordId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.respond(
      this.moderation.deleteWaterLog(this.jwt(req), recordId, body),
    );
  }

  @Post('solar-logs/:recordId/delete')
  @HttpCode(200)
  @MinRole(SUPER_ADMIN)
  deleteSolarLog(
    @Req() req: Request,
    @Param('recordId') recordId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.respond(
      this.moderation.deleteSolarLog(this.jwt(req), recordId, body),
    );
  }

  @Get('change-logs')
  @MinRole(ADMIN)
  listChangeLogs(
    @Req() req: Request,
    @Query()
    query: {
      entry_type?: string;
      action?: string;
      entry_id?: string;
      tehsil?: string;
      date_from?: string;
      date_to?: string;
      limit?: string;
    },
  ) {
    return this.respond(this.moderation.listChangeLogs(this.jwt(req), query));
  }
}
