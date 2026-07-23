import { prisma } from '@gamja/database';
import { createClient } from 'redis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadinessService } from '../src/readiness.service';

const redis = vi.hoisted(() => ({
  client: {
    connect: vi.fn(),
    ping: vi.fn(),
    quit: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    isOpen: true,
  },
}));

vi.mock('@gamja/database', () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock('redis', () => ({ createClient: vi.fn(() => redis.client) }));

describe('WBS-09 dependency readiness', () => {
  const databaseQuery = vi.mocked(prisma.$queryRaw);
  const createRedisClient = vi.mocked(createClient);

  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test.invalid/readiness');
    vi.stubEnv('REDIS_URL', 'rediss://user:secret@redis.test:6380');
    redis.client.connect.mockResolvedValue(undefined);
    redis.client.ping.mockResolvedValue('PONG');
    redis.client.quit.mockResolvedValue('OK');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it('is not ready when dependency endpoints are not configured', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('REDIS_URL', '');
    await expect(new ReadinessService().check()).resolves.toEqual({ ready: false, database: 'not-configured', redis: 'not-configured' });
    expect(databaseQuery).not.toHaveBeenCalled();
    expect(createRedisClient).not.toHaveBeenCalled();
  });

  it('is ready only when PostgreSQL and authenticated TLS Redis respond', async () => {
    databaseQuery.mockResolvedValue([{ '?column?': 1 }] as never);
    await expect(new ReadinessService().check()).resolves.toEqual({ ready: true, database: 'ok', redis: 'ok' });
    expect(createRedisClient).toHaveBeenCalledWith({
      url: 'rediss://user:secret@redis.test:6380',
      socket: { connectTimeout: 2_000, reconnectStrategy: false },
    });
  });

  it('reports a database failure independently from Redis', async () => {
    databaseQuery.mockRejectedValue(new Error('database unavailable'));
    await expect(new ReadinessService().check()).resolves.toEqual({ ready: false, database: 'unavailable', redis: 'ok' });
  });

  it('reports an invalid Redis response independently from PostgreSQL', async () => {
    databaseQuery.mockResolvedValue([{ '?column?': 1 }] as never);
    redis.client.ping.mockResolvedValue('NOAUTH');
    await expect(new ReadinessService().check()).resolves.toEqual({ ready: false, database: 'ok', redis: 'unavailable' });
  });

  it('reports a Redis connection error independently from PostgreSQL', async () => {
    databaseQuery.mockResolvedValue([{ '?column?': 1 }] as never);
    redis.client.connect.mockRejectedValue(new Error('connection refused'));
    await expect(new ReadinessService().check()).resolves.toEqual({ ready: false, database: 'ok', redis: 'unavailable' });
  });
});
