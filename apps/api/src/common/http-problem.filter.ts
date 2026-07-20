import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { requestContext } from './request-context.middleware.js';

@Catch()
export class HttpProblemFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const code = typeof body === 'object' && body && 'code' in body && typeof body.code === 'string'
      ? body.code
      : status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
    response.status(status).type('application/problem+json').send({
      type: `https://api.gamja-market.example/problems/${code.toLowerCase()}`,
      title: status === 500 ? 'Internal server error' : 'Request failed',
      status,
      code,
      requestId: requestContext.getStore()?.requestId ?? 'unavailable',
    });
  }
}
