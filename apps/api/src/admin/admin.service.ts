import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OutboxStatus, PaymentStatus, prisma, ProductStatus, UserStatus } from '@gamja/database';
import * as argon2 from 'argon2';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { requestContext } from '../common/request-context.middleware.js';
import { TossSandboxAdapter } from '../payments/toss-sandbox.adapter.js';

@Injectable()
export class AdminService {
  constructor(@Inject(TossSandboxAdapter) private readonly toss: TossSandboxAdapter) {}
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

  async payments() {
    const payments = await prisma.payment.findMany({
      include: {
        trade: { include: { product: { select: { id: true, title: true } } } },
        webhooks: { orderBy: { receivedAt: 'desc' }, take: 5 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return {
      payments: payments.map((payment) => ({
        ...payment,
        amountKrw: payment.amountKrw.toString(),
        paymentKey: payment.paymentKey ? `${payment.paymentKey.slice(0, 6)}…${payment.paymentKey.slice(-4)}` : null,
        trade: { ...payment.trade, priceKrw: payment.trade.priceKrw.toString() },
      })),
    };
  }

  async outboxEvents() {
    return {
      events: await prisma.outboxEvent.findMany({
        where: { status: { in: [OutboxStatus.FAILED, OutboxStatus.DEAD_LETTER] } },
        orderBy: { occurredAt: 'desc' },
        take: 100,
      }),
    };
  }

  async retryOutbox(admin: AuthenticatedUser, eventId: string, reason: string, password: string) {
    await this.reauthenticate(admin, password);
    const event = await prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException({ code: 'OUTBOX_EVENT_NOT_FOUND' });
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: { status: OutboxStatus.PENDING, attempts: 0, availableAt: new Date(), claimedAt: null, lastError: null },
    });
    await this.audit({ actorId: admin.id, action: 'OUTBOX_RETRY_REQUESTED', targetType: 'OUTBOX_EVENT', targetId: eventId, reason, before: { status: event.status }, after: { status: OutboxStatus.PENDING } });
    return { id: eventId, status: OutboxStatus.PENDING };
  }

  async reconcilePayment(admin: AuthenticatedUser, paymentId: string, reason: string, password: string) {
    await this.reauthenticate(admin, password);
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment?.paymentKey) throw new NotFoundException({ code: 'PAYMENT_NOT_RECONCILABLE' });
    const provider = await this.toss.lookup(payment.paymentKey);
    const expected = provider?.status === 'DONE'
      ? PaymentStatus.APPROVED
      : provider?.status === 'CANCELED'
        ? PaymentStatus.CANCELLED
        : provider?.status === 'REFUNDED'
          ? PaymentStatus.REFUNDED
          : undefined;
    const matched = Boolean(provider && provider.orderId === payment.orderId && provider.amountKrw === payment.amountKrw && expected === payment.status);
    await prisma.payment.update({
      where: { id: paymentId },
      data: { reconciliationCheckedAt: new Date(), failureCode: matched ? null : 'RECONCILIATION_MISMATCH' },
    });
    await this.audit({ actorId: admin.id, action: 'PAYMENT_RECONCILED', targetType: 'PAYMENT', targetId: paymentId, reason, before: { status: payment.status }, after: { matched, providerStatus: provider?.status ?? null } });
    return { id: paymentId, matched, internalStatus: payment.status, providerStatus: provider?.status ?? null };
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
