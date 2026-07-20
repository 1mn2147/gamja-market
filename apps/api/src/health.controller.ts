import { Controller, Get, HttpCode, Inject, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { requestContext } from './common/request-context.middleware.js';
import { ReadinessService } from './readiness.service.js';

@Controller()
export class HealthController {
  constructor(@Inject(ReadinessService) private readonly readiness: ReadinessService) {}

  @Get('healthz')
  @SkipThrottle()
  health() {
    return { status: 'ok', requestId: requestContext.getStore()?.requestId ?? 'unavailable' };
  }

  @Get('readyz')
  @SkipThrottle()
  @HttpCode(200)
  async ready() {
    const dependencies = await this.readiness.check();
    if (!dependencies.ready) {
      throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE', dependencies });
    }
    return { status: 'ok', dependencies, requestId: requestContext.getStore()?.requestId ?? 'unavailable' };
  }
}
