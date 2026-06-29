import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  role?: string;
  name?: string;
  tehsils?: string[];
  water_system_ids?: string[];
  hierarchy_rank?: number;
}

export const CurrentUser = createParamDecorator(
  (data: 'id' | 'full' | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    if (data === 'full') {
      return user;
    }
    return user?.sub;
  },
);
