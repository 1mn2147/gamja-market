import { Injectable } from '@nestjs/common';
import { prisma } from '@gamja/database';
import { createConnection } from 'node:net';

function redisPing(redisUrl: string) {
  const url = new URL(redisUrl);
  const port = Number(url.port || 6379);
  return new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: url.hostname, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('REDIS_READY_TIMEOUT'));
    }, 2_000);
    socket.once('connect', () => socket.write('*1\r\n$4\r\nPING\r\n'));
    socket.once('data', (data) => {
      clearTimeout(timeout);
      socket.end();
      if (data.toString().startsWith('+PONG')) resolve();
      else reject(new Error('REDIS_READY_INVALID_RESPONSE'));
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
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
