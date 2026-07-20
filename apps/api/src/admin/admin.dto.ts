import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminActionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  password!: string;
}
