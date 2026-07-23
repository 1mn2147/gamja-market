import { prisma, ProductStatus, TradeStatus } from '@gamja/database';

const DAY_MS = 24 * 60 * 60 * 1000;
const SETTLEMENT_HOLD_MS = 7 * DAY_MS;
const UNPAID_ACCEPTANCE_TIMEOUT_MS = 7 * DAY_MS;

export async function confirmDueTrades(now = new Date()) {
  const due = await prisma.trade.findMany({
    where: { status: TradeStatus.DELIVERED, autoConfirmAt: { lte: now } },
    select: { id: true, productId: true },
  });
  let confirmed = 0;
  for (const trade of due) {
    const changed = await prisma.$transaction(async (tx) => {
      const updated = await tx.trade.updateMany({
        where: { id: trade.id, status: TradeStatus.DELIVERED, autoConfirmAt: { lte: now } },
        data: { status: TradeStatus.CONFIRMED, confirmedAt: now },
      });
      if (updated.count !== 1) return false;
      await tx.product.update({ where: { id: trade.productId }, data: { status: ProductStatus.SOLD } });
      await tx.payment.updateMany({
        where: { tradeId: trade.id, status: 'APPROVED' },
        data: { settlementAvailableAt: new Date(now.getTime() + SETTLEMENT_HOLD_MS), settlementStatus: 'HOLD' },
      });
      await tx.tradeHistory.create({
        data: {
          tradeId: trade.id,
          fromStatus: TradeStatus.DELIVERED,
          toStatus: TradeStatus.CONFIRMED,
          reason: 'AUTO_CONFIRMED_AFTER_7_DAYS',
        },
      });
      return true;
    });
    if (changed) confirmed += 1;
  }
  return { confirmed };
}

export async function cancelExpiredUnpaidTrades(now = new Date()) {
  const expiresBefore = new Date(now.getTime() - UNPAID_ACCEPTANCE_TIMEOUT_MS);
  const due = await prisma.trade.findMany({
    where: {
      status: TradeStatus.ACCEPTED,
      updatedAt: { lte: expiresBefore },
      payment: { is: null },
    },
    select: { id: true },
  });
  let cancelled = 0;
  for (const candidate of due) {
    const changed = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Trade" WHERE "id" = ${candidate.id} FOR UPDATE`;
      const trade = await tx.trade.findFirst({
        where: {
          id: candidate.id,
          status: TradeStatus.ACCEPTED,
          updatedAt: { lte: expiresBefore },
          payment: { is: null },
        },
        select: { id: true, productId: true },
      });
      if (!trade) return false;
      await tx.trade.update({
        where: { id: trade.id },
        data: {
          status: TradeStatus.CANCELLED,
          cancelledAt: now,
          reason: 'AUTO_CANCELLED_UNPAID_AFTER_7_DAYS',
        },
      });
      await tx.product.updateMany({
        where: { id: trade.productId, status: ProductStatus.RESERVED },
        data: { status: ProductStatus.ACTIVE },
      });
      await tx.tradeHistory.create({
        data: {
          tradeId: trade.id,
          fromStatus: TradeStatus.ACCEPTED,
          toStatus: TradeStatus.CANCELLED,
          reason: 'AUTO_CANCELLED_UNPAID_AFTER_7_DAYS',
        },
      });
      return true;
    });
    if (changed) cancelled += 1;
  }
  return { cancelled };
}
