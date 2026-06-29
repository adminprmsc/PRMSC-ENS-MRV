export declare class LoginDto {
    email: string;
    password: string;
}
export declare class ChangePasswordDto {
    current_password: string;
    new_password: string;
}
export declare class ForgotPasswordDto {
    email: string;
}
export declare class ResetPasswordDto {
    token: string;
    new_password: string;
}
export declare class OnboardOperatorDto {
    name: string;
    email: string;
    password: string;
    water_system_ids: string[];
}
