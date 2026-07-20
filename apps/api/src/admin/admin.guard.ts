import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session.guard.js';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException({ code: 'SUPER_ADMIN_REQUIRED' });
    }
    return true;
  }
}
