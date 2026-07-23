import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { ConfirmPaymentDto, CreatePaymentOrderDto, PaymentReasonDto } from './payment.dto.js';
import { PaymentService } from './payment.service.js';

@Controller('payments')
export class PaymentController {
  constructor(@Inject(PaymentService) private readonly payments: PaymentService) {}

  @Post('orders')
  @UseGuards(SessionGuard)
  createOrder(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreatePaymentOrderDto,
  ) {
    return this.payments.createOrder(request.user, input.tradeId, idempotencyKey);
  }

  @Post(':orderId/confirm')
  @UseGuards(SessionGuard)
  confirm(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: ConfirmPaymentDto,
  ) {
    return this.payments.confirm(request.user, orderId, input, idempotencyKey);
  }

  @Post(':orderId/cancel')
  @UseGuards(SessionGuard)
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: PaymentReasonDto,
  ) {
    return this.payments.cancel(request.user, orderId, input.reason, idempotencyKey);
  }

  @Post(':orderId/refund')
  @UseGuards(SessionGuard)
  refund(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: PaymentReasonDto,
  ) {
    return this.payments.refund(request.user, orderId, input.reason, idempotencyKey);
  }

  @Get(':orderId')
  @UseGuards(SessionGuard)
  detail(@Req() request: AuthenticatedRequest, @Param('orderId') orderId: string) {
    return this.payments.detail(request.user, orderId);
  }

  @Post('webhooks/toss')
  @HttpCode(202)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('toss-transmission-id') transmissionId: string | undefined,
    @Headers('toss-transmission-time') transmissionTime: string | undefined,
    @Headers('toss-transmission-signature') signature: string | undefined,
  ) {
    if (!request.rawBody) throw new BadRequestException({ code: 'RAW_WEBHOOK_BODY_REQUIRED' });
    return this.payments.receiveWebhook(transmissionId, request.rawBody.toString('utf8'), transmissionTime, signature);
  }
}
