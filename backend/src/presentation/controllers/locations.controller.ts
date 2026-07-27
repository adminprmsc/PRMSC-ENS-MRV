import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LocationsService } from '../../application/services/locations.service';
import { SYSTEM_ADMIN } from '../../domain/constants/roles';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { MinRoleGuard } from '../../infrastructure/auth/min-role.guard';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { MinRole } from '../../infrastructure/auth/decorators/min-role.decorator';

@Controller('api/locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /** Full catalog for registration forms / filters (any authenticated portal user). */
  @Get('catalog')
  getCatalog(@Query('tehsil') tehsil?: string) {
    return this.locationsService.getCatalog({ tehsil });
  }

  @Get('villages')
  @UseGuards(MinRoleGuard)
  @MinRole(SYSTEM_ADMIN)
  listVillages(
    @Query('tehsil') tehsil?: string,
    @Query('custom_only') customOnly?: string,
  ) {
    return this.locationsService.listVillages({
      tehsil,
      customOnly: customOnly === '1' || customOnly === 'true',
      includeInactive: false,
    });
  }

  @Get('settlements')
  @UseGuards(MinRoleGuard)
  @MinRole(SYSTEM_ADMIN)
  listSettlements(
    @Query('tehsil') tehsil?: string,
    @Query('village') village?: string,
    @Query('custom_only') customOnly?: string,
  ) {
    return this.locationsService.listSettlements({
      tehsil,
      village,
      customOnly: customOnly === '1' || customOnly === 'true',
      includeInactive: false,
    });
  }

  @Post('villages')
  @UseGuards(MinRoleGuard)
  @MinRole(SYSTEM_ADMIN)
  addVillage(
    @CurrentUser() userId: string,
    @Body() body: { tehsil?: string; name?: string },
  ) {
    return this.locationsService.addVillage(userId, body);
  }

  @Post('settlements')
  @UseGuards(MinRoleGuard)
  @MinRole(SYSTEM_ADMIN)
  addSettlement(
    @CurrentUser() userId: string,
    @Body() body: { tehsil?: string; village?: string; name?: string },
  ) {
    return this.locationsService.addSettlement(userId, body);
  }

  @Delete('villages/:id')
  @HttpCode(200)
  @UseGuards(MinRoleGuard)
  @MinRole(SYSTEM_ADMIN)
  deactivateVillage(@Param('id') id: string) {
    return this.locationsService.deactivateVillage(id);
  }

  @Delete('settlements/:id')
  @HttpCode(200)
  @UseGuards(MinRoleGuard)
  @MinRole(SYSTEM_ADMIN)
  deactivateSettlement(@Param('id') id: string) {
    return this.locationsService.deactivateSettlement(id);
  }
}
