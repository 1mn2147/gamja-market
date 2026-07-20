import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, ProductStatus } from '@gamja/database';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { SafetyService } from '../safety/safety.service.js';

@Injectable()
export class ChatService {
  constructor(@Inject(SafetyService) private readonly safety: SafetyService) {}

  private async access(id: string, userId: string) {
    const room = await prisma.chatRoom.findFirst({
      where: { id, participants: { some: { userId } } },
      select: { id: true, buyerId: true, sellerId: true },
    });
    if (!room) throw new NotFoundException({ code: 'CHAT_NOT_FOUND' });
    const otherId = room.buyerId === userId ? room.sellerId : room.buyerId;
    if (await this.safety.isBlocked(userId, otherId)) throw new ForbiddenException({ code: 'CHAT_BLOCKED' });
    return room;
  }

  async create(productId: string, user: AuthenticatedUser) {
    const product = await prisma.product.findFirst({ where: { id: productId, status: ProductStatus.ACTIVE } });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND' });
    if (product.authorId === user.id) throw new ConflictException({ code: 'CANNOT_CHAT_ON_OWN_PRODUCT' });
    if (await this.safety.isBlocked(user.id, product.authorId)) throw new ForbiddenException({ code: 'CHAT_BLOCKED' });
    return prisma.chatRoom.upsert({ where: { productId_buyerId_sellerId: { productId, buyerId: user.id, sellerId: product.authorId } }, create: { productId, buyerId: user.id, sellerId: product.authorId, participants: { create: [{ userId: user.id }, { userId: product.authorId }] } }, update: {} });
  }

  async list(user: AuthenticatedUser) {
    const rooms = await prisma.chatRoom.findMany({ where: { participants: { some: { userId: user.id } } }, include: { product: { select: { id: true, title: true, priceKrw: true, status: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 }, participants: { where: { userId: user.id } } }, orderBy: { updatedAt: 'desc' } });
    const chats = [];
    for (const room of rooms) {
      const otherUserId = room.buyerId === user.id ? room.sellerId : room.buyerId;
      if (await this.safety.isBlocked(user.id, otherUserId)) continue;
      const lastReadAt = room.participants[0]?.lastReadAt;
      const unreadCount = await prisma.chatMessage.count({
        where: {
          chatRoomId: room.id,
          authorId: { not: user.id },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      });
      chats.push({
        id: room.id,
        otherUserId,
        product: { ...room.product, priceKrw: room.product.priceKrw.toString() },
        latestMessage: room.messages[0] ? { body: room.messages[0].body, createdAt: room.messages[0].createdAt } : null,
        unreadCount,
      });
    }
    return { chats };
  }

  async detail(id: string, user: AuthenticatedUser) {
    const viewedAt = new Date();
    await this.access(id, user.id);
    const room = await prisma.chatRoom.findUniqueOrThrow({
      where: { id },
      include: {
        product: { select: { id: true, title: true, priceKrw: true, status: true } },
        participants: true,
        messages: { where: { createdAt: { lte: viewedAt } }, orderBy: { createdAt: 'asc' }, take: 100 },
      },
    });
    await prisma.chatParticipant.update({
      where: { chatRoomId_userId: { chatRoomId: id, userId: user.id } },
      data: { lastReadAt: viewedAt },
    });
    return { ...room, product: { ...room.product, priceKrw: room.product.priceKrw.toString() } };
  }

  async send(id: string, user: AuthenticatedUser, body: string, clientMessageId?: string) {
    await this.access(id, user.id);
    const normalizedBody = body.trim();
    const messageId = clientMessageId ?? randomUUID();
    try {
      const message = await prisma.chatMessage.create({ data: { id: messageId, chatRoomId: id, authorId: user.id, body: normalizedBody } });
      await prisma.chatRoom.update({ where: { id }, data: { updatedAt: new Date() } });
      return message;
    } catch (error) {
      const existing = await prisma.chatMessage.findUnique({ where: { id: messageId } });
      if (existing && existing.chatRoomId === id && existing.authorId === user.id && existing.body === normalizedBody) return existing;
      if (existing) throw new ConflictException({ code: 'MESSAGE_ID_CONFLICT' });
      throw error;
    }
  }
}
