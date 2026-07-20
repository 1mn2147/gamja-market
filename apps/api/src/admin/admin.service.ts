import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, ProductStatus, UserStatus } from '@gamja/database';
import * as argon2 from 'argon2';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { requestContext } from '../common/request-context.middleware.js';

@Injectable()
export class AdminService {
  private async reauthenticate(user: AuthenticatedUser, password: string) {
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, role: true } });
    if (!account || account.role !== 'SUPER_ADMIN' || !await argon2.verify(account.passwordHash, password)) {
      throw new ForbiddenException({ code: 'ADMIN_REAUTHENTICATION_FAILED' });
    }
  }

  private async audit(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    reason: string;
    before?: object;
    after?: object;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        ...(input.before ? { before: input.before } : {}),
        ...(input.after ? { after: input.after } : {}),
        requestId: requestContext.getStore()?.requestId ?? 'admin-system',
      },
    });
  }

  async overview() {
    const [users, products, reports, trades] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.report.count({ where: { status: { in: ['RECEIVED', 'REVIEWING'] } } }),
      prisma.trade.count({ where: { status: { in: ['REQUESTED', 'ACCEPTED', 'DELIVERED', 'DISPUTED'] } } }),
    ]);
    return { users, products, openReports: reports, activeTrades: trades };
  }

  async users() {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, phone: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      users: users.map((user) => ({
        ...user,
        email: user.email ? user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') : null,
        phone: user.phone ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}` : null,
      })),
    };
  }

  async reports() {
    return { reports: await prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }) };
  }

  async trades() {
    const trades = await prisma.trade.findMany({
      include: { product: { select: { id: true, title: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return { trades: trades.map((trade) => ({ ...trade, priceKrw: trade.priceKrw.toString() })) };
  }

  async auditLogs() {
    return { auditLogs: await prisma.auditLog.findMany({ orderBy: { occurredAt: 'desc' }, take: 200 }) };
  }

  async setUserStatus(admin: AuthenticatedUser, targetId: string, status: 'ACTIVE' | 'SUSPENDED', reason: string, password: string) {
    await this.reauthenticate(admin, password);
    const before = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, status: true } });
    if (!before) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (before.role === 'SUPER_ADMIN') throw new ForbiddenException({ code: 'CANNOT_MODIFY_SUPER_ADMIN' });
    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: targetId }, data: { status: status as UserStatus } });
      if (status === 'SUSPENDED') await tx.session.updateMany({ where: { userId: targetId, revokedAt: null }, data: { revokedAt: new Date() } });
      return updated;
    });
    await this.audit({ actorId: admin.id, action: `USER_${status}`, targetType: 'USER', targetId, reason, before, after: { id: after.id, status: after.status } });
    return { id: after.id, status: after.status };
  }

  async hideProduct(admin: AuthenticatedUser, targetId: string, reason: string, password: string) {
    await this.reauthenticate(admin, password);
    const before = await prisma.product.findUnique({ where: { id: targetId }, select: { id: true, status: true } });
    if (!before) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND' });
    const after = await prisma.product.update({ where: { id: targetId }, data: { status: ProductStatus.HIDDEN } });
    await this.audit({ actorId: admin.id, action: 'PRODUCT_HIDDEN', targetType: 'PRODUCT', targetId, reason, before, after: { id: after.id, status: after.status } });
    return { id: after.id, status: after.status };
  }

  async resolveReport(admin: AuthenticatedUser, targetId: string, status: 'RESOLVED' | 'DISMISSED', reason: string, password: string) {
    await this.reauthenticate(admin, password);
    const before = await prisma.report.findUnique({ where: { id: targetId }, select: { id: true, status: true } });
    if (!before) throw new NotFoundException({ code: 'REPORT_NOT_FOUND' });
    const after = await prisma.report.update({ where: { id: targetId }, data: { status } });
    await this.audit({ actorId: admin.id, action: `REPORT_${status}`, targetType: 'REPORT', targetId, reason, before, after: { id: after.id, status: after.status } });
    return { id: after.id, status: after.status };
  }
}
