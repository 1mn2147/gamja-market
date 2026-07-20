import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { prisma } from '@gamja/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { requestContextMiddleware } from '../src/common/request-context.middleware';
import { TradeService } from '../src/trades/trade.service';

const password = 'a-password-that-is-long-enough';
const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WAAAAABJRU5ErkJggg==';

async function signUpAndLogin(app: INestApplication, email: string) {
  const signup = await request(app.getHttpServer())
    .post('/api/v1/auth/signups')
    .send({ email, password, adultConfirmed: true });
  expect(signup.status).toBe(201);
  expect((await request(app.getHttpServer())
    .post('/api/v1/auth/contact-confirmations')
    .send({ identifier: email, code: signup.body.debugCode })).status).toBe(201);
  const agent = request.agent(app.getHttpServer());
  expect((await agent.post('/api/v1/auth/login').send({ identifier: email, password })).status).toBe(201);
  return agent;
}

async function createProduct(agent: ReturnType<typeof request.agent>, title: string) {
  const response = await agent.post('/api/v1/products').send({
    title,
    description: '거래 상태 머신 통합 테스트 상품',
    priceKrw: '15000',
    category: '통합 테스트',
    images: [{ dataBase64: image, altText: '거래 테스트 상품 사진' }],
  });
  expect(response.status).toBe(201);
  return response.body as { id: string };
}

describe('WBS-05 trade state machine API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    await prisma.tradeHistory.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.session.deleteMany();
    await prisma.chatMessage.deleteMany();
    await prisma.chatParticipant.deleteMany();
    await prisma.chatRoom.deleteMany();
    await prisma.block.deleteMany();
    await prisma.report.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.verificationCode.deleteMany();
    await prisma.loginThrottle.deleteMany();
    await prisma.user.deleteMany();
    await prisma.neighborhoodLink.deleteMany();
    await prisma.neighborhood.deleteMany();
    await prisma.neighborhood.create({ data: { code: 'KR-CH-UC-SARIM', name: '사림동' } });

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(requestContextMiddleware);
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('E2E-TRADE-001/003/005: enforces roles and records request through confirmation', async () => {
    const seller = await signUpAndLogin(app, 'trade-seller@example.test');
    const buyer = await signUpAndLogin(app, 'trade-buyer@example.test');
    const outsider = await signUpAndLogin(app, 'trade-outsider@example.test');
    const product = await createProduct(seller, '상태 머신 상품');

    const requested = await buyer.post('/api/v1/trades').send({ productId: product.id });
    expect(requested.status).toBe(201);
    expect(requested.body).toMatchObject({ status: 'REQUESTED', priceKrw: '15000', role: 'BUYER' });
    const tradeId = requested.body.id as string;

    expect((await outsider.get(`/api/v1/trades/${tradeId}`)).status).toBe(404);
    expect((await buyer.post(`/api/v1/trades/${tradeId}/accept`)).status).toBe(404);

    const accepted = await seller.post(`/api/v1/trades/${tradeId}/accept`);
    expect(accepted.body.status).toBe('ACCEPTED');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe('RESERVED');

    const delivered = await seller.post(`/api/v1/trades/${tradeId}/deliver`);
    expect(delivered.body.status).toBe('DELIVERED');
    expect(new Date(delivered.body.autoConfirmAt).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);

    const confirmed = await buyer.post(`/api/v1/trades/${tradeId}/confirm`);
    expect(confirmed.body.status).toBe('CONFIRMED');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe('SOLD');

    const detail = await buyer.get(`/api/v1/trades/${tradeId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.history.map((item: { toStatus: string }) => item.toStatus))
      .toEqual(['REQUESTED', 'ACCEPTED', 'DELIVERED', 'CONFIRMED']);
  });

  it('SEC-TRADE-002 and UT-TIME-006: blocks unsafe requests and confirms due deliveries once', async () => {
    const seller = await signUpAndLogin(app, 'blocked-seller@example.test');
    const blockedBuyer = await signUpAndLogin(app, 'blocked-buyer@example.test');
    const sellerUser = await prisma.user.findUniqueOrThrow({ where: { email: 'blocked-seller@example.test' } });
    const product = await createProduct(seller, '차단 거래 상품');
    expect((await blockedBuyer.post('/api/v1/blocks').send({ userId: sellerUser.id })).status).toBe(201);
    expect((await blockedBuyer.post('/api/v1/trades').send({ productId: product.id })).status).toBe(403);

    const buyer = await signUpAndLogin(app, 'auto-buyer@example.test');
    const autoProduct = await createProduct(seller, '자동 확정 상품');
    const requested = await buyer.post('/api/v1/trades').send({ productId: autoProduct.id });
    await seller.post(`/api/v1/trades/${requested.body.id}/accept`);
    await seller.post(`/api/v1/trades/${requested.body.id}/deliver`);
    await prisma.trade.update({ where: { id: requested.body.id }, data: { autoConfirmAt: new Date(Date.now() - 1) } });

    const trades = app.get(TradeService);
    expect(await trades.processDueAutoConfirmations()).toEqual({ confirmed: 1 });
    expect(await trades.processDueAutoConfirmations()).toEqual({ confirmed: 0 });
    expect((await prisma.trade.findUniqueOrThrow({ where: { id: requested.body.id } })).status).toBe('CONFIRMED');
  });
});
