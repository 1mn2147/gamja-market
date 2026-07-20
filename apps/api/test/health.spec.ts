import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { requestContextMiddleware } from '../src/common/request-context.middleware';
import { HealthController } from '../src/health.controller';
import { ReadinessService } from '../src/readiness.service';

describe('health endpoints', () => {
  let app: INestApplication;
  const check = vi.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: ReadinessService, useValue: { check } }],
    }).compile();
    Reflect.set(module.get(HealthController), 'readiness', { check });
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(requestContextMiddleware);
    await app.init();
  });

  beforeEach(() => {
    check.mockReset();
  });

  afterAll(async () => app.close());

  it('returns a request-correlated liveness response without dependency checks', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/healthz').set('x-request-id', 'health-test-123');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', requestId: 'health-test-123' });
    expect(check).not.toHaveBeenCalled();
  });

  it('returns dependency state for a ready instance', async () => {
    check.mockResolvedValue({ ready: true, database: 'ok', redis: 'ok' });
    const response = await request(app.getHttpServer()).get('/api/v1/readyz').set('x-request-id', 'ready-test-123');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      dependencies: { ready: true, database: 'ok', redis: 'ok' },
      requestId: 'ready-test-123',
    });
  });

  it('returns 503 and dependency details for an unready instance', async () => {
    check.mockResolvedValue({ ready: false, database: 'unavailable', redis: 'ok' });
    const response = await request(app.getHttpServer()).get('/api/v1/readyz');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      dependencies: { ready: false, database: 'unavailable', redis: 'ok' },
    });
  });
});
