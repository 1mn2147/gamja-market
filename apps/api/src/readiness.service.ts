import { Injectable } from '@nestjs/common';
import { prisma } from '@gamja/database';
import { createClient } from 'redis';

function redisPing(redisUrl: string) {
  // Readiness is a bounded probe, not a long-lived Redis client. Disable the
  // default reconnect loop so an unavailable dependency produces a prompt 503
  // instead of holding the health request open indefinitely.
  const client = createClient({ url: redisUrl, socket: { connectTimeout: 2_000, reconnectStrategy: false } });
  client.on('error', () => undefined);
  return client.connect()
    .then(() => client.ping())
    .then((reply) => { if (reply !== 'PONG') throw new Error('REDIS_READY_INVALID_RESPONSE'); })
    .finally(() => client.isOpen ? client.quit() : client.destroy());
}

@Injectable()
export class ReadinessService {
  async check() {
    const databaseUrl = process.env.DATABASE_URL;
    const redisUrl = process.env.REDIS_URL;
    if (!databaseUrl || !redisUrl) return { ready: false, database: 'not-configured', redis: 'not-configured' };
    const [database, redis] = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      redisPing(redisUrl),
    ]);
    return {
      ready: database.status === 'fulfilled' && redis.status === 'fulfilled',
      database: database.status === 'fulfilled' ? 'ok' : 'unavailable',
      redis: redis.status === 'fulfilled' ? 'ok' : 'unavailable',
    };
  }
}
