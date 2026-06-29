import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ROLE_RANK,
  hierarchyRank,
  normalizeRoleCode,
} from '../../domain/constants/roles';
import { MIN_ROLE_KEY } from './decorators/min-role.decorator';
import { JwtPayload } from './decorators/current-user.decorator';

@Injectable()
export class MinRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const minCode = this.reflector.getAllAndOverride<string>(MIN_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!minCode) {
      return true;
    }

    const mc = normalizeRoleCode(minCode) ?? minCode;
    const need = ROLE_RANK[mc];
    if (need == null) {
      throw new Error(`MinRoleGuard: invalid role ${minCode}`);
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const claims = request.user;
    if (!claims) {
      throw new ForbiddenException({
        message: 'Access Forbidden: insufficient role level',
        min_role: minCode,
      });
    }

    const rank =
      claims.hierarchy_rank != null
        ? Number(claims.hierarchy_rank)
        : hierarchyRank(claims.role);

    if (rank < need) {
      throw new ForbiddenException({
        message: 'Access Forbidden: insufficient role level',
        min_role: minCode,
        your_role: claims.role,
      });
    }
    return true;
  }
}
