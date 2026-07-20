import { prisma, ProductStatus, TradeStatus } from '@gamja/database';

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
