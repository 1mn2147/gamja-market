import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService, type AuthenticatedUser } from './auth.service.js';

type SessionRequest = Request & { user?: AuthenticatedUser; sessionToken?: string };
const OPTIONAL_SESSION = 'optionalSession';

export const OptionalSession = () => SetMetadata(OPTIONAL_SESSION, true);

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  return header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const token = readCookie(request.headers.cookie, 'gm_session');
    const user = token ? await this.authService.getActiveSession(token) : undefined;
    if (!token || !user) {
      const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_SESSION, [context.getHandler(), context.getClass()]);
      if (optional) return true;
      throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
    }
    request.user = user;
    request.sessionToken = token;
    return true;
  }
}

export type AuthenticatedRequest = SessionRequest & { user: AuthenticatedUser; sessionToken: string };
