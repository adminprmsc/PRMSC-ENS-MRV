import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ADMIN, SYSTEM_ADMIN } from '../../domain/constants/roles';
import { UserService } from '../../application/services/user.service';
import { TehsilAccessDenied } from '../../application/services/tehsil-access.service';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { MinRoleGuard } from '../../infrastructure/auth/min-role.guard';
import { MinRole } from '../../infrastructure/auth/decorators/min-role.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { OnboardOperatorDto } from '../dto/auth.dto';
import {
  AdminResetPasswordDto,
  CreatePortalUserDto,
  UpdatePortalUserDto,
} from '../dto/users.dto';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Get('water-systems')
  @UseGuards(MinRoleGuard)
  @MinRole(SYSTEM_ADMIN)
  async listWaterSystems() {
    const water_systems = await this.userService.listWaterSystemsCatalog();
    return { water_systems };
  }

  @Get('roles')
  @UseGuards(MinRoleGuard)
  @MinRole(SYSTEM_ADMIN)
  async listRoles() {
    const roles = await this.userService.listAssignableRoles();
    return { roles };
  }

  @Get()
  @UseGuards(MinRoleGuard)
  @MinRole(SYSTEM_ADMIN)
  async listUsers() {
    const users = await this.userService.getAllUsers();
    return {
      users: await Promise.all(
        users.map((user) => this.userService.serializeUserForAdmin(user)),
      ),
    };
  }

  @Post()
  @UseGuards(MinRoleGuard)
  @MinRole(SYSTEM_ADMIN)
  @HttpCode(201)
  async createUser(@Body() body: CreatePortalUserDto) {
    try {
      const user = await this.userService.createPortalUser({
        name: body.name,
        email: body.email,
        password: body.password,
        roleCode: body.role_code,
        tehsils: body.tehsils,
        waterSystemIds: body.water_system_ids,
        isActive: body.is_active ?? true,
      });
      return {
        message: 'User created',
        user: await this.userService.serializeUserForAdmin(user),
      };
    } catch (err) {
      throw new BadRequestException({
        message: err instanceof Error ? err.message : 'Create user failed',
      });
    }
  }

  @Patch(':id')
  @UseGuards(MinRoleGuard)
  @MinRole(SYSTEM_ADMIN)
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdatePortalUserDto,
    @CurrentUser() actor: { sub: string },
  ) {
    if (body.is_active === false && String(actor.sub) === String(id)) {
      throw new ForbiddenException({
        message: 'You cannot deactivate your own account',
      });
    }
    try {
      const user = await this.userService.updatePortalUser(id, {
        name: body.name,
        roleCode: body.role_code,
        tehsils: body.tehsils,
        waterSystemIds: body.water_system_ids,
        isActive: body.is_active,
      });
      return {
        message: 'User updated',
        user: await this.userService.serializeUserForAdmin(user),
      };
    } catch (err) {
      if (err instanceof Error && err.message === 'User not found') {
        throw new NotFoundException({ message: err.message });
      }
      throw new BadRequestException({
        message: err instanceof Error ? err.message : 'Update user failed',
      });
    }
  }

  @Post(':id/reset-password')
  @UseGuards(MinRoleGuard)
  @MinRole(SYSTEM_ADMIN)
  @HttpCode(200)
  async resetPassword(
    @Param('id') id: string,
    @Body() body: AdminResetPasswordDto,
  ) {
    try {
      await this.userService.adminResetPassword(id, body.new_password);
      return { message: 'Password reset successfully' };
    } catch (err) {
      if (err instanceof Error && err.message === 'User not found') {
        throw new NotFoundException({ message: err.message });
      }
      throw new BadRequestException({
        message: err instanceof Error ? err.message : 'Password reset failed',
      });
    }
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
        user: await this.userService.serializeUserForAdmin(user),
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
