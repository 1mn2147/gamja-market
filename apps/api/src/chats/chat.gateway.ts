import { HttpException, Inject, OnModuleDestroy, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer, WsException } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { AuthService, type AuthenticatedUser } from '../auth/auth.service.js';
import { SafetyService } from '../safety/safety.service.js';
import { ChatJoinDto, SendChatMessageDto } from './chat.dto.js';
import { ChatService } from './chat.service.js';

function cookie(value: string | undefined, name: string) {
  const encoded = value?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  return encoded ? decodeURIComponent(encoded) : undefined;
}

function websocketError(error: unknown) {
  if (error instanceof WsException) return error;
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'object' && response !== null && 'code' in response) return new WsException(String(response.code));
  }
  return new WsException('CHAT_REQUEST_FAILED');
}

@WebSocketGateway({ namespace: 'chats', cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true } })
@UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, exceptionFactory: () => new WsException('INVALID_MESSAGE') }))
export class ChatGateway implements OnGatewayConnection, OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server!: Namespace;
  private unsubscribeRelationship: (() => void) | undefined;
  private redisClients: Array<ReturnType<typeof createClient>> = [];

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(SafetyService) private readonly safety: SafetyService,
  ) {}

  afterInit() {
    void this.configureRedisAdapter();
    this.unsubscribeRelationship = this.safety.onRelationshipChanged((change) => {
      this.server.to(change.userIds.map((id) => `user:${id}`)).emit('safety:relationship', change);
      for (const socket of this.server.sockets.values()) {
        const user = socket.data.user as AuthenticatedUser | undefined;
        if (user && change.userIds.includes(user.id)) {
          socket.emit('safety:relationship', change);
          void this.refreshSubscriptions(socket, user);
        }
      }
    });
  }

  private async configureRedisAdapter() {
    const url = process.env.REDIS_URL;
    if (!url) return;
    const publisher = createClient({ url });
    const subscriber = publisher.duplicate();
    publisher.on('error', () => undefined);
    subscriber.on('error', () => undefined);
    await Promise.all([publisher.connect(), subscriber.connect()]);
    this.redisClients = [publisher, subscriber];
    this.server.server.adapter(createAdapter(publisher, subscriber));
  }

  onModuleDestroy() {
    this.unsubscribeRelationship?.();
    for (const client of this.redisClients) void client.quit();
  }

  async handleConnection(socket: Socket) {
    const sessionToken = cookie(socket.handshake.headers.cookie, 'gm_session');
    if (!sessionToken) return socket.disconnect();
    socket.data.sessionToken = sessionToken;
    const user = await this.auth.getActiveSession(sessionToken);
    if (!user) return socket.disconnect();
    socket.data.user = user;
    await socket.join(`user:${user.id}`);
    await this.refreshSubscriptions(socket, user);
  }

  private async refreshSubscriptions(socket: Socket, user: AuthenticatedUser) {
    for (const room of socket.rooms) if (room.startsWith('chat:')) await socket.leave(room);
    const { chats } = await this.chats.list(user);
    if (chats.length > 0) await socket.join(chats.map((chat) => `chat:${chat.id}`));
  }

  private async activeUser(socket: Socket) {
    const sessionToken = socket.data.sessionToken as string | undefined;
    const user = sessionToken ? await this.auth.getActiveSession(sessionToken) : undefined;
    if (!user) {
      socket.disconnect();
      throw new WsException('AUTHENTICATION_REQUIRED');
    }
    socket.data.user = user;
    return user;
  }

  @SubscribeMessage('chat:join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() input: ChatJoinDto) {
    try {
      const user = await this.activeUser(socket);
      const room = await this.chats.detail(input.chatId, user);
      const chatRoom = `chat:${input.chatId}`;
      const userRooms = [`user:${room.buyerId}`, `user:${room.sellerId}`];
      this.server.in(userRooms).socketsJoin(chatRoom);
      this.server.to(userRooms).emit('chat:created', { chatId: input.chatId });
      return { chatId: input.chatId };
    } catch (error) {
      throw websocketError(error);
    }
  }

  @SubscribeMessage('chat:send')
  async send(@ConnectedSocket() socket: Socket, @MessageBody() input: SendChatMessageDto) {
    try {
      const user = await this.activeUser(socket);
      const message = await this.chats.send(input.chatId, user, input.body, input.clientMessageId);
      this.server.to(`chat:${input.chatId}`).emit('chat:message', message);
      return message;
    } catch (error) {
      throw websocketError(error);
    }
  }
}
