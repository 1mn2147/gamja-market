import { Queue, Worker } from 'bullmq';
import pino from 'pino';
import { confirmDueTrades } from './trade-maintenance.js';

const logger = pino({ redact: ['password', 'authorization', 'cookie', 'paymentKey', 'secret'] });
const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };

async function start() {
  const worker = new Worker('outbox', async (job) => {
    logger.info({ eventId: job.id, eventType: job.name }, 'received outbox event');
  }, { connection });

  worker.on('failed', (job, error) => logger.error({ eventId: job?.id, err: error.message }, 'outbox job failed'));

  const maintenanceQueue = new Queue('maintenance', { connection });
  await maintenanceQueue.upsertJobScheduler(
    'trade-auto-confirm',
    { every: 60_000 },
    { name: 'trade:auto-confirm', data: {} },
  );

  const maintenanceWorker = new Worker('maintenance', async (job) => {
    if (job.name !== 'trade:auto-confirm') return;
    const result = await confirmDueTrades();
    logger.info({ confirmed: result.confirmed }, 'processed due trade confirmations');
  }, { connection });

  maintenanceWorker.on('failed', (job, error) => {
    logger.error({ maintenanceJobId: job?.id, err: error.message }, 'maintenance job failed');
  });

  logger.info('worker started');
}

void start().catch((error: unknown) => {
  logger.fatal({ err: error instanceof Error ? error.message : String(error) }, 'worker failed to start');
  process.exitCode = 1;
});
