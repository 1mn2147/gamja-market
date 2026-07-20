import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { SendMessageDto } from './chat.dto.js';
import { ChatService } from './chat.service.js';
@Controller()
@UseGuards(SessionGuard)
export class ChatController {
  constructor(@Inject(ChatService) private readonly chats: ChatService) {}
  @Post("products/:productId/chats") create(@Param("productId") id: string, @Req() request: AuthenticatedRequest) { return this.chats.create(id, request.user); }
  @Get("chats") list(@Req() request: AuthenticatedRequest) { return this.chats.list(request.user); }
  @Get("chats/:chatId") detail(@Param("chatId") id: string, @Req() request: AuthenticatedRequest) { return this.chats.detail(id, request.user); }
  @Post("chats/:chatId/messages") send(@Param("chatId") id: string, @Req() request: AuthenticatedRequest, @Body() input: SendMessageDto) { return this.chats.send(id, request.user, input.body, input.clientMessageId); }
}
