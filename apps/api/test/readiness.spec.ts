import { prisma } from '@gamja/database';
import { createConnection } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadinessService } from '../src/readiness.service';

vi.mock('@gamja/database', () => ({
  prisma: { $queryRaw: vi.fn() },
}));

vi.mock('node:net', () => ({
  createConnection: vi.fn(),
}));

type Handler = (...arguments_: unknown[]) => void;

function redisSocket(response: string | Error) {
  const handlers = new Map<string, Handler>();
  const socket = {
    once: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
      if (event === 'connect' && typeof response === 'string') queueMicrotask(() => handler());
      if (event === 'error' && response instanceof Error) queueMicrotask(() => handler(response));
      return socket;
    }),
    write: vi.fn(() => {
      if (typeof response === 'string') queueMicrotask(() => handlers.get('data')?.(Buffer.from(response)));
      return true;
    }),
    destroy: vi.fn(),
    end: vi.fn(),
  };
  return socket;
}

describe('WBS-09 dependency readiness', () => {
  const databaseQuery = vi.mocked(prisma.$queryRaw);
  const connect = vi.mocked(createConnection);

  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test.invalid/readiness');
    vi.stubEnv('REDIS_URL', 'redis://redis.test:6379');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it('is not ready when dependency endpoints are not configured', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('REDIS_URL', '');

    await expect(new ReadinessService().check()).resolves.toEqual({
      ready: false,
      database: 'not-configured',
      redis: 'not-configured',
    });
    expect(databaseQuery).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it('is ready only when both PostgreSQL and Redis respond', async () => {
    databaseQuery.mockResolvedValue([{ '?column?': 1 }] as never);
    connect.mockReturnValue(redisSocket('+PONG\r\n') as never);

    await expect(new ReadinessService().check()).resolves.toEqual({
      ready: true,
      database: 'ok',
      redis: 'ok',
    });
    expect(connect).toHaveBeenCalledWith({ host: 'redis.test', port: 6379 });
  });

  it('reports a database failure independently from Redis', async () => {
    databaseQuery.mockRejectedValue(new Error('database unavailable'));
    connect.mockReturnValue(redisSocket('+PONG\r\n') as never);

    await expect(new ReadinessService().check()).resolves.toEqual({
      ready: false,
      database: 'unavailable',
      redis: 'ok',
    });
  });

  it('reports an invalid Redis response independently from PostgreSQL', async () => {
    databaseQuery.mockResolvedValue([{ '?column?': 1 }] as never);
    connect.mockReturnValue(redisSocket('-NOAUTH authentication required\r\n') as never);

    await expect(new ReadinessService().check()).resolves.toEqual({
      ready: false,
      database: 'ok',
      redis: 'unavailable',
    });
  });

  it('reports a Redis connection error independently from PostgreSQL', async () => {
    databaseQuery.mockResolvedValue([{ '?column?': 1 }] as never);
    connect.mockReturnValue(redisSocket(new Error('connection refused')) as never);

    await expect(new ReadinessService().check()).resolves.toEqual({
      ready: false,
      database: 'ok',
      redis: 'unavailable',
    });
  });
});
