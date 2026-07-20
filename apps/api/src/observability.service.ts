import { Injectable, LoggerService } from '@nestjs/common';
import pino from 'pino';
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
  log(message: unknown) { logger.info({ requestId: requestContext.getStore()?.requestId, message }); }
  error(message: unknown, trace?: string) { logger.error({ requestId: requestContext.getStore()?.requestId, trace, message }); }
  warn(message: unknown) { logger.warn({ requestId: requestContext.getStore()?.requestId, message }); }
  debug(message: unknown) { logger.debug({ requestId: requestContext.getStore()?.requestId, message }); }
  verbose(message: unknown) { logger.trace({ requestId: requestContext.getStore()?.requestId, message }); }
}
