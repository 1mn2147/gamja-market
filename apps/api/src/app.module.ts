import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { SessionGuard } from './auth/session.guard.js';
import { HealthController } from './health.controller.js';
import { NeighborhoodController } from './neighborhoods/neighborhood.controller.js';
import { ObservabilityService } from './observability.service.js';
import { ProductController } from './products/product.controller.js';
import { ProductService } from './products/product.service.js';
import { ChatController } from './chats/chat.controller.js';
import { ChatService } from './chats/chat.service.js';
import { ChatGateway } from './chats/chat.gateway.js';
import { SafetyController } from './safety/safety.controller.js';
import { SafetyService } from './safety/safety.service.js';
import { TradeController } from './trades/trade.controller.js';
import { TradeService } from './trades/trade.service.js';
import { PaymentController } from './payments/payment.controller.js';
import { PaymentService } from './payments/payment.service.js';
import { TossSandboxAdapter } from './payments/toss-sandbox.adapter.js';
import { AdminController } from './admin/admin.controller.js';
import { AdminGuard } from './admin/admin.guard.js';
import { AdminService } from './admin/admin.service.js';
import { ReadinessService } from './readiness.service.js';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [HealthController, AuthController, NeighborhoodController, ProductController, ChatController, SafetyController, TradeController, PaymentController, AdminController],
  providers: [
    ObservabilityService,
    AuthService,
    SessionGuard,
    ProductService,
    ChatService,
    ChatGateway,
    SafetyService,
    TradeService,
    PaymentService,
    TossSandboxAdapter,
    AdminGuard,
    AdminService,
    ReadinessService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
