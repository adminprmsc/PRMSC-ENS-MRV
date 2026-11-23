import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GeographyService } from '../../application/services/geography.service';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';

/**
 * Geography & population — Tehsil Managers, Manager Operations and the
 * platform admin, each limited to their own tehsils (enforced in the service
 * from the DB-loaded user, not the JWT).
 */
@Controller('api/geography')
@UseGuards(JwtAuthGuard)
export class GeographyController {
  constructor(private readonly geography: GeographyService) {}

  @Get()
  getGeography(
    @CurrentUser() userId: string,
    @Query('tehsil') tehsil?: string,
  ) {
    return this.geography.getGeography(userId, tehsil);
  }

  @Get('summary')
  getSummary(
    @CurrentUser() userId: string,
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
  ) {
    return this.geography.getSummary(userId, tehsil, village);
  }

  @Get('coverage')
  getCoverage(
    @CurrentUser() userId: string,
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
  ) {
    return this.geography.getCoverage(userId, tehsil, village);
  }

  @Get('history')
  getHistory(
    @CurrentUser() userId: string,
    @Query('tehsil') tehsil?: string,
    @Query('limit') limit?: string,
  ) {
    return this.geography.getHistory(userId, tehsil, limit);
  }

  @Patch('population')
  @HttpCode(200)
  updatePopulation(@CurrentUser() userId: string, @Body() body: unknown) {
    return this.geography.updatePopulation(userId, body);
  }
}
