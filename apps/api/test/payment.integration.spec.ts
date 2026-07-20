import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { prisma } from '@gamja/database';
import { AppModule } from '../src/app.module';
import { requestContextMiddleware } from '../src/common/request-context.middleware';

const password = 'a-payment-test-password-long-enough';
const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WAAAAABJRU5ErkJggg==';

describe('WBS-06 Toss sandbox payments', () => {
  let app: INestApplication;
  const userIds: string[] = [];
  const productIds: string[] = [];
  const tradeIds: string[] = [];

  async function account(role: string) {
    const email = `payment-${role}-${randomUUID()}@example.test`;
    const signup = await request(app.getHttpServer())
      .post('/api/v1/auth/signups')
      .send({ email, password, adultConfirmed: true });
    expect(signup.status).toBe(201);
    const confirmation = await request(app.getHttpServer())
      .post('/api/v1/auth/contact-confirmations')
      .send({ identifier: email, code: signup.body.debugCode });
    expect(confirmation.status).toBe(201);
    userIds.push(confirmation.body.id);
    const agent = request.agent(app.getHttpServer());
    expect((await agent.post('/api/v1/auth/login').send({ identifier: email, password })).status).toBe(201);
    return { agent, userId: confirmation.body.id as string };
  }

  async function acceptedTrade(label: string) {
    const seller = await account(`${label}-seller`);
    const buyer = await account(`${label}-buyer`);
    const product = await seller.agent.post('/api/v1/products').send({
      title: `${label} payment product`,
      description: 'Toss sandbox payment integration fixture',
      priceKrw: '32100',
      category: 'payment-test',
      images: [{ dataBase64: image, altText: 'sandbox payment fixture' }],
    });
    expect(product.status).toBe(201);
    productIds.push(product.body.id);
    const trade = await prisma.$transaction(async (tx) => {
      const created = await tx.trade.create({
        data: {
          productId: product.body.id,
          buyerId: buyer.userId,
          sellerId: seller.userId,
          priceKrw: 32100n,
          status: 'ACCEPTED',
        },
      });
      await tx.product.update({ where: { id: product.body.id }, data: { status: 'RESERVED' } });
      await tx.tradeHistory.create({ data: { tradeId: created.id, actorId: seller.userId, fromStatus: 'REQUESTED', toStatus: 'ACCEPTED' } });
      return created;
    });
    tradeIds.push(trade.id);
    return { seller: seller.agent, buyer: buyer.agent, productId: product.body.id as string, tradeId: trade.id };
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    await prisma.neighborhood.upsert({
      where: { code: 'KR-CH-UC-SARIM' },
      update: { name: '사림동' },
      create: { code: 'KR-CH-UC-SARIM', name: '사림동' },
    });
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.use(requestContextMiddleware);
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await prisma.tradeHistory.deleteMany({ where: { tradeId: { in: tradeIds } } });
    await prisma.trade.deleteMany({ where: { id: { in: tradeIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.verificationCode.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a server-priced order, preserves first idempotent result, verifies raw webhooks, and cancels consistently', async () => {
    const { buyer, productId, tradeId } = await acceptedTrade('cancel');
    const createKey = `create-${randomUUID()}`;
    const created = await buyer
      .post('/api/v1/payments/orders')
      .set('idempotency-key', createKey)
      .send({ tradeId });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ tradeId, amountKrw: '32100', status: 'READY', settlementStatus: 'HOLD' });
    expect(created.body.orderId).toMatch(/^gm_/);

    const replayedOrder = await buyer
      .post('/api/v1/payments/orders')
      .set('idempotency-key', createKey)
      .send({ tradeId });
    expect(replayedOrder.body).toEqual(created.body);
    expect(await prisma.paymentOperation.count({ where: { idempotencyKey: createKey } })).toBe(1);

    const tampered = await buyer
      .post(`/api/v1/payments/${created.body.orderId}/confirm`)
      .set('idempotency-key', `tamper-${randomUUID()}`)
      .send({ paymentKey: `sandbox_${randomUUID()}`, orderId: created.body.orderId, amountKrw: '1' });
    expect(tampered.status).toBe(409);
    expect((await prisma.payment.findUniqueOrThrow({ where: { orderId: created.body.orderId } })).status).toBe('READY');

    const paymentKey = `sandbox_${randomUUID()}`;
    const confirmKey = `confirm-${randomUUID()}`;
    const confirmBody = { paymentKey, orderId: created.body.orderId, amountKrw: '32100' };
    const confirmed = await buyer
      .post(`/api/v1/payments/${created.body.orderId}/confirm`)
      .set('idempotency-key', confirmKey)
      .send(confirmBody);
    expect(confirmed.status).toBe(201);
    expect(confirmed.body).toMatchObject({ paymentKey, status: 'APPROVED', settlementStatus: 'HOLD' });
    const replayedConfirmation = await buyer
      .post(`/api/v1/payments/${created.body.orderId}/confirm`)
      .set('idempotency-key', confirmKey)
      .send(confirmBody);
    expect(replayedConfirmation.body).toEqual(confirmed.body);
    expect(await prisma.ledgerEntry.count({ where: { paymentId: confirmed.body.id } })).toBe(1);

    const rawWebhook = JSON.stringify({
      eventType: 'PAYMENT_STATUS_CHANGED',
      sequence: 2,
      data: { paymentKey, orderId: created.body.orderId, amountKrw: '32100', status: 'DONE' },
    });
    const transmissionId = `transmission-${randomUUID()}`;
    const webhook = await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/toss')
      .set('content-type', 'application/json')
      .set('toss-transmission-id', transmissionId)
      .send(rawWebhook);
    expect(webhook.status).toBe(202);
    expect(webhook.body).toMatchObject({ accepted: true, duplicate: false, status: 'PROCESSED' });
    expect((await prisma.paymentWebhook.findUniqueOrThrow({ where: { transmissionId } })).rawBody).toBe(rawWebhook);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/toss')
      .set('content-type', 'application/json')
      .set('toss-transmission-id', transmissionId)
      .send(rawWebhook);
    expect(duplicate.body).toMatchObject({ accepted: true, duplicate: true, status: 'PROCESSED' });
    expect(await prisma.paymentWebhook.count({ where: { transmissionId } })).toBe(1);

    const olderWebhook = JSON.stringify({
      eventType: 'PAYMENT_STATUS_CHANGED',
      sequence: 1,
      data: { paymentKey, orderId: created.body.orderId, amountKrw: '32100', status: 'DONE' },
    });
    const older = await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/toss')
      .set('content-type', 'application/json')
      .set('toss-transmission-id', `transmission-${randomUUID()}`)
      .send(olderWebhook);
    expect(older.body.status).toBe('IGNORED');

    const cancelKey = `cancel-${randomUUID()}`;
    const cancelled = await buyer
      .post(`/api/v1/payments/${created.body.orderId}/cancel`)
      .set('idempotency-key', cancelKey)
      .send({ reason: '구매자 sandbox 취소' });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', settlementStatus: 'PAUSED' });
    const replayedCancellation = await buyer
      .post(`/api/v1/payments/${created.body.orderId}/cancel`)
      .set('idempotency-key', cancelKey)
      .send({ reason: '구매자 sandbox 취소' });
    expect(replayedCancellation.body).toEqual(cancelled.body);

    const [trade, product, ledger] = await Promise.all([
      prisma.trade.findUniqueOrThrow({ where: { id: tradeId } }),
      prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      prisma.ledgerEntry.findMany({ where: { paymentId: confirmed.body.id }, orderBy: { occurredAt: 'asc' } }),
    ]);
    expect(trade.status).toBe('CANCELLED');
    expect(product.status).toBe('ACTIVE');
    expect(ledger.map((entry) => entry.entryType)).toEqual(['ESCROW_CAPTURE', 'CANCELLATION']);
    expect(ledger.reduce((sum, entry) => sum + entry.amountKrw, 0n)).toBe(0n);
    await expect(prisma.ledgerEntry.update({ where: { id: ledger[0]!.id }, data: { reason: 'mutation attempt' } })).rejects.toThrow(/append-only/);
  });

  it('records an approved payment refund and pauses settlement without losing the immutable balance trail', async () => {
    const { buyer, productId, tradeId } = await acceptedTrade('refund');
    const order = await buyer
      .post('/api/v1/payments/orders')
      .set('idempotency-key', `create-${randomUUID()}`)
      .send({ tradeId });
    const paymentKey = `sandbox_${randomUUID()}`;
    const confirmed = await buyer
      .post(`/api/v1/payments/${order.body.orderId}/confirm`)
      .set('idempotency-key', `confirm-${randomUUID()}`)
      .send({ paymentKey, orderId: order.body.orderId, amountKrw: '32100' });
    expect(confirmed.body.status).toBe('APPROVED');
    await prisma.$transaction([
      prisma.trade.update({ where: { id: tradeId }, data: { status: 'CONFIRMED', deliveredAt: new Date(), confirmedAt: new Date() } }),
      prisma.product.update({ where: { id: productId }, data: { status: 'SOLD' } }),
      prisma.tradeHistory.create({ data: { tradeId, fromStatus: 'ACCEPTED', toStatus: 'CONFIRMED', reason: 'PAYMENT_TEST_FIXTURE' } }),
    ]);

    const refunded = await buyer
      .post(`/api/v1/payments/${order.body.orderId}/refund`)
      .set('idempotency-key', `refund-${randomUUID()}`)
      .send({ reason: 'sandbox 환불 승인' });
    expect(refunded.body).toMatchObject({ status: 'REFUNDED', settlementStatus: 'PAUSED' });

    const [trade, product, ledger] = await Promise.all([
      prisma.trade.findUniqueOrThrow({ where: { id: tradeId } }),
      prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      prisma.ledgerEntry.findMany({ where: { paymentId: confirmed.body.id } }),
    ]);
    expect(trade.status).toBe('DISPUTED');
    expect(product.status).toBe('SOLD');
    expect(ledger.map((entry) => entry.entryType).sort()).toEqual(['ESCROW_CAPTURE', 'REFUND']);
    expect(ledger.reduce((sum, entry) => sum + entry.amountKrw, 0n)).toBe(0n);
  });
});
