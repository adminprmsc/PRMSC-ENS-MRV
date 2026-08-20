import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from '../../application/services/dashboard.service';

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

  @Get('program-summary')
  getProgramSummary(
    @Query('tehsil') tehsil?: string,
    @Query('tehsils') tehsils?: string,
    @Query('village') village?: string,
    @Query('settlement') settlement?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getProgramSummary(
      tehsil,
      village,
      this.parseOptionalInt(month),
      this.parseOptionalInt(year),
      settlement,
      tehsils,
    );
  }

  @Get('water-supplied')
  getWaterSupplied(
    @Query('tehsil') tehsil?: string,
    @Query('tehsils') tehsils?: string,
    @Query('village') village?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getWaterSupplied(
      tehsil,
      village,
      this.parseOptionalInt(month),
      this.parseOptionalInt(year),
      tehsils,
    );
  }

  @Get('pump-hours')
  getPumpHours(
    @Query('tehsil') tehsil?: string,
    @Query('tehsils') tehsils?: string,
    @Query('village') village?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getPumpHours(
      tehsil,
      village,
      this.parseOptionalInt(month),
      this.parseOptionalInt(year),
      tehsils,
    );
  }

  @Get('solar-generation')
  getSolarGeneration(
    @Query('tehsil') tehsil?: string,
    @Query('tehsils') tehsils?: string,
    @Query('village') village?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getSolarGeneration(
      tehsil,
      village,
      this.parseOptionalInt(month),
      this.parseOptionalInt(year),
      tehsils,
    );
  }

  @Get('grid-import')
  getGridImport(
    @Query('tehsil') tehsil?: string,
    @Query('tehsils') tehsils?: string,
    @Query('village') village?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getGridImport(
      tehsil,
      village,
      this.parseOptionalInt(month),
      this.parseOptionalInt(year),
      tehsils,
    );
  }

  @Get('water-systems-detail')
  getWaterSystemsDetail(
    @Query('tehsil') tehsil?: string,
    @Query('tehsils') tehsils?: string,
    @Query('village') village?: string,
    @Query('settlement') settlement?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getWaterSystemsDetail(
      tehsil,
      village,
      this.parseOptionalInt(month),
      this.parseOptionalInt(year),
      settlement,
      tehsils,
    );
  }

  @Get('solar-systems-detail')
  getSolarSystemsDetail(
    @Query('tehsil') tehsil?: string,
    @Query('tehsils') tehsils?: string,
    @Query('village') village?: string,
    @Query('settlement') settlement?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getSolarSystemsDetail(
      tehsil,
      village,
      this.parseOptionalInt(month),
      this.parseOptionalInt(year),
      settlement,
      tehsils,
    );
  }
}
