import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { TradeActionDto, TradeRequestDto } from './trade.dto.js';
import { TradeService } from './trade.service.js';

@Controller('trades')
@UseGuards(SessionGuard)
export class TradeController {
  constructor(@Inject(TradeService) private readonly trades: TradeService) {}

  @Post()
  request(@Req() request: AuthenticatedRequest, @Body() input: TradeRequestDto) {
    return this.trades.request(request.user, input.productId);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.trades.list(request.user);
  }

  @Get(':tradeId')
  detail(@Req() request: AuthenticatedRequest, @Param('tradeId') tradeId: string) {
    return this.trades.detail(request.user, tradeId);
  }

  @Post(':tradeId/accept')
  accept(@Req() request: AuthenticatedRequest, @Param('tradeId') tradeId: string) {
    return this.trades.accept(request.user, tradeId);
  }

  @Post(':tradeId/reject')
  reject(@Req() request: AuthenticatedRequest, @Param('tradeId') tradeId: string, @Body() input: TradeActionDto) {
    return this.trades.reject(request.user, tradeId, input.reason);
  }

  @Post(':tradeId/deliver')
  deliver(@Req() request: AuthenticatedRequest, @Param('tradeId') tradeId: string) {
    return this.trades.deliver(request.user, tradeId);
  }

  @Post(':tradeId/confirm')
  confirm(@Req() request: AuthenticatedRequest, @Param('tradeId') tradeId: string) {
    return this.trades.confirm(request.user, tradeId);
  }

  @Post(':tradeId/dispute')
  dispute(@Req() request: AuthenticatedRequest, @Param('tradeId') tradeId: string, @Body() input: TradeActionDto) {
    return this.trades.dispute(request.user, tradeId, input.reason);
  }

  @Post(':tradeId/cancel')
  cancel(@Req() request: AuthenticatedRequest, @Param('tradeId') tradeId: string, @Body() input: TradeActionDto) {
    return this.trades.cancel(request.user, tradeId, input.reason);
  }
}
