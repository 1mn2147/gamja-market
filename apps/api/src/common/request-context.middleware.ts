import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export function requestContextMiddleware(request: Request, response: Response, next: NextFunction) {
  const provided = request.header('x-request-id');
  const requestId = provided && /^[A-Za-z0-9_-]{8,128}$/.test(provided) ? provided : randomUUID();
  response.setHeader('x-request-id', requestId);
  requestContext.run({ requestId }, next);
}
