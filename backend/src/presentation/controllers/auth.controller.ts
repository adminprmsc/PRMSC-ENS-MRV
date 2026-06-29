import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../../application/services/auth.service';
import { EmailService } from '../../application/services/email.service';
import { UserService } from '../../application/services/user.service';
import { UserManagerOperation } from '../../infrastructure/database/entities/user-manager-operation.entity';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
} from '../dto/auth.dto';

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(UserManagerOperation)
    private readonly managerOpRepo: Repository<UserManagerOperation>,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto) {
    const user = await this.authService.authenticate(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException({ message: 'Invalid email or password' });
    }

    const fullUser =
      (await this.userService.getUserById(String(user.id))) ?? user;
    const rank = fullUser.assignedRole?.hierarchyRank ?? 1;

    const moRows = await this.managerOpRepo.find({
      where: { userId: String(fullUser.id) },
    });
    const moTehsils = moRows
      .map((r) => String(r.tehsil).trim())
      .filter(Boolean);
    const tehsils = moTehsils.length
      ? moTehsils
      : await this.userService.getAssignedTehsils(fullUser);
    const waterSystemIds = fullUser.assignedWaterSystemIds;

    const token = this.jwtService.sign({
      sub: String(fullUser.id),
      role: fullUser.role,
      name: fullUser.name,
      tehsils,
      water_system_ids: waterSystemIds,
      hierarchy_rank: rank,
    });

    return {
      token,
      user: {
        id: String(fullUser.id),
        name: fullUser.name,
        role: fullUser.role,
        tehsils,
        manager_operation_tehsils: moTehsils,
        water_system_ids: waterSystemIds,
      },
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async changePassword(
    @CurrentUser() userId: string,
    @Body() body: ChangePasswordDto,
  ) {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new NotFoundException({ message: 'User not found' });
    }
    try {
      await this.authService.changePassword(
        user,
        body.current_password,
        body.new_password,
      );
    } catch (err) {
      throw new UnauthorizedException({
        message: err instanceof Error ? err.message : 'Password change failed',
      });
    }
    return { message: 'Password updated successfully' };
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    const { user, rawToken } = await this.authService.requestPasswordReset(
      body.email,
    );

    if (user && rawToken) {
      try {
        const sent = await this.emailService.sendPasswordResetEmail(
          user.email,
          rawToken,
        );
        if (sent) {
          this.logger.log(`Password reset email sent to ${user.email}`);
        }
      } catch (err) {
        this.logger.error(
          `Failed to send password reset email: ${String(err)}`,
        );
      }
    }

    const msg =
      'If an account exists for that email, you will receive password reset instructions shortly.';
    const response: Record<string, string> = { message: msg };

    if (
      this.config.get<boolean>('app.debug') &&
      this.config.get<boolean>('app.passwordResetDevReturnToken') &&
      user &&
      rawToken
    ) {
      response.reset_token = rawToken;
    }

    return response;
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) {
    try {
      await this.authService.resetPasswordWithToken(
        body.token,
        body.new_password,
      );
    } catch (err) {
      throw new UnauthorizedException({
        message: err instanceof Error ? err.message : 'Reset failed',
      });
    }
    return { message: 'Password has been reset. You can sign in now.' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@CurrentUser() userId: string) {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new NotFoundException({ message: 'User not found' });
    }
    return {
      id: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      tehsils: await this.userService.getAssignedTehsils(user),
      water_system_ids: user.assignedWaterSystemIds,
      created_at: user.createdAt?.toISOString() ?? null,
    };
  }
}
