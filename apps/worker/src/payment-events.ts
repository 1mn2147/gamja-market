import { createHash } from 'node:crypto';
import { OutboxStatus, PaymentStatus, WebhookProcessingStatus, prisma } from '@gamja/database';

type ProviderPayment = { paymentKey: string; orderId: string; totalAmount: number; status: string };

async function lookupPayment(paymentKey: string) {
  const secret = process.env.TOSS_SECRET_KEY ?? process.env.TOSS_SANDBOX_SECRET_KEY;
  if (!secret) throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
  const response = await fetch(`${process.env.TOSS_API_ORIGIN ?? 'https://api.tosspayments.com'}/v1/payments/${encodeURIComponent(paymentKey)}`, {
    headers: { authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`PAYMENT_PROVIDER_LOOKUP_${response.status}`);
  return response.json() as Promise<ProviderPayment>;
}

export async function dispatchOutboxJobs(add: (id: string, type: string) => Promise<void>) {
  await prisma.outboxEvent.updateMany({
    where: { status: OutboxStatus.PROCESSING, claimedAt: { lte: new Date(Date.now() - 5 * 60 * 1000) } },
    data: { status: OutboxStatus.FAILED, availableAt: new Date(), claimedAt: null, lastError: 'STALE_PROCESSING_CLAIM' },
  });
  const events = await prisma.outboxEvent.findMany({
    where: { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] }, availableAt: { lte: new Date() } },
    orderBy: { occurredAt: 'asc' },
    take: 100,
  });
  for (const event of events) await add(event.id, event.type);
  return events.length;
}

export async function processOutboxEvent(eventId: string) {
  const claimed = await prisma.outboxEvent.updateMany({
    where: { id: eventId, status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] }, availableAt: { lte: new Date() } },
    data: { status: OutboxStatus.PROCESSING, claimedAt: new Date(), attempts: { increment: 1 }, lastError: null },
  });
  if (claimed.count !== 1) return { skipped: true };
  const event = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
  try {
    if (event.type === 'webhook.received') await processPaymentWebhook(event.aggregateId);
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: { status: OutboxStatus.PROCESSED, processedAt: new Date(), claimedAt: null },
    });
    return { skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const terminal = event.attempts >= 10;
    const delaySeconds = Math.min(3600, 2 ** Math.min(event.attempts, 10));
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: terminal ? OutboxStatus.DEAD_LETTER : OutboxStatus.FAILED,
        lastError: message.slice(0, 500),
        claimedAt: null,
        availableAt: new Date(Date.now() + delaySeconds * 1000),
      },
    });
    throw error;
  }
}

async function processPaymentWebhook(webhookId: string) {
  const webhook = await prisma.paymentWebhook.findUnique({ where: { id: webhookId }, include: { payment: true } });
  if (!webhook || webhook.processingStatus !== WebhookProcessingStatus.RECEIVED) return;
  if (!webhook.payment) return finish(webhookId, WebhookProcessingStatus.FAILED, 'PAYMENT_NOT_FOUND');
  if (webhook.sequence <= webhook.payment.lastWebhookSequence) return finish(webhookId, WebhookProcessingStatus.IGNORED, 'OUT_OF_ORDER');

  const payload = JSON.parse(webhook.rawBody) as { data: { paymentKey: string; orderId: string; amountKrw?: string; amount?: number; status: string } };
  const verified = await lookupPayment(payload.data.paymentKey);
  const expectedAmount = payload.data.amountKrw ? BigInt(payload.data.amountKrw) : BigInt(payload.data.amount ?? 0);
  if (
    verified.orderId !== webhook.payment.orderId
    || BigInt(verified.totalAmount) !== webhook.payment.amountKrw
    || expectedAmount !== webhook.payment.amountKrw
  ) return finish(webhookId, WebhookProcessingStatus.FAILED, 'PROVIDER_LOOKUP_MISMATCH');

  const expectedStatus = verified.status === 'DONE'
    ? PaymentStatus.APPROVED
    : verified.status === 'CANCELED' || verified.status === 'PARTIAL_CANCELED'
      ? PaymentStatus.CANCELLED
      : webhook.payment.status;
  if (webhook.payment.status !== expectedStatus) return finish(webhookId, WebhookProcessingStatus.FAILED, 'PAYMENT_STATE_MISMATCH');

  await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id: webhook.payment!.id, lastWebhookSequence: { lt: webhook.sequence } },
      data: { lastWebhookSequence: webhook.sequence, reconciliationCheckedAt: new Date(), failureCode: null },
    });
    await tx.paymentWebhook.update({
      where: { id: webhookId },
      data: {
        processingStatus: updated.count === 1 ? WebhookProcessingStatus.PROCESSED : WebhookProcessingStatus.IGNORED,
        failureCode: updated.count === 1 ? null : 'OUT_OF_ORDER',
        processedAt: new Date(),
      },
    });
  });
}

async function finish(id: string, status: WebhookProcessingStatus, failureCode: string) {
  await prisma.paymentWebhook.update({ where: { id }, data: { processingStatus: status, failureCode, processedAt: new Date() } });
}

export function reconciliationKey(paymentId: string, checkedAt: Date) {
  return createHash('sha256').update(`${paymentId}:${checkedAt.toISOString()}`).digest('hex');
}
