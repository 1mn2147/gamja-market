import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { prisma } from '@gamja/database';
import { AppModule } from '../src/app.module';
import { requestContextMiddleware } from '../src/common/request-context.middleware';

const password = 'Orchid!Vault2026-Safe';

async function signUpAndActivate(app: INestApplication, email: string) {
  const signup = await request(app.getHttpServer())
    .post('/api/v1/auth/signups')
    .send({ email, password, adultConfirmed: true });
  expect(signup.status).toBe(201);
  expect(signup.body.debugCode).toMatch(/^\d{6}$/);
  const confirmation = await request(app.getHttpServer())
    .post('/api/v1/auth/contact-confirmations')
    .send({ identifier: email, code: signup.body.debugCode });
  expect(confirmation.status).toBe(201);
}

describe('WBS-02 account authentication API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    await prisma.auditLog.deleteMany();
    await prisma.tradeHistory.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.session.deleteMany();
    await prisma.chatMessage.deleteMany();
    await prisma.chatParticipant.deleteMany();
    await prisma.chatRoom.deleteMany();
    await prisma.block.deleteMany();
    await prisma.report.deleteMany();
    await prisma.product.deleteMany();
    await prisma.verificationCode.deleteMany();
    await prisma.loginThrottle.deleteMany();
    await prisma.user.deleteMany();
    await prisma.neighborhoodLink.deleteMany();
    await prisma.neighborhood.deleteMany({ where: { code: { not: 'KR-CH-UC-SARIM' } } });
    await prisma.neighborhood.upsert({ where: { code: 'KR-CH-UC-SARIM' }, update: { name: '사림동' }, create: { code: 'KR-CH-UC-SARIM', name: '사림동' } });
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

  it('E2E-AUTH-001: activates an adult verified account exactly once', async () => {
    const email = 'buyer-a@example.test';
    await signUpAndActivate(app, email);
    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/auth/signups')
      .send({ email, password, adultConfirmed: true });
    expect(duplicate.status).toBe(409);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.status).toBe('ACTIVE');
    expect(user.passwordHash).not.toContain(password);
  });

  it('SEC-AUTH-011: rejects weak signup passwords before creating an account', async () => {
    const weakCases = [
      { email: 'weak-lower@example.test', password: 'lowercaseonly2026!' },
      { email: 'weak-upper@example.test', password: 'UPPERCASEONLY2026!' },
      { email: 'weak-number@example.test', password: 'MissingNumber!Safe' },
      { email: 'weak-special@example.test', password: 'MissingSpecial2026Safe' },
      { email: 'weak-common@example.test', password: 'Password123!' },
      { email: 'weak-repeat@example.test', password: 'Safe!AAAA2026value' },
      { email: 'weak-sequence@example.test', password: 'Secure!abcdef2026' },
      { email: 'weak-account@example.test', password: 'Weak-Account!2026' },
    ];
    for (const weak of weakCases) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/signups')
        .send({ ...weak, adultConfirmed: true });
      expect(response.status, weak.email).toBe(400);
      expect(response.body.code, weak.email).toBe('WEAK_PASSWORD');
    }
    expect(await prisma.user.count({ where: { email: { startsWith: 'weak-' } } })).toBe(0);
  });

  it('API-AUTH-010: resumes an interrupted pending signup only with the original password', async () => {
    const email = `pending-${Date.now()}@example.test`;
    const first = await request(app.getHttpServer())
      .post('/api/v1/auth/signups')
      .send({ email, password, adultConfirmed: true });
    expect(first.status).toBe(201);

    const resumed = await request(app.getHttpServer())
      .post('/api/v1/auth/signups')
      .send({ email: email.toUpperCase(), password, adultConfirmed: true });
    expect(resumed.status).toBe(201);
    expect(resumed.body.debugCode).toMatch(/^\d{6}$/);

    const rejected = await request(app.getHttpServer())
      .post('/api/v1/auth/signups')
      .send({ email, password: 'Different!Credential2026-Safe', adultConfirmed: true });
    expect(rejected.status).toBe(409);
  });

  it('API-AUTH-003 and API-AUTH-006: creates an opaque session and revokes it on withdrawal', async () => {
    const email = 'withdrawal@example.test';
    await signUpAndActivate(app, email);
    const agent = request.agent(app.getHttpServer());
    const login = await agent.post('/api/v1/auth/login').send({ identifier: email, password });
    expect(login.status).toBe(201);
    expect(login.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(login.body).not.toHaveProperty('token');
    expect(login.headers['set-cookie']?.[0]).not.toContain(password);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
    const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WAAAAABJRU5ErkJggg==';
    const product = await agent.post('/api/v1/products').send({
      title: '탈퇴 시 숨김 상품',
      description: '탈퇴 계정의 판매중 상품 노출 차단 검증',
      priceKrw: '5000',
      category: '탈퇴 테스트',
      images: [{ dataBase64: image, altText: '탈퇴 테스트 사진' }],
    });
    expect(product.status).toBe(201);
    const withdrawal = await agent.post('/api/v1/auth/me/withdrawal');
    expect(withdrawal.status).toBe(201);
    expect(withdrawal.body).toMatchObject({ status: 'WITHDRAWN', hiddenProductCount: 1 });
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/login').send({ identifier: email, password })).status).toBe(401);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.body.id as string } })).status).toBe('HIDDEN');
    expect((await request(app.getHttpServer()).get(`/api/v1/products/${product.body.id}`)).status).toBe(404);
  });

  it('E2E-ITEM-001 through API-SEARCH-005: creates, protects, searches, locks, and hides a product', async () => {
    const seller = request.agent(app.getHttpServer());
    expect((await seller.post('/api/v1/auth/login').send({ identifier: 'buyer-a@example.test', password })).status).toBe(201);
    const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WAAAAABJRU5ErkJggg==';
    const created = await seller.post('/api/v1/products').send({ title: '감자 판매', description: '사림동에서 상태 좋은 감자입니다.', priceKrw: '12000', category: '식품', images: [{ dataBase64: image, altText: '판매할 감자 사진' }] });
    expect(created.status).toBe(201);
    expect(created.body.neighborhood).toEqual({ code: 'KR-CH-UC-SARIM', name: '사림동' });
    expect(created.body.images).toHaveLength(1);
    const productId = created.body.id as string;
    const search = await request(app.getHttpServer()).get('/api/v1/products?query=%EA%B0%90%EC%9E%90&category=%EC%8B%9D%ED%92%88');
    expect(search.status).toBe(200);
    expect(search.body.products.map((product: { id: string }) => product.id)).toContain(productId);
    const partialSearch = await request(app.getHttpServer()).get('/api/v1/products?query=%EC%9E%90%20%ED%8C%90');
    expect(partialSearch.status).toBe(200);
    expect(partialSearch.body.products.map((product: { id: string }) => product.id)).toContain(productId);
    const imageResponse = await request(app.getHttpServer()).get(created.body.images[0].url);
    expect(imageResponse.status).toBe(200);
    expect(imageResponse.headers['content-type']).toContain('image/png');
    await signUpAndActivate(app, 'other-owner@example.test');
    const other = request.agent(app.getHttpServer());
    expect((await other.post('/api/v1/auth/login').send({ identifier: 'other-owner@example.test', password })).status).toBe(201);
    expect((await other.patch(`/api/v1/products/${productId}`).send({ title: '변조' })).status).toBe(404);
    await prisma.product.update({ where: { id: productId }, data: { status: 'RESERVED' } });
    expect((await seller.patch(`/api/v1/products/${productId}`).send({ priceKrw: '1' })).status).toBe(409);
    await prisma.product.update({ where: { id: productId }, data: { status: 'ACTIVE' } });
    expect((await seller.patch(`/api/v1/products/${productId}/status`).send({ status: 'HIDDEN' })).status).toBe(200);
    const hiddenSearch = await request(app.getHttpServer()).get('/api/v1/products?query=%EA%B0%90%EC%9E%90');
    expect(hiddenSearch.body.products.map((product: { id: string }) => product.id)).not.toContain(productId);
    expect((await request(app.getHttpServer()).get(`/api/v1/products/${productId}`)).status).toBe(404);
    expect((await other.get(`/api/v1/products/${productId}`)).status).toBe(404);
    const ownerDetail = await seller.get(`/api/v1/products/${productId}`);
    expect(ownerDetail.status).toBe(200);
    expect(ownerDetail.body).toMatchObject({ id: productId, status: 'HIDDEN' });
    expect((await seller.delete(`/api/v1/products/${productId}`)).status).toBe(204);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).status).toBe('DELETED');
    expect((await seller.get('/api/v1/products/me')).body.products.map((product: { id: string }) => product.id)).not.toContain(productId);
  });

  it('API-SEARCH-005: continues cursor pagination without dropping the boundary product', async () => {
    const author = await prisma.user.findUniqueOrThrow({ where: { email: 'buyer-a@example.test' } });
    const neighborhood = await prisma.neighborhood.findUniqueOrThrow({ where: { code: 'KR-CH-UC-SARIM' } });
    const category = 'cursor-regression';
    for (let index = 0; index < 11; index += 1) {
      await prisma.product.create({
        data: {
          authorId: author.id,
          neighborhoodId: neighborhood.id,
          title: `cursor product ${index}`,
          description: 'cursor pagination regression fixture',
          priceKrw: BigInt(index + 1),
          category,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        },
      });
    }

    const first = await request(app.getHttpServer()).get(`/api/v1/products?category=${category}&limit=10`);
    expect(first.status).toBe(200);
    expect(first.body.products).toHaveLength(10);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await request(app.getHttpServer()).get(`/api/v1/products?category=${category}&limit=10&cursor=${encodeURIComponent(first.body.nextCursor)}`);
    expect(second.status).toBe(200);
    expect(second.body.products).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();

    const ids = [...first.body.products, ...second.body.products].map((product: { id: string }) => product.id);
    expect(new Set(ids)).toHaveProperty('size', 11);
  });

  it('SEC-AUTH-004: temporarily locks repeated failed logins without exposing account state', async () => {
    const email = 'locked@example.test';
    await signUpAndActivate(app, email);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await request(app.getHttpServer()).post('/api/v1/auth/login').send({ identifier: email, password: 'wrong-password-value' })).status).toBe(401);
    }
    const locked = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ identifier: email, password });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('LOGIN_TEMPORARILY_LOCKED');
  });

  it('API-REGION-001: exposes only the initial Sarim-dong service area', async () => {
    const neighborhoods = await request(app.getHttpServer()).get('/api/v1/neighborhoods');
    expect(neighborhoods.status).toBe(200);
    expect(neighborhoods.body.neighborhoods).toEqual([{ code: 'KR-CH-UC-SARIM', name: '사림동' }]);
    const nearby = await request(app.getHttpServer()).get('/api/v1/neighborhoods/KR-CH-UC-SARIM/nearby');
    expect(nearby.body.neighborhoods).toEqual([{ code: 'KR-CH-UC-SARIM', name: '사림동' }]);
    const agent = request.agent(app.getHttpServer());
    expect((await agent.post('/api/v1/auth/login').send({ identifier: 'buyer-a@example.test', password })).status).toBe(201);
    const update = await agent.patch('/api/v1/auth/me/neighborhood').send({ neighborhoodCode: 'KR-CH-UC-SARIM' });
    expect(update.status).toBe(200);
    expect(update.body.neighborhood).toEqual({ code: 'KR-CH-UC-SARIM', name: '사림동' });
  });

  it('E2E-AUTH-005: resets a verified account password and invalidates prior sessions', async () => {
    const email = 'reset@example.test';
    const newPassword = 'Fresh!Credential2027-Safe';
    await signUpAndActivate(app, email);
    const agent = request.agent(app.getHttpServer());
    expect((await agent.post('/api/v1/auth/login').send({ identifier: email, password })).status).toBe(201);
    const reset = await request(app.getHttpServer()).post('/api/v1/auth/password-resets').send({ identifier: email });
    expect(reset.status).toBe(202);
    expect(reset.body.debugCode).toMatch(/^\d{6}$/);
    const weakReset = await request(app.getHttpServer())
      .post('/api/v1/auth/password-resets/confirm')
      .send({ identifier: email, code: reset.body.debugCode, newPassword: 'Password123!' });
    expect(weakReset.status).toBe(400);
    expect(weakReset.body.code).toBe('WEAK_PASSWORD');
    expect((await request(app.getHttpServer())
      .post('/api/v1/auth/password-resets/confirm')
      .send({ identifier: email, code: reset.body.debugCode, newPassword })).status).toBe(204);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app.getHttpServer()).post('/api/v1/auth/login').send({ identifier: email, password: newPassword })).status).toBe(201);
  });
  it("E2E-CHAT-001: blocks chat access immediately", async () => {
    await signUpAndActivate(app, "chat-seller@example.test"); await signUpAndActivate(app, "chat-buyer@example.test");
    const seller = request.agent(app.getHttpServer()); const buyer = request.agent(app.getHttpServer());
    await seller.post("/api/v1/auth/login").send({ identifier: "chat-seller@example.test", password }); await buyer.post("/api/v1/auth/login").send({ identifier: "chat-buyer@example.test", password });
    const image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WAAAAABJRU5ErkJggg==";
    const product = await seller.post("/api/v1/products").send({ title: "chat item", description: "blocked chat test", priceKrw: "1000", category: "test", images: [{ dataBase64: image, altText: "test" }] });
    const chat = await buyer.post(`/api/v1/products/${product.body.id}/chats`); expect(chat.status).toBe(201);
    expect((await buyer.post(`/api/v1/chats/${chat.body.id}/messages`).send({ body: "hello" })).status).toBe(201);
    const sellerUser = await prisma.user.findUniqueOrThrow({ where: { email: "chat-seller@example.test" } });
    expect((await buyer.post("/api/v1/blocks").send({ userId: sellerUser.id })).status).toBe(201);
    expect((await buyer.get(`/api/v1/chats/${chat.body.id}`)).status).toBe(403);
    expect((await buyer.post(`/api/v1/chats/${chat.body.id}/messages`).send({ body: "blocked" })).status).toBe(403);
  });
});
