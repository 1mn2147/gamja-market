import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, prisma, ProductStatus, SettlementStatus, TradeStatus } from '@gamja/database';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { SafetyService } from '../safety/safety.service.js';

const ACTIVE_TRADE_STATUSES = [
  TradeStatus.REQUESTED,
  TradeStatus.ACCEPTED,
  TradeStatus.DELIVERED,
  TradeStatus.DISPUTED,
];

const DAY_MS = 24 * 60 * 60 * 1000;
const SETTLEMENT_HOLD_MS = 7 * DAY_MS;
const COMPETING_TRADE_REASON = 'PRODUCT_RESERVED_BY_ANOTHER_TRADE';

@Injectable()
export class TradeService {
  constructor(@Inject(SafetyService) private readonly safety: SafetyService) {}

  private serialize<T extends { priceKrw: bigint; buyerId: string; sellerId: string }>(trade: T, userId: string) {
    const role = trade.buyerId === userId ? 'BUYER' : 'SELLER';
    return { ...trade, priceKrw: trade.priceKrw.toString(), role };
  }

  private async participantTrade(id: string, userId: string) {
    const trade = await prisma.trade.findFirst({
      where: { id, OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: {
        product: { select: { id: true, title: true, status: true, neighborhoodId: true } },
        payment: {
          select: {
            orderId: true,
            status: true,
            settlementStatus: true,
            approvedAt: true,
            settlementAvailableAt: true,
            settledAt: true,
          },
        },
        history: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!trade) throw new NotFoundException({ code: 'TRADE_NOT_FOUND' });
    return trade;
  }

  async request(user: AuthenticatedUser, productId: string) {
    const trade = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, status: ProductStatus.ACTIVE },
      });
      if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_AVAILABLE' });
      if (product.authorId === user.id) throw new ConflictException({ code: 'CANNOT_BUY_OWN_PRODUCT' });
      if (await this.safety.isBlocked(user.id, product.authorId)) throw new ForbiddenException({ code: 'TRADE_BLOCKED' });

      const buyer = await tx.user.findUnique({
        where: { id: user.id },
        select: { neighborhoodId: true },
      });
      if (!buyer?.neighborhoodId) throw new ConflictException({ code: 'NEIGHBORHOOD_REQUIRED' });
      const nearby = buyer.neighborhoodId === product.neighborhoodId
        || Boolean(await tx.neighborhoodLink.findUnique({
          where: { fromId_toId: { fromId: buyer.neighborhoodId, toId: product.neighborhoodId } },
        }));
      if (!nearby) throw new ForbiddenException({ code: 'PRODUCT_OUTSIDE_NEIGHBORHOOD' });

      const duplicate = await tx.trade.findFirst({
        where: { productId, buyerId: user.id, status: { in: ACTIVE_TRADE_STATUSES } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException({ code: 'ACTIVE_TRADE_EXISTS' });

      const created = await tx.trade.create({
        data: { productId, buyerId: user.id, sellerId: product.authorId, priceKrw: product.priceKrw },
      });
      await tx.tradeHistory.create({
        data: { tradeId: created.id, actorId: user.id, toStatus: TradeStatus.REQUESTED },
      });
      const chat = await tx.chatRoom.upsert({
        where: {
          productId_buyerId_sellerId: {
            productId,
            buyerId: user.id,
            sellerId: product.authorId,
          },
        },
        create: {
          productId,
          buyerId: user.id,
          sellerId: product.authorId,
          participants: {
            create: [{ userId: user.id }, { userId: product.authorId }],
          },
        },
        update: {},
        select: { id: true },
      });
      return { trade: created, chatId: chat.id };
    });
    return { ...this.serialize(trade.trade, user.id), chatId: trade.chatId };
  }

  async accept(user: AuthenticatedUser, tradeId: string) {
    const trade = await prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findFirst({ where: { id: tradeId, sellerId: user.id, status: TradeStatus.REQUESTED } });
      if (!trade) throw new NotFoundException({ code: 'TRADE_NOT_FOUND' });
      const reserved = await tx.product.updateMany({ where: { id: trade.productId, status: ProductStatus.ACTIVE }, data: { status: ProductStatus.RESERVED } });
      if (reserved.count !== 1) throw new ConflictException({ code: 'PRODUCT_ALREADY_RESERVED' });
      const updated = await tx.trade.update({ where: { id: tradeId }, data: { status: TradeStatus.ACCEPTED } });
      await tx.tradeHistory.create({ data: { tradeId, actorId: user.id, fromStatus: TradeStatus.REQUESTED, toStatus: TradeStatus.ACCEPTED } });
      const rejectedCompeting = await tx.trade.updateManyAndReturn({
        where: { productId: trade.productId, id: { not: tradeId }, status: TradeStatus.REQUESTED },
        data: { status: TradeStatus.REJECTED, rejectedAt: new Date(), reason: COMPETING_TRADE_REASON },
        select: { id: true },
      });
      if (rejectedCompeting.length > 0) {
        await tx.tradeHistory.createMany({
          data: rejectedCompeting.map((competingTrade) => ({
            tradeId: competingTrade.id,
            actorId: user.id,
            fromStatus: TradeStatus.REQUESTED,
            toStatus: TradeStatus.REJECTED,
            reason: COMPETING_TRADE_REASON,
          })),
        });
      }
      return updated;
    });
    return this.serialize(trade, user.id);
  }

  async reject(user: AuthenticatedUser, tradeId: string, reason: string) {
    const trade = await prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findFirst({ where: { id: tradeId, sellerId: user.id, status: TradeStatus.REQUESTED } });
      if (!trade) throw new NotFoundException({ code: 'TRADE_NOT_FOUND' });
      const updated = await tx.trade.update({
        where: { id: tradeId },
        data: { status: TradeStatus.REJECTED, rejectedAt: new Date(), reason: reason.trim() },
      });
      await tx.tradeHistory.create({ data: { tradeId, actorId: user.id, fromStatus: TradeStatus.REQUESTED, toStatus: TradeStatus.REJECTED, reason: reason.trim() } });
      return updated;
    });
    return this.serialize(trade, user.id);
  }

  async deliver(user: AuthenticatedUser, tradeId: string) {
    const trade = await prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findFirst({
        where: { id: tradeId, sellerId: user.id, status: TradeStatus.ACCEPTED },
        include: { payment: { select: { status: true } } },
      });
      if (!trade) throw new NotFoundException({ code: 'TRADE_NOT_FOUND' });
      if (trade.payment?.status !== 'APPROVED') throw new ConflictException({ code: 'ESCROW_PAYMENT_REQUIRED' });
      const deliveredAt = new Date();
      const updated = await tx.trade.update({
        where: { id: tradeId },
        data: { status: TradeStatus.DELIVERED, deliveredAt, autoConfirmAt: new Date(deliveredAt.getTime() + 7 * DAY_MS) },
      });
      await tx.tradeHistory.create({ data: { tradeId, actorId: user.id, fromStatus: TradeStatus.ACCEPTED, toStatus: TradeStatus.DELIVERED } });
      return updated;
    });
    return this.serialize(trade, user.id);
  }

  async confirm(user: AuthenticatedUser, tradeId: string) {
    const trade = await prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findFirst({
        where: { id: tradeId, buyerId: user.id, status: TradeStatus.DELIVERED },
        include: { payment: { select: { id: true, status: true } } },
      });
      if (!trade) throw new NotFoundException({ code: 'TRADE_NOT_FOUND' });
      if (trade.payment?.status !== 'APPROVED') throw new ConflictException({ code: 'ESCROW_PAYMENT_REQUIRED' });
      const confirmedAt = new Date();
      const updated = await tx.trade.update({ where: { id: tradeId }, data: { status: TradeStatus.CONFIRMED, confirmedAt } });
      await tx.product.update({ where: { id: trade.productId }, data: { status: ProductStatus.SOLD } });
      await tx.payment.update({
        where: { id: trade.payment.id },
        data: { settlementAvailableAt: new Date(confirmedAt.getTime() + SETTLEMENT_HOLD_MS), settlementStatus: 'HOLD' },
      });
      await tx.tradeHistory.create({ data: { tradeId, actorId: user.id, fromStatus: TradeStatus.DELIVERED, toStatus: TradeStatus.CONFIRMED } });
      return updated;
    });
    return this.serialize(trade, user.id);
  }

  async dispute(user: AuthenticatedUser, tradeId: string, reason: string) {
    const trade = await prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findFirst({
        where: {
          id: tradeId,
          OR: [{ buyerId: user.id }, { sellerId: user.id }],
          status: { in: [TradeStatus.ACCEPTED, TradeStatus.DELIVERED, TradeStatus.CONFIRMED] },
        },
      });
      if (!trade) throw new NotFoundException({ code: 'TRADE_NOT_FOUND' });
      const updated = await tx.trade.update({
        where: { id: tradeId },
        data: { status: TradeStatus.DISPUTED, disputedAt: new Date(), reason: reason.trim() },
      });
      await tx.payment.updateMany({ where: { tradeId }, data: { settlementStatus: 'PAUSED' } });
      await tx.tradeHistory.create({ data: { tradeId, actorId: user.id, fromStatus: trade.status, toStatus: TradeStatus.DISPUTED, reason: reason.trim() } });
      return updated;
    });
    return this.serialize(trade, user.id);
  }

  async cancel(user: AuthenticatedUser, tradeId: string, reason: string) {
    const trade = await prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findFirst({
        where: {
          id: tradeId,
          OR: [{ buyerId: user.id }, { sellerId: user.id }],
          status: { in: [TradeStatus.REQUESTED, TradeStatus.ACCEPTED] },
        },
        include: { payment: { select: { id: true, status: true } } },
      });
      if (!trade) throw new NotFoundException({ code: 'TRADE_NOT_FOUND' });
      if (trade.payment?.status === 'APPROVED') {
        throw new ConflictException({ code: 'PAYMENT_REVERSAL_REQUIRED' });
      }
      if (trade.status === TradeStatus.ACCEPTED) {
        await tx.product.updateMany({ where: { id: trade.productId, status: ProductStatus.RESERVED }, data: { status: ProductStatus.ACTIVE } });
      }
      if (trade.payment) {
        await tx.payment.updateMany({
          where: {
            id: trade.payment.id,
            status: { in: [PaymentStatus.READY, PaymentStatus.UNCONFIRMED, PaymentStatus.FAILED] },
          },
          data: {
            status: PaymentStatus.CANCELLED,
            settlementStatus: SettlementStatus.PAUSED,
            cancelledAt: new Date(),
          },
        });
      }
      const updated = await tx.trade.update({
        where: { id: tradeId },
        data: { status: TradeStatus.CANCELLED, cancelledAt: new Date(), reason: reason.trim() },
      });
      await tx.tradeHistory.create({ data: { tradeId, actorId: user.id, fromStatus: trade.status, toStatus: TradeStatus.CANCELLED, reason: reason.trim() } });
      return updated;
    });
    return this.serialize(trade, user.id);
  }

  async list(user: AuthenticatedUser) {
    const trades = await prisma.trade.findMany({
      where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      include: {
        product: { select: { id: true, title: true, status: true } },
        payment: {
          select: {
            orderId: true,
            status: true,
            settlementStatus: true,
            approvedAt: true,
            settlementAvailableAt: true,
            settledAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return { trades: trades.map((trade) => this.serialize(trade, user.id)) };
  }

  async detail(user: AuthenticatedUser, tradeId: string) {
    return this.serialize(await this.participantTrade(tradeId, user.id), user.id);
  }

  async processDueAutoConfirmations(now = new Date()) {
    const due = await prisma.trade.findMany({
      where: { status: TradeStatus.DELIVERED, autoConfirmAt: { lte: now } },
      select: { id: true, productId: true },
    });
    let confirmed = 0;
    for (const item of due) {
      const changed = await prisma.$transaction(async (tx) => {
        const updated = await tx.trade.updateMany({
          where: { id: item.id, status: TradeStatus.DELIVERED, autoConfirmAt: { lte: now } },
        data: { status: TradeStatus.CONFIRMED, confirmedAt: now },
        });
        if (updated.count !== 1) return false;
        await tx.product.update({ where: { id: item.productId }, data: { status: ProductStatus.SOLD } });
        await tx.payment.updateMany({
          where: { tradeId: item.id, status: 'APPROVED' },
          data: { settlementAvailableAt: new Date(now.getTime() + SETTLEMENT_HOLD_MS), settlementStatus: 'HOLD' },
        });
        await tx.tradeHistory.create({ data: { tradeId: item.id, fromStatus: TradeStatus.DELIVERED, toStatus: TradeStatus.CONFIRMED, reason: 'AUTO_CONFIRMED_AFTER_7_DAYS' } });
        return true;
      });
      if (changed) confirmed += 1;
    }
    return { confirmed };
  }
}
