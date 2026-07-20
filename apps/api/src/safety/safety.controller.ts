import { Body, Controller, Delete, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { BlockUserDto, CreateReportDto } from './safety.dto.js';
import { SafetyService } from './safety.service.js';

@Controller()
@UseGuards(SessionGuard)
export class SafetyController {
  constructor(@Inject(SafetyService) private readonly safety: SafetyService) {}
  @Get("blocks") list(@Req() request: AuthenticatedRequest) { return this.safety.listBlocks(request.user); }
  @Post("blocks") block(@Req() request: AuthenticatedRequest, @Body() input: BlockUserDto) { return this.safety.block(request.user, input.userId); }
  @Delete("blocks/:userId") unblock(@Req() request: AuthenticatedRequest, @Param("userId") userId: string) { return this.safety.unblock(request.user, userId); }
  @Post("reports") report(@Req() request: AuthenticatedRequest, @Body() input: CreateReportDto) { return this.safety.report(request.user, input); }
  @Get("reports/me") reports(@Req() request: AuthenticatedRequest) { return this.safety.reports(request.user); }
}
