import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from '../../application/services/dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('program-summary')
  getProgramSummary(
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
  ) {
    return this.dashboardService.getProgramSummary(tehsil, village);
  }

  @Get('water-supplied')
  getWaterSupplied(
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getWaterSupplied(
      tehsil,
      village,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('pump-hours')
  getPumpHours(
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getPumpHours(
      tehsil,
      village,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('solar-generation')
  getSolarGeneration(
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getSolarGeneration(
      tehsil,
      village,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('grid-import')
  getGridImport(
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getGridImport(
      tehsil,
      village,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('water-systems-detail')
  getWaterSystemsDetail(
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getWaterSystemsDetail(
      tehsil,
      village,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('solar-systems-detail')
  getSolarSystemsDetail(
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.dashboardService.getSolarSystemsDetail(
      tehsil,
      village,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }
}
