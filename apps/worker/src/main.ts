import { Queue, Worker } from 'bullmq';
import pino from 'pino';
import { cancelExpiredUnpaidTrades, confirmDueTrades } from './trade-maintenance.js';
import { dispatchOutboxJobs, processOutboxEvent } from './payment-events.js';
import { processDueSettlements } from './settlement-maintenance.js';

const logger = pino({ redact: ['password', 'authorization', 'cookie', 'paymentKey', 'secret'] });
const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };

async function start() {
  const outboxQueue = new Queue('outbox', { connection });
  await outboxQueue.upsertJobScheduler(
    'outbox-dispatch',
    { every: 5_000 },
    { name: 'outbox:dispatch', data: {} },
  );
  const worker = new Worker('outbox', async (job) => {
    if (job.name === 'outbox:dispatch') {
      const dispatched = await dispatchOutboxJobs(async (eventId, type) => {
        await outboxQueue.add(type, { eventId }, { jobId: `event-${eventId}`, removeOnComplete: true, removeOnFail: true });
      });
      logger.info({ dispatched }, 'dispatched durable outbox events');
      return;
    }
    const eventId = String(job.data.eventId ?? '');
    if (!eventId) throw new Error('OUTBOX_EVENT_ID_REQUIRED');
    await processOutboxEvent(eventId);
    logger.info({ eventId, eventType: job.name }, 'processed outbox event');
  }, { connection });

  worker.on('failed', (job, error) => logger.error({ eventId: job?.id, err: error.message }, 'outbox job failed'));

  const maintenanceQueue = new Queue('maintenance', { connection });
  await maintenanceQueue.upsertJobScheduler(
    'trade-auto-confirm',
    { every: 60_000 },
    { name: 'trade:auto-confirm', data: {} },
  );
  await maintenanceQueue.upsertJobScheduler(
    'settlement-release',
    { every: 60_000 },
    { name: 'payment:settlement-release', data: {} },
  );

  const maintenanceWorker = new Worker('maintenance', async (job) => {
    if (job.name === 'trade:auto-confirm') {
      const [confirmationResult, expiryResult] = await Promise.all([
        confirmDueTrades(),
        cancelExpiredUnpaidTrades(),
      ]);
      logger.info(
        { confirmed: confirmationResult.confirmed, unpaidCancelled: expiryResult.cancelled },
        'processed due trade maintenance',
      );
    }
    if (job.name === 'payment:settlement-release') {
      const result = await processDueSettlements();
      logger.info(result, 'processed due settlement releases');
    }
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
