import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from '../../application/services/dashboard.service';
import {
  DashboardPeriod,
  resolveDashboardPeriod,
} from '../../domain/utils/dashboard-period.util';

/**
 * Period query params shared by every dashboard endpoint.
 * `date_from` / `date_to` (inclusive YYYY-MM-DD) take precedence over
 * `year` / `month` when supplied.
 */
type PeriodQuery = {
  month?: string;
  year?: string;
  date_from?: string;
  date_to?: string;
};

type ScopeQuery = PeriodQuery & {
  tehsil?: string;
  tehsils?: string;
  village?: string;
  settlement?: string;
};

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  private parseOptionalInt(raw?: string): number | undefined {
    if (raw == null) return undefined;
    const trimmed = String(raw).trim();
    if (!trimmed) return undefined;
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : undefined;
  }

  private period(q: PeriodQuery): DashboardPeriod {
    return resolveDashboardPeriod({
      year: this.parseOptionalInt(q.year),
      month: this.parseOptionalInt(q.month),
      dateFrom: q.date_from,
      dateTo: q.date_to,
    });
  }

  @Get('program-summary')
  getProgramSummary(@Query() q: ScopeQuery) {
    return this.dashboardService.getProgramSummary(
      q.tehsil,
      q.village,
      this.period(q),
      q.settlement,
      q.tehsils,
    );
  }

  @Get('water-supplied')
  getWaterSupplied(@Query() q: ScopeQuery) {
    return this.dashboardService.getWaterSupplied(
      q.tehsil,
      q.village,
      this.period(q),
      q.tehsils,
    );
  }

  @Get('pump-hours')
  getPumpHours(@Query() q: ScopeQuery) {
    return this.dashboardService.getPumpHours(
      q.tehsil,
      q.village,
      this.period(q),
      q.tehsils,
    );
  }

  @Get('solar-generation')
  getSolarGeneration(@Query() q: ScopeQuery) {
    return this.dashboardService.getSolarGeneration(
      q.tehsil,
      q.village,
      this.period(q),
      q.tehsils,
    );
  }

  @Get('grid-import')
  getGridImport(@Query() q: ScopeQuery) {
    return this.dashboardService.getGridImport(
      q.tehsil,
      q.village,
      this.period(q),
      q.tehsils,
    );
  }

  @Get('water-systems-detail')
  getWaterSystemsDetail(@Query() q: ScopeQuery) {
    return this.dashboardService.getWaterSystemsDetail(
      q.tehsil,
      q.village,
      this.period(q),
      q.settlement,
      q.tehsils,
    );
  }

  @Get('solar-systems-detail')
  getSolarSystemsDetail(@Query() q: ScopeQuery) {
    return this.dashboardService.getSolarSystemsDetail(
      q.tehsil,
      q.village,
      this.period(q),
      q.settlement,
      q.tehsils,
    );
  }
}
