import { Equals, IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

const phonePattern = /^[0-9+ -]{8,24}$/;

export class SignUpDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Matches(phonePattern)
  phone?: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @Equals(true)
  adultConfirmed!: boolean;
}

export class ContactConfirmationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  identifier!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  identifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class PasswordResetRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  identifier!: string;
}

export class PasswordResetConfirmDto extends ContactConfirmationDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class UpdateNeighborhoodDto {
  @IsString()
  @Matches(/^[0-9A-Za-z_-]{2,32}$/)
  neighborhoodCode!: string;
}
