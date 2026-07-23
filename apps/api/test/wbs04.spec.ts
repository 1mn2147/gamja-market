import { ConflictException, HttpException } from '@nestjs/common';
import { prisma, UserStatus } from '@gamja/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../src/auth/auth.service';
import { ChatGateway } from '../src/chats/chat.gateway';
import { ChatService } from '../src/chats/chat.service';
import { SafetyService } from '../src/safety/safety.service';

const user: AuthenticatedUser = {
  id: 'user-a',
  email: 'user-a@example.test',
  phone: null,
  role: 'USER',
  status: UserStatus.ACTIVE,
  neighborhood: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WBS-04 chat behavior', () => {
  it('returns the original message when a client retries the same message id', async () => {
    const safety = { isBlocked: vi.fn().mockResolvedValue(false) };
    const service = new ChatService(safety as unknown as SafetyService);
    vi.spyOn(prisma.chatRoom, 'findFirst').mockResolvedValue({ id: 'chat-a', buyerId: user.id, sellerId: 'user-b' } as never);
    vi.spyOn(prisma.chatMessage, 'create').mockRejectedValue({ code: 'P2002' });
    const original = {
      id: '93f20f9a-6bab-4e41-b5fa-bb93c9e237fd',
      chatRoomId: 'chat-a',
      authorId: user.id,
      body: '안녕하세요',
      createdAt: new Date(),
    };
    vi.spyOn(prisma.chatMessage, 'findUnique').mockResolvedValue(original);
    const update = vi.spyOn(prisma.chatRoom, 'update');

    await expect(service.send('chat-a', user, ' 안녕하세요 ', original.id)).resolves.toBe(original);
    expect(update).not.toHaveBeenCalled();
  });

  it('counts only unread messages for visible chat rooms', async () => {
    const safety = { isBlocked: vi.fn().mockResolvedValue(false) };
    const service = new ChatService(safety as unknown as SafetyService);
    const lastReadAt = new Date('2026-07-18T00:00:00.000Z');
    vi.spyOn(prisma.chatRoom, 'findMany').mockResolvedValue([{
      id: 'chat-a',
      buyerId: user.id,
      sellerId: 'user-b',
      product: { id: 'product-a', title: '감자', priceKrw: 10_000n, status: 'ACTIVE' },
      messages: [],
      participants: [{ lastReadAt }],
    }] as never);
    const count = vi.spyOn(prisma.chatMessage, 'count').mockResolvedValue(3);

    const result = await service.list(user);

    expect(result.chats[0]?.unreadCount).toBe(3);
    expect(count).toHaveBeenCalledWith({
      where: {
        chatRoomId: 'chat-a',
        authorId: { not: user.id },
        createdAt: { gt: lastReadAt },
      },
    });
  });
});

describe('WBS-04 live chat gateway', () => {
  it('restores visible room subscriptions and forwards the stable client message id', async () => {
    const auth = { getActiveSession: vi.fn().mockResolvedValue(user) };
    const sent = { id: '93f20f9a-6bab-4e41-b5fa-bb93c9e237fd', body: '안녕하세요', createdAt: new Date() };
    const chats = {
      list: vi.fn().mockResolvedValue({ chats: [{ id: 'chat-a' }] }),
      detail: vi.fn(),
      send: vi.fn().mockResolvedValue(sent),
    };
    const safety = { onRelationshipChanged: vi.fn() };
    const broadcast = { emit: vi.fn() };
    const gateway = new ChatGateway(auth as never, chats as never, safety as never);
    gateway.server = { sockets: new Map(), to: vi.fn().mockReturnValue(broadcast) } as never;
    const socket = {
      handshake: { headers: { cookie: 'gm_session=session-token' } },
      data: {},
      rooms: new Set(['socket-a']),
      join: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };

    await gateway.handleConnection(socket as never);
    await gateway.send(socket as never, { chatId: 'chat-a', body: '안녕하세요', clientMessageId: sent.id });

    expect(socket.join).toHaveBeenCalledWith(['chat:chat-a']);
    expect(chats.send).toHaveBeenCalledWith('chat-a', user, '안녕하세요', sent.id);
    expect(broadcast.emit).toHaveBeenCalledWith('chat:message', sent);
  });

  it('subscribes both participants and announces a newly opened chat', async () => {
    const auth = { getActiveSession: vi.fn().mockResolvedValue(user) };
    const chats = {
      list: vi.fn(),
      detail: vi.fn().mockResolvedValue({ buyerId: user.id, sellerId: 'user-b' }),
      send: vi.fn(),
    };
    const safety = { onRelationshipChanged: vi.fn() };
    const broadcast = { emit: vi.fn() };
    const socketsJoin = vi.fn();
    const gateway = new ChatGateway(auth as never, chats as never, safety as never);
    gateway.server = {
      in: vi.fn().mockReturnValue({ socketsJoin }),
      to: vi.fn().mockReturnValue(broadcast),
    } as never;
    const socket = {
      data: { sessionToken: 'session-token' },
      join: vi.fn(),
      disconnect: vi.fn(),
    };

    await expect(gateway.join(socket as never, { chatId: 'chat-a' })).resolves.toEqual({ chatId: 'chat-a' });
    expect(socketsJoin).toHaveBeenCalledWith('chat:chat-a');
    expect(broadcast.emit).toHaveBeenCalledWith('chat:created', { chatId: 'chat-a' });
  });
});

describe('WBS-04 safety behavior', () => {
  it('publishes block and unblock changes so live chat subscriptions can update immediately', async () => {
    const service = new SafetyService();
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 'user-b' } as never);
    vi.spyOn(prisma.block, 'upsert').mockResolvedValue({} as never);
    vi.spyOn(prisma.block, 'deleteMany').mockResolvedValue({ count: 1 });
    const changes: Array<{ action: string; userIds: [string, string] }> = [];
    service.onRelationshipChanged((change) => changes.push(change));

    await service.block(user, 'user-b');
    await service.unblock(user, 'user-b');

    expect(changes).toEqual([
      { action: 'blocked', userIds: [user.id, 'user-b'] },
      { action: 'unblocked', userIds: [user.id, 'user-b'] },
    ]);
  });

  it('maps only unique constraint failures to duplicate reports', async () => {
    const service = new SafetyService();
    vi.spyOn(prisma.report, 'count').mockResolvedValue(0);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 'user-b' } as never);
    vi.spyOn(prisma.report, 'create').mockRejectedValue({ code: 'P2002' });

    await expect(service.report(user, { targetType: 'USER', targetId: 'user-b', reason: '스팸' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('rate limits report abuse before resolving another target', async () => {
    const service = new SafetyService();
    vi.spyOn(prisma.report, 'count').mockResolvedValue(5);
    const targetLookup = vi.spyOn(prisma.user, 'findUnique');

    const request = service.report(user, { targetType: 'USER', targetId: 'user-b', reason: '스팸' });
    await expect(request).rejects.toBeInstanceOf(HttpException);
    await expect(request).rejects.toMatchObject({ status: 429 });
    expect(targetLookup).not.toHaveBeenCalled();
  });
});
