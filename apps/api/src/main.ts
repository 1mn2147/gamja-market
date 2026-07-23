import './telemetry.js';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpProblemFilter } from './common/http-problem.filter.js';
import { requestContextMiddleware } from './common/request-context.middleware.js';
import { ObservabilityService } from './observability.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, rawBody: true });
  // Product images are sent as base64 JSON. Five 5 MiB images expand to about
  // 33.4 MiB while encoded, so the Express default 100 KiB limit rejects normal
  // product photos before the DTO and magic-byte validation can run.
  app.useBodyParser('json', { limit: '36mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
  app.useLogger(app.get(ObservabilityService));
  app.setGlobalPrefix('api/v1');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(requestContextMiddleware);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpProblemFilter());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT ?? 4000));
}

void bootstrap();
