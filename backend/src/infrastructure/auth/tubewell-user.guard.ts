import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ADMIN, USER, normalizeRoleCode } from '../../domain/constants/roles';
import { UserService } from '../../application/services/user.service';
import { JwtPayload } from './decorators/current-user.decorator';

@Injectable()
export class TubewellUserGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const claims = request.user;
    if (!claims?.sub) {
      throw new ForbiddenException({ message: 'Access Forbidden' });
    }

    if (normalizeRoleCode(claims.role) !== USER) {
      throw new ForbiddenException({
        message: 'Access Forbidden: tubewell operator role required',
        your_role: claims.role,
      });
    }

    const user = await this.userService.getUserById(claims.sub);
    if (!user) {
      throw new NotFoundException({ message: 'User not found' });
    }

    if (!user.assignedWaterSystemIds.length) {
      throw new ForbiddenException({
        message: 'No water systems assigned — contact your tehsil manager',
      });
    }
    return true;
  }
}
