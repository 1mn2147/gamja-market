import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { AdminActionDto } from './admin.dto.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get('overview')
  overview() { return this.admin.overview(); }

  @Get('users')
  users() { return this.admin.users(); }

  @Get('reports')
  reports() { return this.admin.reports(); }

  @Get('trades')
  trades() { return this.admin.trades(); }

  @Get('audit-logs')
  auditLogs() { return this.admin.auditLogs(); }

  @Get('payments')
  payments() { return this.admin.payments(); }

  @Get('outbox-events')
  outboxEvents() { return this.admin.outboxEvents(); }

  @Post('outbox-events/:eventId/retry')
  retryOutbox(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() input: AdminActionDto) {
    return this.admin.retryOutbox(request.user, eventId, input.reason, input.password);
  }

  @Post('payments/:paymentId/reconcile')
  reconcilePayment(@Req() request: AuthenticatedRequest, @Param('paymentId') paymentId: string, @Body() input: AdminActionDto) {
    return this.admin.reconcilePayment(request.user, paymentId, input.reason, input.password);
  }

  @Post('users/:userId/suspend')
  suspend(@Req() request: AuthenticatedRequest, @Param('userId') userId: string, @Body() input: AdminActionDto) {
    return this.admin.setUserStatus(request.user, userId, 'SUSPENDED', input.reason, input.password);
  }

  @Post('users/:userId/activate')
  activate(@Req() request: AuthenticatedRequest, @Param('userId') userId: string, @Body() input: AdminActionDto) {
    return this.admin.setUserStatus(request.user, userId, 'ACTIVE', input.reason, input.password);
  }

  @Post('products/:productId/hide')
  hideProduct(@Req() request: AuthenticatedRequest, @Param('productId') productId: string, @Body() input: AdminActionDto) {
    return this.admin.hideProduct(request.user, productId, input.reason, input.password);
  }

  @Post('reports/:reportId/resolve')
  resolveReport(@Req() request: AuthenticatedRequest, @Param('reportId') reportId: string, @Body() input: AdminActionDto) {
    return this.admin.resolveReport(request.user, reportId, 'RESOLVED', input.reason, input.password);
  }

  @Post('reports/:reportId/dismiss')
  dismissReport(@Req() request: AuthenticatedRequest, @Param('reportId') reportId: string, @Body() input: AdminActionDto) {
    return this.admin.resolveReport(request.user, reportId, 'DISMISSED', input.reason, input.password);
  }
}
