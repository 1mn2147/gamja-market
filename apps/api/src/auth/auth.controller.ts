import { Body, Controller, Inject, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { ContactConfirmationDto, LoginDto, PasswordResetConfirmDto, PasswordResetRequestDto, SignUpDto, UpdateNeighborhoodDto } from './auth.dto.js';
import { AuthenticatedRequest, SessionGuard } from './session.guard.js';

const SESSION_COOKIE = 'gm_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  private sessionCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: SESSION_TTL_MS,
    };
  }

  @Post('signups')
  signUp(@Body() body: SignUpDto) {
    return this.authService.signUp(body);
  }

  @Post('contact-confirmations')
  confirmContact(@Body() body: ContactConfirmationDto) {
    return this.authService.confirmContact(body.identifier, body.code);
  }

  @Post('login')
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(body.identifier, body.password);
    response.cookie(SESSION_COOKIE, result.token, this.sessionCookieOptions());
    return { user: result.user };
  }

  @Post('logout')
  @UseGuards(SessionGuard)
  @HttpCode(204)
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(request.sessionToken);
    response.clearCookie(SESSION_COOKIE, this.sessionCookieOptions());
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.user };
  }

  @Post('password-resets')
  @HttpCode(202)
  requestPasswordReset(@Body() body: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(body.identifier);
  }

  @Post('password-resets/confirm')
  @HttpCode(204)
  async confirmPasswordReset(@Body() body: PasswordResetConfirmDto) {
    await this.authService.resetPassword(body.identifier, body.code, body.newPassword);
  }

  @Patch('me/neighborhood')
  @UseGuards(SessionGuard)
  setNeighborhood(@Req() request: AuthenticatedRequest, @Body() body: UpdateNeighborhoodDto) {
    return this.authService.setNeighborhood(request.user.id, body.neighborhoodCode);
  }

  @Post('me/withdrawal')
  @UseGuards(SessionGuard)
  async withdraw(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.withdraw(request.user);
    response.clearCookie(SESSION_COOKIE, this.sessionCookieOptions());
    return result;
  }
}
