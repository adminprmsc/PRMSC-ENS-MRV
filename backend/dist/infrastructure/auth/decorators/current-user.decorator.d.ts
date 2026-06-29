export interface JwtPayload {
    sub: string;
    role?: string;
    name?: string;
    tehsils?: string[];
    water_system_ids?: string[];
    hierarchy_rank?: number;
}
export declare const CurrentUser: (...dataOrPipes: ("id" | "full" | import("@nestjs/common").PipeTransform<any, any> | import("@nestjs/common").Type<import("@nestjs/common").PipeTransform<any, any>> | undefined)[]) => ParameterDecorator;
