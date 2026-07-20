import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const amountPattern = /^\d+$/;

export class CreatePaymentOrderDto {
  @IsString()
  tradeId!: string;
}

export class ConfirmPaymentDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  paymentKey!: string;

  @IsString()
  orderId!: string;

  @IsString()
  @Matches(amountPattern)
  amountKrw!: string;
}

export class PaymentReasonDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}
