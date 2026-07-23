import { BadGatewayException, BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  LedgerEntryType,
  PaymentAction,
  PaymentStatus,
  Prisma,
  ProductStatus,
  SettlementStatus,
  TradeStatus,
  WebhookProcessingStatus,
  prisma,
} from '@gamja/database';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { TossSandboxAdapter } from './toss-sandbox.adapter.js';

type PaymentView = {
  id: string;
  tradeId: string;
  orderId: string;
  paymentKey: string | null;
  amountKrw: bigint;
  status: PaymentStatus;
  settlementStatus: SettlementStatus;
  methodMasked: string | null;
  approvedAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  settlementAvailableAt: Date | null;
  settledAt: Date | null;
  failureCode: string | null;
};

type StoredResponse = Record<string, string | null>;

@Injectable()
export class PaymentService {
  constructor(@Inject(TossSandboxAdapter) private readonly toss: TossSandboxAdapter) {}

  private key(value: string | undefined) {
    const key = value?.trim();
    if (!key || key.length < 8 || key.length > 200) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    return key;
  }

  private hash(action: PaymentAction, payload: object) {
    return createHash('sha256').update(JSON.stringify({ action, payload })).digest('hex');
  }

  private serialize(payment: PaymentView): StoredResponse {
    return {
      id: payment.id,
      tradeId: payment.tradeId,
      orderId: payment.orderId,
      paymentKey: payment.paymentKey,
      amountKrw: payment.amountKrw.toString(),
      status: payment.status,
      settlementStatus: payment.settlementStatus,
      methodMasked: payment.methodMasked,
      approvedAt: payment.approvedAt?.toISOString() ?? null,
      cancelledAt: payment.cancelledAt?.toISOString() ?? null,
      refundedAt: payment.refundedAt?.toISOString() ?? null,
      settlementAvailableAt: payment.settlementAvailableAt?.toISOString() ?? null,
      settledAt: payment.settledAt?.toISOString() ?? null,
      failureCode: payment.failureCode,
    };
  }

  private async replay(idempotencyKey: string, action: PaymentAction, requestHash: string) {
    const operation = await prisma.paymentOperation.findUnique({ where: { idempotencyKey } });
    if (!operation) return undefined;
    if (operation.action !== action || operation.requestHash !== requestHash) {
      throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
    }
    return operation.response as StoredResponse;
  }

  private async record(
    tx: Prisma.TransactionClient,
    input: { paymentId: string; idempotencyKey: string; action: PaymentAction; requestHash: string; response: StoredResponse },
  ) {
    await tx.paymentOperation.create({
      data: {
        paymentId: input.paymentId,
        idempotencyKey: input.idempotencyKey,
        action: input.action,
        requestHash: input.requestHash,
        responseStatus: 201,
        response: input.response as Prisma.InputJsonValue,
      },
    });
  }

  async createOrder(user: AuthenticatedUser, tradeId: string, keyInput: string | undefined) {
    const idempotencyKey = this.key(keyInput);
    const requestHash = this.hash(PaymentAction.CREATE_ORDER, { tradeId, buyerId: user.id });
    const replay = await this.replay(idempotencyKey, PaymentAction.CREATE_ORDER, requestHash);
    if (replay) return replay;

    return prisma.$transaction(async (tx) => {
      const existingOperation = await tx.paymentOperation.findUnique({ where: { idempotencyKey } });
      if (existingOperation) {
        if (existingOperation.action !== PaymentAction.CREATE_ORDER || existingOperation.requestHash !== requestHash) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        return existingOperation.response as StoredResponse;
      }
      await tx.$queryRaw`SELECT "id" FROM "Trade" WHERE "id" = ${tradeId} FOR UPDATE`;
      const trade = await tx.trade.findFirst({
        where: { id: tradeId, buyerId: user.id, status: TradeStatus.ACCEPTED },
        include: { payment: true, product: { select: { status: true } } },
      });
      if (!trade) throw new NotFoundException({ code: 'PAYABLE_TRADE_NOT_FOUND' });
      if (trade.payment) throw new ConflictException({ code: 'PAYMENT_ORDER_EXISTS' });
      if (trade.product.status !== ProductStatus.RESERVED) throw new ConflictException({ code: 'TRADE_PRODUCT_STATE_MISMATCH' });

      const payment = await tx.payment.create({
        data: {
          tradeId: trade.id,
          orderId: `gm_${trade.id}_${randomUUID().replaceAll('-', '')}`,
          amountKrw: trade.priceKrw,
        },
      });
      const response = this.serialize(payment);
      await this.record(tx, { paymentId: payment.id, idempotencyKey, action: PaymentAction.CREATE_ORDER, requestHash, response });
      return response;
    });
  }

  async confirm(
    user: AuthenticatedUser,
    orderId: string,
    input: { paymentKey: string; orderId: string; amountKrw: string },
    keyInput: string | undefined,
  ) {
    const idempotencyKey = this.key(keyInput);
    const requestHash = this.hash(PaymentAction.CONFIRM, input);
    const replay = await this.replay(idempotencyKey, PaymentAction.CONFIRM, requestHash);
    if (replay) return replay;
    if (input.orderId !== orderId) throw new ConflictException({ code: 'ORDER_ID_MISMATCH' });

    const existing = await prisma.payment.findUnique({ where: { orderId }, include: { trade: { include: { product: true } } } });
    if (!existing || existing.trade.buyerId !== user.id) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND' });
    if (existing.amountKrw !== BigInt(input.amountKrw)) throw new ConflictException({ code: 'PAYMENT_AMOUNT_MISMATCH' });
    if (existing.status !== PaymentStatus.READY) throw new ConflictException({ code: 'PAYMENT_NOT_READY' });
    if (existing.trade.status !== TradeStatus.ACCEPTED || existing.trade.product.status !== ProductStatus.RESERVED) {
      throw new ConflictException({ code: 'TRADE_PRODUCT_STATE_MISMATCH' });
    }

    const approved = await this.toss.confirm({ paymentKey: input.paymentKey, orderId, amountKrw: existing.amountKrw, idempotencyKey });
    if (approved.paymentKey !== input.paymentKey || approved.orderId !== orderId || approved.amountKrw !== existing.amountKrw || approved.status !== 'DONE') {
      throw new BadGatewayException({ code: 'PAYMENT_PROVIDER_CONFIRMATION_MISMATCH' });
    }
    return prisma.$transaction(async (tx) => {
      const changed = await tx.payment.updateMany({
        where: { id: existing.id, status: PaymentStatus.READY },
        data: {
          paymentKey: approved.paymentKey,
          status: PaymentStatus.APPROVED,
          methodMasked: approved.methodMasked,
          approvedAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new ConflictException({ code: 'PAYMENT_NOT_READY' });
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: existing.id } });
      await tx.ledgerEntry.create({
        data: {
          transactionId: payment.orderId,
          paymentId: payment.id,
          tradeId: payment.tradeId,
          entryType: LedgerEntryType.ESCROW_CAPTURE,
          reason: 'TOSS_SANDBOX_APPROVED',
          amountKrw: payment.amountKrw,
        },
      });
      const response = this.serialize(payment);
      await this.record(tx, { paymentId: payment.id, idempotencyKey, action: PaymentAction.CONFIRM, requestHash, response });
      return response;
    });
  }

  async cancel(user: AuthenticatedUser, orderId: string, reason: string, keyInput: string | undefined) {
    return this.reverse(user, orderId, reason, keyInput, PaymentAction.CANCEL);
  }

  async refund(user: AuthenticatedUser, orderId: string, reason: string, keyInput: string | undefined) {
    return this.reverse(user, orderId, reason, keyInput, PaymentAction.REFUND);
  }

  private async reverse(
    user: AuthenticatedUser,
    orderId: string,
    reasonInput: string,
    keyInput: string | undefined,
    action: 'CANCEL' | 'REFUND',
  ) {
    const reason = reasonInput.trim();
    const idempotencyKey = this.key(keyInput);
    const requestHash = this.hash(action, { orderId, reason, actorId: user.id });
    const replay = await this.replay(idempotencyKey, action, requestHash);
    if (replay) return replay;

    const existing = await prisma.payment.findUnique({ where: { orderId }, include: { trade: true } });
    if (!existing || (existing.trade.buyerId !== user.id && existing.trade.sellerId !== user.id)) {
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND' });
    }
    if (existing.status !== PaymentStatus.APPROVED || !existing.paymentKey) {
      throw new ConflictException({ code: 'PAYMENT_NOT_REVERSIBLE' });
    }
    if (action === PaymentAction.CANCEL && (existing.trade.status !== TradeStatus.ACCEPTED || existing.trade.buyerId !== user.id)) {
      throw new ForbiddenException({ code: 'PAYMENT_CANCELLATION_NOT_ALLOWED' });
    }
    if (
      action === PaymentAction.CANCEL
      && (!existing.approvedAt || existing.approvedAt.getTime() + 7 * 24 * 60 * 60 * 1000 < Date.now())
    ) {
      throw new ConflictException({ code: 'PAYMENT_CANCELLATION_WINDOW_EXPIRED' });
    }
    if (
      action === PaymentAction.REFUND
      && existing.trade.status !== TradeStatus.CONFIRMED
      && existing.trade.status !== TradeStatus.DISPUTED
    ) {
      throw new ConflictException({ code: 'PAYMENT_REFUND_NOT_ALLOWED' });
    }

    const sandbox = action === PaymentAction.CANCEL
      ? await this.toss.cancel(existing.paymentKey, reason, idempotencyKey)
      : await this.toss.refund(existing.paymentKey, reason, idempotencyKey);
    if (!sandbox) throw new ConflictException({ code: 'SANDBOX_PAYMENT_NOT_FOUND' });
    const targetStatus = action === PaymentAction.CANCEL ? PaymentStatus.CANCELLED : PaymentStatus.REFUNDED;
    const entryType = action === PaymentAction.CANCEL ? LedgerEntryType.CANCELLATION : LedgerEntryType.REFUND;
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: targetStatus,
          settlementStatus: SettlementStatus.PAUSED,
          ...(action === PaymentAction.CANCEL ? { cancelledAt: new Date() } : { refundedAt: new Date() }),
        },
      });
      if (action === PaymentAction.CANCEL) {
        await tx.trade.update({ where: { id: existing.tradeId }, data: { status: TradeStatus.CANCELLED, cancelledAt: new Date(), reason } });
        await tx.product.update({ where: { id: existing.trade.productId }, data: { status: ProductStatus.ACTIVE } });
        await tx.tradeHistory.create({
          data: { tradeId: existing.tradeId, actorId: user.id, fromStatus: existing.trade.status, toStatus: TradeStatus.CANCELLED, reason },
        });
      } else if (existing.trade.status !== TradeStatus.DISPUTED) {
        await tx.trade.update({ where: { id: existing.tradeId }, data: { status: TradeStatus.DISPUTED, disputedAt: new Date(), reason } });
        await tx.tradeHistory.create({
          data: { tradeId: existing.tradeId, actorId: user.id, fromStatus: existing.trade.status, toStatus: TradeStatus.DISPUTED, reason },
        });
      }
      await tx.ledgerEntry.create({
        data: {
          transactionId: payment.orderId,
          paymentId: payment.id,
          tradeId: payment.tradeId,
          entryType,
          reason,
          amountKrw: -payment.amountKrw,
        },
      });
      const response = this.serialize(payment);
      await this.record(tx, { paymentId: payment.id, idempotencyKey, action, requestHash, response });
      return response;
    });
  }

  async detail(user: AuthenticatedUser, orderId: string) {
    const payment = await prisma.payment.findUnique({ where: { orderId }, include: { trade: true } });
    if (!payment || (payment.trade.buyerId !== user.id && payment.trade.sellerId !== user.id)) {
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND' });
    }
    return this.serialize(payment);
  }

  private verifyWebhook(rawBody: string, transmissionTime?: string, signature?: string) {
    const secret = process.env.TOSS_WEBHOOK_SECRET;
    if (!secret && (process.env.NODE_ENV === 'test' || process.env.TOSS_SANDBOX_MODE === 'true')) return;
    if (!secret || !transmissionTime || !signature) {
      throw new BadRequestException({ code: 'WEBHOOK_SIGNATURE_REQUIRED' });
    }
    const value = /^\d+$/.test(transmissionTime) ? Number(transmissionTime) : Date.parse(transmissionTime);
    const transmittedMs = value < 10_000_000_000 ? value * 1000 : value;
    if (!Number.isFinite(transmittedMs) || Math.abs(Date.now() - transmittedMs) > 5 * 60 * 1000) {
      throw new BadRequestException({ code: 'WEBHOOK_TIMESTAMP_INVALID' });
    }
    const expected = createHmac('sha256', secret).update(`${transmissionTime}.${rawBody}`).digest();
    const actual = Buffer.from(signature, /^[0-9a-f]{64}$/i.test(signature) ? 'hex' : 'base64');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new BadRequestException({ code: 'WEBHOOK_SIGNATURE_INVALID' });
    }
  }

  async receiveWebhook(
    transmissionIdInput: string | undefined,
    rawBody: string,
    transmissionTime?: string,
    signature?: string,
  ) {
    const transmissionId = transmissionIdInput?.trim();
    if (!transmissionId) throw new BadRequestException({ code: 'WEBHOOK_TRANSMISSION_ID_REQUIRED' });
    this.verifyWebhook(rawBody, transmissionTime, signature);
    const duplicate = await prisma.paymentWebhook.findUnique({ where: { transmissionId } });
    if (duplicate) return { accepted: true, duplicate: true, status: duplicate.processingStatus };

    let payload: { eventType: string; sequence: number; data: { paymentKey: string; orderId: string; amountKrw: string; status: string } };
    try {
      payload = JSON.parse(rawBody) as typeof payload;
      if (!payload.eventType || !Number.isInteger(payload.sequence) || !payload.data?.paymentKey || !payload.data.orderId || !payload.data.status) throw new Error();
    } catch {
      await prisma.paymentWebhook.create({
        data: {
          transmissionId,
          eventType: 'INVALID',
          eventStatus: 'INVALID',
          sequence: 0,
          rawBody,
          processingStatus: WebhookProcessingStatus.FAILED,
          failureCode: 'INVALID_WEBHOOK',
          processedAt: new Date(),
        },
      });
      return { accepted: true, duplicate: false, status: WebhookProcessingStatus.FAILED };
    }

    const payment = await prisma.payment.findUnique({ where: { orderId: payload.data.orderId } });
    let webhook;
    try {
      webhook = await prisma.$transaction(async (tx) => {
        const stored = await tx.paymentWebhook.create({
          data: {
            ...(payment ? { paymentId: payment.id } : {}),
            transmissionId,
            eventType: payload.eventType,
            eventStatus: payload.data.status,
            sequence: payload.sequence,
            rawBody,
          },
        });
        await tx.outboxEvent.create({
          data: {
            type: 'webhook.received',
            aggregateType: 'PaymentWebhook',
            aggregateId: stored.id,
            payload: { webhookId: stored.id },
          },
        });
        return stored;
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const raced = await prisma.paymentWebhook.findUniqueOrThrow({ where: { transmissionId } });
      return { accepted: true, duplicate: true, status: raced.processingStatus };
    }
    if (process.env.NODE_ENV !== 'test') {
      return { accepted: true, duplicate: false, status: WebhookProcessingStatus.RECEIVED };
    }
    if (!payment) return this.finishWebhook(webhook.id, WebhookProcessingStatus.FAILED, 'PAYMENT_NOT_FOUND');
    if (payload.sequence <= payment.lastWebhookSequence) return this.finishWebhook(webhook.id, WebhookProcessingStatus.IGNORED, 'OUT_OF_ORDER');

    const verified = await this.toss.lookup(payload.data.paymentKey);
    if (
      !verified
      || verified.orderId !== payment.orderId
      || verified.amountKrw !== BigInt(payload.data.amountKrw)
      || verified.status !== payload.data.status
    ) {
      return this.finishWebhook(webhook.id, WebhookProcessingStatus.FAILED, 'SANDBOX_LOOKUP_MISMATCH');
    }
    const expectedStatus = verified.status === 'DONE'
      ? PaymentStatus.APPROVED
      : verified.status === 'CANCELED'
        ? PaymentStatus.CANCELLED
        : PaymentStatus.REFUNDED;
    if (payment.status !== expectedStatus) return this.finishWebhook(webhook.id, WebhookProcessingStatus.FAILED, 'PAYMENT_STATE_MISMATCH');

    const updated = await prisma.payment.updateMany({
      where: { id: payment.id, lastWebhookSequence: { lt: payload.sequence } },
      data: { lastWebhookSequence: payload.sequence },
    });
    if (updated.count !== 1) return this.finishWebhook(webhook.id, WebhookProcessingStatus.IGNORED, 'OUT_OF_ORDER');
    return this.finishWebhook(webhook.id, WebhookProcessingStatus.PROCESSED);
  }

  private async finishWebhook(id: string, status: WebhookProcessingStatus, failureCode?: string) {
    await prisma.paymentWebhook.update({
      where: { id },
      data: { processingStatus: status, failureCode: failureCode ?? null, processedAt: new Date() },
    });
    return { accepted: true, duplicate: false, status };
  }
}
