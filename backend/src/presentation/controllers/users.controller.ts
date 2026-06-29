import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SUPER_ADMIN } from '../../domain/constants/roles';
import { UserService } from '../../application/services/user.service';
import { TehsilAccessDenied } from '../../application/services/tehsil-access.service';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { MinRoleGuard } from '../../infrastructure/auth/min-role.guard';
import { MinRole } from '../../infrastructure/auth/decorators/min-role.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { OnboardOperatorDto } from '../dto/auth.dto';
import { ADMIN } from '../../domain/constants/roles';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(MinRoleGuard)
  @MinRole(SUPER_ADMIN)
  async listUsers() {
    const users = await this.userService.getAllUsers();
    return {
      users: await Promise.all(
        users.map(async (user) => ({
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          tehsils: await this.userService.getAssignedTehsils(user),
          water_system_ids: user.assignedWaterSystemIds,
          created_at: user.createdAt?.toISOString() ?? null,
        })),
      ),
    };
  }

  @Post('onboard-operator')
  @UseGuards(MinRoleGuard)
  @MinRole(ADMIN)
  @HttpCode(201)
  async onboardOperator(
    @CurrentUser() actorId: string,
    @Body() body: OnboardOperatorDto,
  ) {
    const actor = await this.userService.getUserById(actorId);
    if (!actor) {
      throw new NotFoundException({ message: 'User not found' });
    }

    try {
      const user = await this.userService.createTubewellOperator(
        body.name,
        body.email,
        body.password,
        body.water_system_ids,
        actor,
      );
      return {
        message: 'Tubewell operator created',
        user: {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          tehsils: await this.userService.getAssignedTehsils(user),
          water_system_ids: user.assignedWaterSystemIds,
        },
      };
    } catch (err) {
      if (err instanceof TehsilAccessDenied) {
        throw new ForbiddenException({ message: err.message });
      }
      throw new BadRequestException({
        message: err instanceof Error ? err.message : 'Onboarding failed',
      });
    }
  }
}
