import { CanActivate, ExecutionContext } from '@nestjs/common';
import { UserService } from '../../application/services/user.service';
export declare class TehsilManagerGuard implements CanActivate {
    private readonly userService;
    constructor(userService: UserService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
