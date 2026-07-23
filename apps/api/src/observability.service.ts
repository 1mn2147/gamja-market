import { Injectable, LoggerService } from '@nestjs/common';
import pino from 'pino';
import { metrics } from '@opentelemetry/api';
import { OutboxStatus, SettlementStatus, prisma } from '@gamja/database';
import { requestContext } from './common/request-context.middleware.js';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['password', '*.password', 'authorization', 'cookie', 'set-cookie', 'paymentKey', 'secret', '*.secret'],
    censor: '[REDACTED]',
  },
});

@Injectable()
export class ObservabilityService implements LoggerService {
  constructor() {
    const meter = metrics.getMeter('gamja-api');
    meter.createObservableGauge('gamja_outbox_pending_events').addCallback(async (result) => {
      result.observe(await prisma.outboxEvent.count({ where: { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] } } }));
    });
    meter.createObservableGauge('gamja_payment_reconciliation_mismatches').addCallback(async (result) => {
      result.observe(await prisma.payment.count({ where: { failureCode: 'RECONCILIATION_MISMATCH' } }));
    });
    meter.createObservableGauge('gamja_settlement_failures').addCallback(async (result) => {
      result.observe(await prisma.payment.count({ where: { settlementStatus: SettlementStatus.FAILED } }));
    });
  }
  log(message: unknown) { logger.info({ requestId: requestContext.getStore()?.requestId, message }); }
  error(message: unknown, trace?: string) { logger.error({ requestId: requestContext.getStore()?.requestId, trace, message }); }
  warn(message: unknown) { logger.warn({ requestId: requestContext.getStore()?.requestId, message }); }
  debug(message: unknown) { logger.debug({ requestId: requestContext.getStore()?.requestId, message }); }
  verbose(message: unknown) { logger.trace({ requestId: requestContext.getStore()?.requestId, message }); }
}
