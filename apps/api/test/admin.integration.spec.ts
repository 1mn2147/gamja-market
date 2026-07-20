import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { prisma } from '@gamja/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { requestContextMiddleware } from '../src/common/request-context.middleware';

const password = 'a-password-that-is-long-enough';

async function signup(app: INestApplication, email: string) {
  const response = await request(app.getHttpServer()).post('/api/v1/auth/signups')
    .send({ email, password, adultConfirmed: true });
  expect(response.status).toBe(201);
  expect((await request(app.getHttpServer()).post('/api/v1/auth/contact-confirmations')
    .send({ identifier: email, code: response.body.debugCode })).status).toBe(201);
}

describe('WBS-07 super administrator boundary', () => {
  let app: INestApplication;
  const run = Date.now();
  const adminEmail = `admin-${run}@example.test`;
  const userEmail = `managed-${run}@example.test`;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    const neighborhood = await prisma.neighborhood.findUnique({ where: { code: 'KR-CH-UC-SARIM' } });
    if (!neighborhood) await prisma.neighborhood.create({ data: { code: 'KR-CH-UC-SARIM', name: '사림동' } });
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(requestContextMiddleware);
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    await signup(app, adminEmail);
    await signup(app, userEmail);
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'SUPER_ADMIN' } });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('SEC-ADMIN-001/002: rejects ordinary users and masks administrator listings', async () => {
    const user = request.agent(app.getHttpServer());
    await user.post('/api/v1/auth/login').send({ identifier: userEmail, password });
    expect((await user.get('/api/v1/admin/overview')).status).toBe(403);

    const admin = request.agent(app.getHttpServer());
    await admin.post('/api/v1/auth/login').send({ identifier: adminEmail, password });
    const users = await admin.get('/api/v1/admin/users');
    const target = await prisma.user.findUniqueOrThrow({ where: { email: userEmail } });
    expect(users.status).toBe(200);
    const listed = users.body.users.find((item: { id: string }) => item.id === target.id) as { email: string | null };
    expect(listed.email).not.toBe(userEmail);
    expect(listed.email).toMatch(/^ma\*+@/);
  });

  it('E2E-ADMIN-004/API-AUDIT-006: requires reauthentication and audits suspension', async () => {
    const target = await prisma.user.findUniqueOrThrow({ where: { email: userEmail } });
    const admin = request.agent(app.getHttpServer());
    await admin.post('/api/v1/auth/login').send({ identifier: adminEmail, password });
    expect((await admin.post(`/api/v1/admin/users/${target.id}/suspend`).send({ reason: '운영 정책 위반', password: 'wrong-password-value' })).status).toBe(403);
    const suspended = await admin.post(`/api/v1/admin/users/${target.id}/suspend`).send({ reason: '운영 정책 위반', password });
    expect(suspended.status).toBe(201);
    expect(suspended.body.status).toBe('SUSPENDED');
    const audit = await prisma.auditLog.findFirst({ where: { targetId: target.id, action: 'USER_SUSPENDED' }, orderBy: { occurredAt: 'desc' } });
    expect(audit).toMatchObject({ actorId: expect.any(String), reason: '운영 정책 위반' });
  });
});
