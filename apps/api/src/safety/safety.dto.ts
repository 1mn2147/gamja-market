import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class BlockUserDto {
  @IsString()
  userId!: string;
}

export class CreateReportDto {
  @IsEnum(['USER', 'PRODUCT', 'MESSAGE'])
  targetType!: 'USER' | 'PRODUCT' | 'MESSAGE';

  @IsString()
  targetId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/\S/, { message: 'reason must include a non-whitespace character' })
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detail?: string;
}
