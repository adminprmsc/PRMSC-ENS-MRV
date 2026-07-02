import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreatePortalUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  role_code!: string;

  /** Tehsils for ADMIN (user_tehsils) or SUPER_ADMIN (user_manageroperation). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tehsils?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  water_system_ids?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdatePortalUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  role_code?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tehsils?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  water_system_ids?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(6)
  new_password!: string;
}
