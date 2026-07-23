import { createHmac } from 'node:crypto';
import { LedgerEntryType, PaymentStatus, SettlementStatus, TradeStatus, prisma } from '@gamja/database';

export async function processDueSettlements(now = new Date()) {
  await prisma.payment.updateMany({
    where: {
      status: PaymentStatus.APPROVED,
      settlementStatus: SettlementStatus.HOLD,
      settlementAvailableAt: { lte: now },
      trade: { status: TradeStatus.CONFIRMED },
    },
    data: { settlementStatus: SettlementStatus.READY },
  });

  const due = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.APPROVED,
      settlementStatus: { in: [SettlementStatus.READY, SettlementStatus.FAILED] },
      trade: { status: TradeStatus.CONFIRMED },
    },
    include: { trade: { select: { sellerId: true, status: true } } },
    orderBy: { settlementAvailableAt: 'asc' },
    take: 50,
  });
  let settled = 0;
  for (const payment of due) {
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, settlementStatus: { in: [SettlementStatus.READY, SettlementStatus.FAILED] } },
      data: { settlementStatus: SettlementStatus.PROCESSING, failureCode: null },
    });
    if (claimed.count !== 1) continue;
    try {
      const mode = await requestPayout({ paymentId: payment.id, orderId: payment.orderId, sellerId: payment.trade.sellerId, amountKrw: payment.amountKrw.toString() });
      await prisma.$transaction(async (tx) => {
        await tx.ledgerEntry.create({
          data: {
            transactionId: payment.orderId,
            paymentId: payment.id,
            tradeId: payment.tradeId,
            entryType: LedgerEntryType.SETTLEMENT,
            reason: mode === 'sandbox' ? 'SANDBOX_SETTLEMENT_RELEASED' : 'PAYOUT_PROVIDER_CONFIRMED',
            amountKrw: -payment.amountKrw,
          },
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: { settlementStatus: mode === 'sandbox' ? SettlementStatus.SANDBOX_SETTLED : SettlementStatus.SETTLED, settledAt: now },
        });
      });
      settled += 1;
    } catch (error) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { settlementStatus: SettlementStatus.FAILED, failureCode: (error instanceof Error ? error.message : String(error)).slice(0, 200) },
      });
    }
  }
  return { candidates: due.length, settled };
}

async function requestPayout(input: { paymentId: string; orderId: string; sellerId: string; amountKrw: string }) {
  if (process.env.TOSS_SANDBOX_MODE === 'true') return 'sandbox' as const;
  const url = process.env.SETTLEMENT_PAYOUT_WEBHOOK_URL;
  const secret = process.env.SETTLEMENT_PAYOUT_WEBHOOK_SECRET;
  if (!url || !secret) throw new Error('PAYOUT_PROVIDER_NOT_CONFIGURED');
  const body = JSON.stringify(input);
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `settlement-${input.paymentId}`,
      'x-gamja-signature': createHmac('sha256', secret).update(body).digest('hex'),
    },
    body,
  });
  if (!response.ok) throw new Error(`PAYOUT_PROVIDER_${response.status}`);
  return 'provider' as const;
}
