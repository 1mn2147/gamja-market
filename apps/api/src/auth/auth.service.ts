import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { prisma, UserStatus, VerificationPurpose } from '@gamja/database';
import { requestContext } from '../common/request-context.middleware.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOCK_AFTER_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: UserStatus;
  neighborhood: { code: string; name: string } | null;
};

type VerificationResult = { accepted: true; debugCode?: string };

@Injectable()
export class AuthService {
  private normalizeIdentifier(identifier: string) {
    return identifier.trim().toLowerCase();
  }

  private identifierHash(identifier: string) {
    return createHash('sha256').update(this.normalizeIdentifier(identifier)).digest('hex');
  }

  private codeHash(code: string) {
    return createHash('sha256').update(`${process.env.AUTH_CODE_PEPPER ?? ''}:${code}`).digest('hex');
  }

  private async passwordHash(password: string) {
    return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  }

  private serializeUser(user: AuthenticatedUser) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      neighborhood: user.neighborhood,
    };
  }

  private async issueCode(userId: string, identifier: string, purpose: VerificationPurpose): Promise<VerificationResult> {
    const code = randomInt(100_000, 1_000_000).toString();
    const now = new Date();
    await prisma.verificationCode.deleteMany({
      where: { identifier, purpose, consumedAt: null },
    });
    await prisma.verificationCode.create({
      data: { userId, identifier, purpose, codeHash: this.codeHash(code), expiresAt: new Date(now.getTime() + CODE_TTL_MS) },
    });
    return process.env.NODE_ENV === 'test' ? { accepted: true, debugCode: code } : { accepted: true };
  }

  private async consumeCode(identifier: string, purpose: VerificationPurpose, code: string) {
    const verification = await prisma.verificationCode.findFirst({
      where: { identifier, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!verification || verification.attempts >= LOCK_AFTER_FAILURES) throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_CODE' });
    const expected = Buffer.from(verification.codeHash, 'hex');
    const actual = Buffer.from(this.codeHash(code), 'hex');
    const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!valid) {
      await prisma.verificationCode.update({ where: { id: verification.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_CODE' });
    }
    return prisma.verificationCode.update({ where: { id: verification.id }, data: { consumedAt: new Date() } });
  }

  async signUp(input: { email?: string; phone?: string; password: string; adultConfirmed: boolean }) {
    const email = input.email ? this.normalizeIdentifier(input.email) : undefined;
    const phone = input.phone?.trim();
    if (!email && !phone) throw new BadRequestException({ code: 'CONTACT_REQUIRED' });
    if (!input.adultConfirmed) throw new BadRequestException({ code: 'ADULT_CONFIRMATION_REQUIRED' });
    const contacts = [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])];
    const existing = await prisma.user.findFirst({ where: { OR: contacts } });
    if (existing) throw new ConflictException({ code: 'CONTACT_ALREADY_REGISTERED' });
    const user = await prisma.user.create({
      data: { email: email ?? null, phone: phone ?? null, passwordHash: await this.passwordHash(input.password), isAdult: true },
    });
    return this.issueCode(user.id, email ?? phone!, VerificationPurpose.CONTACT_VERIFICATION);
  }

  async confirmContact(identifierInput: string, code: string) {
    const identifier = this.normalizeIdentifier(identifierInput);
    const verification = await this.consumeCode(identifier, VerificationPurpose.CONTACT_VERIFICATION, code);
    if (!verification.userId) throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_CODE' });
    const initialNeighborhood = await prisma.neighborhood.findUnique({ where: { code: "KR-CH-UC-SARIM" }, select: { id: true } });
    const user = await prisma.user.update({
      where: { id: verification.userId },
      data: { contactVerifiedAt: new Date(), status: UserStatus.ACTIVE, ...(initialNeighborhood ? { neighborhoodId: initialNeighborhood.id } : {}) },
      include: { neighborhood: { select: { code: true, name: true } } },
    });
    return this.serializeUser(user);
  }

  async login(identifierInput: string, password: string) {
    const identifier = this.normalizeIdentifier(identifierInput);
    const throttleKey = this.identifierHash(identifier);
    const throttle = await prisma.loginThrottle.findUnique({ where: { identifierHash: throttleKey } });
    if (throttle?.lockedUntil && throttle.lockedUntil > new Date()) throw new HttpException({ code: 'LOGIN_TEMPORARILY_LOCKED' }, HttpStatus.TOO_MANY_REQUESTS);
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifierInput.trim() }] },
      include: { neighborhood: { select: { code: true, name: true } } },
    });
    const verified = user ? await argon2.verify(user.passwordHash, password) : false;
    if (!user || !verified || user.status !== UserStatus.ACTIVE) {
      await this.recordFailure(throttleKey, throttle);
      throw new UnauthorizedException({ code: 'INVALID_LOGIN' });
    }
    await prisma.loginThrottle.deleteMany({ where: { identifierHash: throttleKey } });
    const token = randomBytes(32).toString('base64url');
    await prisma.session.create({
      data: { userId: user.id, tokenHash: this.identifierHash(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
    return { token, user: this.serializeUser(user) };
  }

  private async recordFailure(identifierHash: string, current: { failedCount: number; firstFailedAt: Date } | null) {
    const now = new Date();
    const count = current && now.getTime() - current.firstFailedAt.getTime() < LOCK_MS ? current.failedCount + 1 : 1;
    await prisma.loginThrottle.upsert({
      where: { identifierHash },
      create: { identifierHash, failedCount: count, firstFailedAt: now, lockedUntil: count >= LOCK_AFTER_FAILURES ? new Date(now.getTime() + LOCK_MS) : null },
      update: { failedCount: count, ...(count === 1 ? { firstFailedAt: now } : {}), lockedUntil: count >= LOCK_AFTER_FAILURES ? new Date(now.getTime() + LOCK_MS) : null },
    });
  }

  async getActiveSession(token: string): Promise<AuthenticatedUser | undefined> {
    const session = await prisma.session.findUnique({
      where: { tokenHash: this.identifierHash(token) },
      include: { user: { include: { neighborhood: { select: { code: true, name: true } } } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== UserStatus.ACTIVE) return undefined;
    return this.serializeUser(session.user);
  }

  async logout(token: string) {
    await prisma.session.updateMany({ where: { tokenHash: this.identifierHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async requestPasswordReset(identifierInput: string) {
    const identifier = this.normalizeIdentifier(identifierInput);
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifierInput.trim() }], status: UserStatus.ACTIVE, contactVerifiedAt: { not: null } },
    });
    return user ? this.issueCode(user.id, identifier, VerificationPurpose.PASSWORD_RESET) : { accepted: true };
  }

  async resetPassword(identifierInput: string, code: string, newPassword: string) {
    const identifier = this.normalizeIdentifier(identifierInput);
    const verification = await this.consumeCode(identifier, VerificationPurpose.PASSWORD_RESET, code);
    if (!verification.userId) throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_CODE' });
    await prisma.$transaction([
      prisma.user.update({ where: { id: verification.userId }, data: { passwordHash: await this.passwordHash(newPassword) } }),
      prisma.session.updateMany({ where: { userId: verification.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { accepted: true };
  }

  async withdraw(user: AuthenticatedUser) {
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.WITHDRAWN, withdrawnAt: now, retentionUntil: new Date(now.getTime() + RETENTION_MS) } }),
      prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }),
      prisma.auditLog.create({ data: { actorId: user.id, action: 'ACCOUNT_WITHDRAWN', targetType: 'User', targetId: user.id, requestId: requestContext.getStore()?.requestId ?? 'unavailable' } }),
    ]);
    return { status: UserStatus.WITHDRAWN, retentionUntil: new Date(now.getTime() + RETENTION_MS).toISOString() };
  }

  async setNeighborhood(userId: string, neighborhoodCode: string) {
    const neighborhood = await prisma.neighborhood.findUnique({ where: { code: neighborhoodCode }, select: { id: true } });
    if (!neighborhood) throw new ForbiddenException({ code: 'NEIGHBORHOOD_NOT_AVAILABLE' });
    return prisma.user.update({
      where: { id: userId },
      data: { neighborhoodId: neighborhood.id },
      include: { neighborhood: { select: { code: true, name: true } } },
    }).then((user) => this.serializeUser(user));
  }
}
