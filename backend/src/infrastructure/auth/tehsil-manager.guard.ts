import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ADMIN, normalizeRoleCode } from '../../domain/constants/roles';
import { UserService } from '../../application/services/user.service';
import { JwtPayload } from './decorators/current-user.decorator';

@Injectable()
export class TehsilManagerGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const claims = request.user;
    if (!claims?.sub) {
      throw new ForbiddenException({ message: 'Access Forbidden' });
    }

    if (normalizeRoleCode(claims.role) !== ADMIN) {
      throw new ForbiddenException({
        message: 'Access Forbidden: tehsil manager role required',
        your_role: claims.role,
      });
    }

    const user = await this.userService.getUserById(claims.sub);
    if (!user) {
      throw new NotFoundException({ message: 'User not found' });
    }

    const tehsils = await this.userService.getAssignedTehsils(user);
    if (!tehsils.length) {
      throw new ForbiddenException({
        message: 'No tehsil assignments — contact operations',
      });
    }
    return true;
  }
}
