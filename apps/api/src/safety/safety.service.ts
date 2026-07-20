import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, ReportTargetType } from '@gamja/database';
import type { AuthenticatedUser } from '../auth/auth.service.js';

const REPORT_WINDOW_MS = 60_000;
const REPORT_LIMIT = 5;

export type SafetyRelationshipChange = {
  action: 'blocked' | 'unblocked';
  userIds: [string, string];
};

function isUniqueConstraintError(error: unknown): error is { code: 'P2002' } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class SafetyService {
  private readonly relationshipListeners = new Set<(change: SafetyRelationshipChange) => void>();

  onRelationshipChanged(listener: (change: SafetyRelationshipChange) => void) {
    this.relationshipListeners.add(listener);
    return () => this.relationshipListeners.delete(listener);
  }

  private relationshipChanged(change: SafetyRelationshipChange) {
    for (const listener of this.relationshipListeners) listener(change);
  }

  async isBlocked(firstUserId: string, secondUserId: string) {
    return Boolean(await prisma.block.findFirst({ where: { OR: [{ blockerId: firstUserId, blockedId: secondUserId }, { blockerId: secondUserId, blockedId: firstUserId }] } }));
  }

  async block(user: AuthenticatedUser, blockedId: string) {
    if (user.id === blockedId) throw new BadRequestException({ code: 'CANNOT_BLOCK_SELF' });
    const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    await prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: user.id, blockedId } }, create: { blockerId: user.id, blockedId }, update: {} });
    this.relationshipChanged({ action: 'blocked', userIds: [user.id, blockedId] });
    return { blockedId };
  }

  async unblock(user: AuthenticatedUser, blockedId: string) {
    const result = await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId } });
    if (result.count > 0) this.relationshipChanged({ action: 'unblocked', userIds: [user.id, blockedId] });
    return { unblockedId: blockedId };
  }

  async listBlocks(user: AuthenticatedUser) {
    const blocks = await prisma.block.findMany({ where: { blockerId: user.id }, select: { blockedId: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
    return { blocks: blocks.map((block) => ({ ...block, displayName: `사용자 ${block.blockedId.slice(-6)}` })) };
  }

  async report(user: AuthenticatedUser, input: { targetType: 'USER' | 'PRODUCT' | 'MESSAGE'; targetId: string; reason: string; detail?: string }) {
    const recentReports = await prisma.report.count({ where: { reporterId: user.id, createdAt: { gte: new Date(Date.now() - REPORT_WINDOW_MS) } } });
    if (recentReports >= REPORT_LIMIT) throw new HttpException({ code: 'REPORT_RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
    const valid = input.targetType === 'USER'
      ? await prisma.user.findUnique({ where: { id: input.targetId }, select: { id: true } })
      : input.targetType === 'PRODUCT'
        ? await prisma.product.findUnique({ where: { id: input.targetId }, select: { id: true } })
        : await prisma.chatMessage.findFirst({ where: { id: input.targetId, chatRoom: { participants: { some: { userId: user.id } } } }, select: { id: true } });
    if (!valid) throw new NotFoundException({ code: 'REPORT_TARGET_NOT_FOUND' });
    try {
      return await prisma.report.create({ data: { reporterId: user.id, targetType: input.targetType as ReportTargetType, targetId: input.targetId, reason: input.reason.trim(), ...(input.detail ? { detail: input.detail.trim() } : {}) } });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new ConflictException({ code: 'DUPLICATE_REPORT' });
      throw error;
    }
  }

  async reports(user: AuthenticatedUser) {
    return { reports: await prisma.report.findMany({ where: { reporterId: user.id }, select: { id: true, targetType: true, targetId: true, reason: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } }) };
  }
}
