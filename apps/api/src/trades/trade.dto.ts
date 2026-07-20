import { IsString, MaxLength, MinLength } from 'class-validator';

export class TradeRequestDto {
  @IsString()
  productId!: string;
}

export class TradeActionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}
