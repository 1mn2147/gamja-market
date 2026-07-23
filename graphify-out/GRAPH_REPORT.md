# Graph Report - gamja-market  (2026-07-23)

## Corpus Check
- 199 files · ~210,731 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4356 nodes · 5129 edges · 205 communities (128 shown, 77 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `335f1123`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- User.ts
- prismaNamespace.ts
- Trade.ts
- Product.ts
- ChatRoom.ts
- Neighborhood.ts
- commonInputTypes.ts
- Payment.ts
- Block.ts
- ChatParticipant.ts
- NeighborhoodLink.ts
- ChatMessage.ts
- VerificationCode.ts
- PaymentWebhook.ts
- ProductImage.ts
- PaymentOperation.ts
- Report.ts
- TradeHistory.ts
- Session.ts
- LedgerEntry.ts
- AuthService
- LoginThrottle.ts
- OutboxEvent.ts
- AuditLog.ts
- PaymentService
- devDependencies
- database/package.json
- app.module.ts
- AuthenticatedUser
- 감자마켓 제품 요구사항
- scripts
- request-context.middleware.ts
- scripts
- prismaNamespaceBrowser.ts
- PrismaClient
- ChatGateway
- product-client.tsx
- client.ts
- ui/package.json
- ProductController
- browser.ts
- account-forms.tsx
- contracts/package.json
- enums.ts
- 감자마켓 테스트 전략 및 명세
- AdminService
- AuthenticatedRequest
- test-utils/package.json
- dependencies
- devDependencies
- product.controller.ts
- config/package.json
- SafetyController
- web/tsconfig.json
- AuditLogDelegate
- BlockDelegate
- ChatMessageDelegate
- ChatParticipantDelegate
- ChatRoomDelegate
- LedgerEntryDelegate
- LoginThrottleDelegate
- NeighborhoodDelegate
- NeighborhoodLinkDelegate
- OutboxEventDelegate
- PaymentDelegate
- PaymentOperationDelegate
- PaymentWebhookDelegate
- ProductDelegate
- ProductImageDelegate
- ReportDelegate
- SessionDelegate
- TradeDelegate
- TradeHistoryDelegate
- UserDelegate
- VerificationCodeDelegate
- AdminController
- ProductService
- 감자마켓 디자인
- Prisma__UserClient
- 감자마켓 웹페이지 구성 설계
- 감자마켓 Codex 활용 개발 WBS
- ChatController
- compilerOptions
- session.guard.ts
- compilerOptions
- 6. 상세 WBS
- database/tsconfig.json
- SendMessageDto
- ReadinessService
- test-utils/tsconfig.json
- ui/tsconfig.json
- trade-client.tsx
- worker/tsconfig.json
- 감자마켓 기술 스택 및 개발 계획
- Prisma__ChatRoomClient
- Prisma__ProductClient
- Prisma__TradeClient
- scripts
- API 계약 기준
- 13. 최고관리자 페이지
- contracts/tsconfig.json
- Prisma__NeighborhoodClient
- trade.controller.ts
- AuthenticatedUser
- 도메인·상태 모델
- 8. 인증·계정 페이지
- ReadinessService
- 8. 기능 테스트 매트릭스
- Prisma__PaymentClient
- ADR-0001: 모듈형 모놀리스와 계약 우선 기반
- F0 기반 구현 검토 기록
- F1 계정·인증 기반 검토 기록
- F2 상품·검색 검토 기록
- F3 채팅·안전 구현 검토 기록
- SendMessageDto
- Prisma__BlockClient
- Prisma__ChatMessageClient
- Prisma__ChatParticipantClient
- Prisma__NeighborhoodLinkClient
- verify-baseline.mjs
- api/package.json
- layout.tsx
- 결제 위협 모델
- 11. 거래·결제 페이지
- 5. 공통 내비게이션
- security-check.mjs
- Prisma__PaymentOperationClient
- Prisma__PaymentWebhookClient
- Prisma__ProductImageClient
- Prisma__ReportClient
- Prisma__SessionClient
- Prisma__TradeHistoryClient
- Prisma__VerificationCodeClient
- Gamja Market
- admin/page.tsx
- 출시 차단 결정대장
- 12. 신고·차단 페이지
- 7. 공개·탐색 페이지
- 9. 판매 페이지
- 11. 성능, 복원력과 관측성
- 13. 진입·종료와 출시 판정
- 9. 페이지와 UI 상태 검증
- config/tsconfig.json
- events.ts
- openapi.spec.ts
- Prisma__AuditLogClient
- Prisma__LedgerEntryClient
- Prisma__LoginThrottleClient
- Prisma__OutboxEventClient
- chats/page.tsx
- blocked-users/page.tsx
- reports/page.tsx
- reports/new/page.tsx
- next.config.ts
- 10. 채팅 페이지
- AGENTS.md
- class-validator
- ProductService
- @nestjs/common
- @nestjs/platform-express
- NeighborhoodController
- @nestjs/throttler
- 13. 진입·종료와 출시 판정
- socket.io
- next-env.d.ts
- baseline/README.md
- @opentelemetry/exporter-trace-otlp-http
- @opentelemetry/sdk-node
- redis
- reflect-metadata
- rxjs
- ObservabilityService
- 8. 기능 테스트 매트릭스
- class-validator
- POST
- @nestjs/platform-socket.io
- @opentelemetry/api
- pino
- DELETE
- GET
- PATCH
- POST
- PUT
- 요구사항·화면 추적표
- TradeActionDto
- 취약 비밀번호 차단 기능 구현·검증 보고서
- 11. 성능, 복원력과 관측성
- 13. 진입·종료와 출시 판정
- seed.ts
- 10. 채팅 페이지

## God Nodes (most connected - your core abstractions)
1. `AuthenticatedUser` - 51 edges
2. `AuthenticatedRequest` - 48 edges
3. `PrismaClient` - 31 edges
4. `AuthService` - 28 edges
5. `감자마켓 웹페이지 구성 설계` - 23 edges
6. `AdminService` - 20 edges
7. `PaymentService` - 20 edges
8. `SafetyService` - 20 edges
9. `AdminController` - 19 edges
10. `ProductService` - 19 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --indirect_call--> `ObservabilityService`  [INFERRED]
  apps/api/src/main.ts → apps/api/src/observability.service.ts
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  apps/api/src/main.ts → apps/api/src/app.module.ts
- `bootstrap()` --indirect_call--> `requestContextMiddleware()`  [INFERRED]
  apps/api/src/main.ts → apps/api/src/common/request-context.middleware.ts
- `start()` --calls--> `processDueSettlements()`  [EXTRACTED]
  apps/worker/src/main.ts → apps/worker/src/settlement-maintenance.ts
- `SignupForm()` --calls--> `evaluatePassword()`  [EXTRACTED]
  apps/web/app/account-forms.tsx → apps/web/app/password-policy.ts

## Import Cycles
- 3-file cycle: `packages/database/prisma/generated/commonInputTypes.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/commonInputTypes.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/AuditLog.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/Block.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/ChatMessage.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/ChatParticipant.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/ChatRoom.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/LedgerEntry.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/LoginThrottle.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/Neighborhood.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/NeighborhoodLink.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/OutboxEvent.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/Payment.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/PaymentOperation.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/PaymentWebhook.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/Product.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/ProductImage.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/Report.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/Session.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/Trade.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`
- 3-file cycle: `packages/database/prisma/generated/internal/prismaNamespace.ts -> packages/database/prisma/generated/models.ts -> packages/database/prisma/generated/models/TradeHistory.ts -> packages/database/prisma/generated/internal/prismaNamespace.ts`

## Communities (205 total, 77 thin omitted)

### Community 0 - "User.ts"
Cohesion: 0.01
Nodes (218): AggregateUser, BoolFieldUpdateOperationsInput, DateTimeFieldUpdateOperationsInput, EnumUserRoleFieldUpdateOperationsInput, EnumUserStatusFieldUpdateOperationsInput, GetUserAggregateType, GetUserGroupByPayload, NullableDateTimeFieldUpdateOperationsInput (+210 more)

### Community 1 - "prismaNamespace.ts"
Cohesion: 0.01
Nodes (156): Args, At, AtLeast, AtLoose, AtStrict, AuditLogScalarFieldEnum, BatchPayload, BigIntFieldRefInput (+148 more)

### Community 2 - "Trade.ts"
Cohesion: 0.01
Nodes (135): AggregateTrade, EnumTradeStatusFieldUpdateOperationsInput, GetTradeAggregateType, GetTradeGroupByPayload, Trade$historyArgs, Trade$paymentArgs, TradeAggregateArgs, TradeAvgAggregateInputType (+127 more)

### Community 3 - "Product.ts"
Cohesion: 0.01
Nodes (133): AggregateProduct, BigIntFieldUpdateOperationsInput, EnumProductStatusFieldUpdateOperationsInput, GetProductAggregateType, GetProductGroupByPayload, Product$chatRoomsArgs, Product$imagesArgs, Product$tradesArgs (+125 more)

### Community 4 - "ChatRoom.ts"
Cohesion: 0.02
Nodes (130): AggregateChatRoom, ChatRoom$messagesArgs, ChatRoom$participantsArgs, ChatRoomAggregateArgs, ChatRoomCountAggregateInputType, ChatRoomCountAggregateOutputType, ChatRoomCountArgs, ChatRoomCountOrderByAggregateInput (+122 more)

### Community 5 - "Neighborhood.ts"
Cohesion: 0.02
Nodes (104): AggregateNeighborhood, GetNeighborhoodAggregateType, GetNeighborhoodGroupByPayload, Neighborhood$neighborsFromArgs, Neighborhood$neighborsToArgs, Neighborhood$productsArgs, Neighborhood$usersArgs, NeighborhoodAggregateArgs (+96 more)

### Community 6 - "commonInputTypes.ts"
Cohesion: 0.02
Nodes (103): BigIntFilter, BigIntWithAggregatesFilter, BoolFilter, BoolWithAggregatesFilter, BytesFilter, BytesWithAggregatesFilter, DateTimeFilter, DateTimeNullableFilter (+95 more)

### Community 7 - "Payment.ts"
Cohesion: 0.02
Nodes (101): AggregatePayment, EnumPaymentStatusFieldUpdateOperationsInput, EnumSettlementStatusFieldUpdateOperationsInput, GetPaymentAggregateType, GetPaymentGroupByPayload, Payment$operationsArgs, Payment$webhooksArgs, PaymentAggregateArgs (+93 more)

### Community 8 - "Block.ts"
Cohesion: 0.02
Nodes (89): AggregateBlock, BlockAggregateArgs, BlockBlockerIdBlockedIdCompoundUniqueInput, BlockCountAggregateInputType, BlockCountAggregateOutputType, BlockCountArgs, BlockCountOrderByAggregateInput, BlockCreateArgs (+81 more)

### Community 9 - "ChatParticipant.ts"
Cohesion: 0.02
Nodes (89): AggregateChatParticipant, ChatParticipantAggregateArgs, ChatParticipantChatRoomIdUserIdCompoundUniqueInput, ChatParticipantCountAggregateInputType, ChatParticipantCountAggregateOutputType, ChatParticipantCountArgs, ChatParticipantCountOrderByAggregateInput, ChatParticipantCreateArgs (+81 more)

### Community 10 - "NeighborhoodLink.ts"
Cohesion: 0.02
Nodes (89): AggregateNeighborhoodLink, GetNeighborhoodLinkAggregateType, GetNeighborhoodLinkGroupByPayload, NeighborhoodLinkAggregateArgs, NeighborhoodLinkCountAggregateInputType, NeighborhoodLinkCountAggregateOutputType, NeighborhoodLinkCountArgs, NeighborhoodLinkCountOrderByAggregateInput (+81 more)

### Community 11 - "ChatMessage.ts"
Cohesion: 0.02
Nodes (88): AggregateChatMessage, ChatMessageAggregateArgs, ChatMessageCountAggregateInputType, ChatMessageCountAggregateOutputType, ChatMessageCountArgs, ChatMessageCountOrderByAggregateInput, ChatMessageCreateArgs, ChatMessageCreateInput (+80 more)

### Community 12 - "VerificationCode.ts"
Cohesion: 0.02
Nodes (82): AggregateVerificationCode, EnumVerificationPurposeFieldUpdateOperationsInput, GetVerificationCodeAggregateType, GetVerificationCodeGroupByPayload, IntFieldUpdateOperationsInput, VerificationCode$userArgs, VerificationCodeAggregateArgs, VerificationCodeAvgAggregateInputType (+74 more)

### Community 13 - "PaymentWebhook.ts"
Cohesion: 0.02
Nodes (81): AggregatePaymentWebhook, EnumWebhookProcessingStatusFieldUpdateOperationsInput, GetPaymentWebhookAggregateType, GetPaymentWebhookGroupByPayload, PaymentWebhook$paymentArgs, PaymentWebhookAggregateArgs, PaymentWebhookAvgAggregateInputType, PaymentWebhookAvgAggregateOutputType (+73 more)

### Community 14 - "ProductImage.ts"
Cohesion: 0.02
Nodes (81): AggregateProductImage, BytesFieldUpdateOperationsInput, GetProductImageAggregateType, GetProductImageGroupByPayload, ProductImageAggregateArgs, ProductImageAvgAggregateInputType, ProductImageAvgAggregateOutputType, ProductImageAvgOrderByAggregateInput (+73 more)

### Community 15 - "PaymentOperation.ts"
Cohesion: 0.02
Nodes (80): AggregatePaymentOperation, EnumPaymentActionFieldUpdateOperationsInput, GetPaymentOperationAggregateType, GetPaymentOperationGroupByPayload, PaymentOperationAggregateArgs, PaymentOperationAvgAggregateInputType, PaymentOperationAvgAggregateOutputType, PaymentOperationAvgOrderByAggregateInput (+72 more)

### Community 16 - "Report.ts"
Cohesion: 0.03
Nodes (76): AggregateReport, EnumReportStatusFieldUpdateOperationsInput, EnumReportTargetTypeFieldUpdateOperationsInput, GetReportAggregateType, GetReportGroupByPayload, ReportAggregateArgs, ReportCountAggregateInputType, ReportCountAggregateOutputType (+68 more)

### Community 17 - "TradeHistory.ts"
Cohesion: 0.03
Nodes (74): AggregateTradeHistory, GetTradeHistoryAggregateType, GetTradeHistoryGroupByPayload, NullableEnumTradeStatusFieldUpdateOperationsInput, TradeHistoryAggregateArgs, TradeHistoryCountAggregateInputType, TradeHistoryCountAggregateOutputType, TradeHistoryCountArgs (+66 more)

### Community 18 - "Session.ts"
Cohesion: 0.03
Nodes (73): AggregateSession, GetSessionAggregateType, GetSessionGroupByPayload, SessionAggregateArgs, SessionCountAggregateInputType, SessionCountAggregateOutputType, SessionCountArgs, SessionCountOrderByAggregateInput (+65 more)

### Community 19 - "LedgerEntry.ts"
Cohesion: 0.03
Nodes (60): AggregateLedgerEntry, EnumLedgerEntryTypeFieldUpdateOperationsInput, GetLedgerEntryAggregateType, GetLedgerEntryGroupByPayload, LedgerEntryAggregateArgs, LedgerEntryAvgAggregateInputType, LedgerEntryAvgAggregateOutputType, LedgerEntryAvgOrderByAggregateInput (+52 more)

### Community 20 - "AuthService"
Cohesion: 0.07
Nodes (35): AuthController, Body, Controller, Get, HttpCode, Inject, Patch, Post (+27 more)

### Community 21 - "LoginThrottle.ts"
Cohesion: 0.03
Nodes (58): AggregateLoginThrottle, GetLoginThrottleAggregateType, GetLoginThrottleGroupByPayload, LoginThrottleAggregateArgs, LoginThrottleAvgAggregateInputType, LoginThrottleAvgAggregateOutputType, LoginThrottleAvgOrderByAggregateInput, LoginThrottleCountAggregateInputType (+50 more)

### Community 22 - "OutboxEvent.ts"
Cohesion: 0.03
Nodes (59): AggregateOutboxEvent, EnumOutboxStatusFieldUpdateOperationsInput, GetOutboxEventAggregateType, GetOutboxEventGroupByPayload, OutboxEventAggregateArgs, OutboxEventAvgAggregateInputType, OutboxEventAvgAggregateOutputType, OutboxEventAvgOrderByAggregateInput (+51 more)

### Community 23 - "AuditLog.ts"
Cohesion: 0.04
Nodes (52): AggregateAuditLog, AuditLogAggregateArgs, AuditLogCountAggregateInputType, AuditLogCountAggregateOutputType, AuditLogCountArgs, AuditLogCountOrderByAggregateInput, AuditLogCreateArgs, AuditLogCreateInput (+44 more)

### Community 24 - "PaymentService"
Cohesion: 0.09
Nodes (24): PaymentController, Body, Controller, Get, HttpCode, Inject, Param, Post (+16 more)

### Community 25 - "devDependencies"
Cohesion: 0.05
Nodes (42): dependencies, @gamja/ui, next, react, react-dom, socket.io-client, devDependencies, @axe-core/playwright (+34 more)

### Community 26 - "database/package.json"
Cohesion: 0.05
Nodes (39): dotenv, dependencies, pg, @prisma/adapter-pg, @prisma/client, devDependencies, dotenv, eslint (+31 more)

### Community 27 - "app.module.ts"
Cohesion: 0.07
Nodes (29): 10. 결론, 1. 개요와 최종 판정, 2. 개발 전 과정, 3.1 요구사항 범위와 충족 현황, 3.2 역할과 권한, 3.3 보안·비기능 요구사항, 3. 요구사항 분석, 4.1 아키텍처 (+21 more)

### Community 28 - "AuthenticatedUser"
Cohesion: 0.25
Nodes (7): 수정, 실제 두 계정 검증, 외부 HTTP 채팅 장애 분석 및 수정 보고서, 운영 참고, 원인, 자동 회귀, 현상

### Community 29 - "감자마켓 제품 요구사항"
Cohesion: 0.06
Nodes (36): 10. 승인된 정책 결정, 11. 출시 완료 기준, 12. 준거 문서, 1. 문서 정보, 2. 제품 목표, 3. 핵심 원칙, 4.1 포함 범위, 4.2 제외 범위 (+28 more)

### Community 30 - "scripts"
Cohesion: 0.06
Nodes (35): @eslint/js, devDependencies, eslint, @eslint/js, typescript-eslint, engines, node, pnpm (+27 more)

### Community 31 - "request-context.middleware.ts"
Cohesion: 0.09
Nodes (21): 1. 결론, 2. 시험 환경과 방법, 3. 전체 자동 게이트 결과, 4. 기능별 실사용 결과, 5. PostgreSQL 저장 대조, 6. 보안 음수 시험, 7. 발견 결함과 수정, 8. 외부·수동 필수 시험과 잔여 위험 (+13 more)

### Community 32 - "scripts"
Cohesion: 0.06
Nodes (32): dependencies, bullmq, @gamja/contracts, @gamja/database, @opentelemetry/api, pino, devDependencies, eslint (+24 more)

### Community 33 - "prismaNamespaceBrowser.ts"
Cohesion: 0.06
Nodes (30): AuditLogScalarFieldEnum, BlockScalarFieldEnum, ChatMessageScalarFieldEnum, ChatParticipantScalarFieldEnum, ChatRoomScalarFieldEnum, JsonNullValueFilter, JsonNullValueInput, LedgerEntryScalarFieldEnum (+22 more)

### Community 35 - "ChatGateway"
Cohesion: 0.11
Nodes (18): ChatJoinDto, SendChatMessageDto, SendMessageDto, IsOptional, IsString, Matches, MaxLength, MinLength (+10 more)

### Community 36 - "product-client.tsx"
Cohesion: 0.10
Nodes (11): ACCEPTED_IMAGE_TYPES, ApiError, MyProducts(), price(), Product, ProductCard(), ProductCreateForm(), ProductDetail() (+3 more)

### Community 37 - "client.ts"
Cohesion: 0.08
Nodes (23): AuditLog, Block, ChatMessage, ChatParticipant, ChatRoom, $Enums, LedgerEntry, LoginThrottle (+15 more)

### Community 38 - "ui/package.json"
Cohesion: 0.09
Nodes (23): devDependencies, eslint, react, @types/react, typescript, vitest, exports, eslint (+15 more)

### Community 39 - "ProductController"
Cohesion: 0.20
Nodes (14): OptionalSession(), ProductController, Body, Controller, Delete, Get, HttpCode, Param (+6 more)

### Community 40 - "browser.ts"
Cohesion: 0.09
Nodes (22): AuditLog, Block, ChatMessage, ChatParticipant, ChatRoom, $Enums, LedgerEntry, LoginThrottle (+14 more)

### Community 41 - "account-forms.tsx"
Cohesion: 0.10
Nodes (15): Account, AccountPanel(), api(), ApiBody, LoginForm(), PasswordResetForm(), SignupForm(), VerifyForm() (+7 more)

### Community 42 - "contracts/package.json"
Cohesion: 0.09
Nodes (21): devDependencies, eslint, @gamja/config, @types/node, typescript, vitest, eslint, @gamja/config (+13 more)

### Community 43 - "enums.ts"
Cohesion: 0.11
Nodes (25): VerificationResult, logger, PaymentView, StoredResponse, TossPayment, TossResponse, SafetyRelationshipChange, ACTIVE_TRADE_STATUSES (+17 more)

### Community 44 - "감자마켓 테스트 전략 및 명세"
Cohesion: 0.08
Nodes (25): 10.1 API와 애플리케이션 보안, 10.2 PCI DSS 및 결제 데이터, 10.3 전송, 저장과 관리체계, 10. 보안 및 컴플라이언스 테스트, 12. 핵심 E2E 인수 시나리오, 14. 결함 우선순위, 15. Codex 테스트 실행 절차, 16. 추적성 완전성 검사 (+17 more)

### Community 45 - "AdminService"
Cohesion: 0.10
Nodes (16): AdminController, Body, Controller, Get, Inject, Param, Post, Req (+8 more)

### Community 46 - "AuthenticatedRequest"
Cohesion: 0.20
Nodes (18): OptionalAuthRequest, CreateProductDto, ProductImageDto, ProductQueryDto, ProductStatusDto, IsOptional, IsString, Matches (+10 more)

### Community 47 - "test-utils/package.json"
Cohesion: 0.10
Nodes (19): devDependencies, eslint, @types/node, typescript, vitest, exports, eslint, @types/node (+11 more)

### Community 48 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, argon2, class-validator, @gamja/database, helmet, @nestjs/core, @nestjs/platform-express, @nestjs/platform-socket.io (+13 more)

### Community 49 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, @nestjs/testing, supertest, tsx, @types/express, @types/node, @types/supertest (+11 more)

### Community 50 - "product.controller.ts"
Cohesion: 0.23
Nodes (9): activateByApi(), api(), body(), createProduct(), emails, expectStatus(), ids, realisticUpload (+1 more)

### Community 51 - "config/package.json"
Cohesion: 0.11
Nodes (18): devDependencies, eslint, @types/node, typescript, vitest, eslint, @types/node, typescript (+10 more)

### Community 52 - "SafetyController"
Cohesion: 0.11
Nodes (14): Inject, SafetyController, Body, Controller, Delete, Get, Inject, Param (+6 more)

### Community 53 - "web/tsconfig.json"
Cohesion: 0.11
Nodes (17): compilerOptions, jsx, lib, noEmit, plugins, exclude, extends, include (+9 more)

### Community 75 - "AdminController"
Cohesion: 0.14
Nodes (11): AppModule, HttpProblemFilter, requestContext, requestContextMiddleware(), bootstrap(), configured, acceptedTrade(), account() (+3 more)

### Community 76 - "ProductService"
Cohesion: 0.33
Nodes (3): config, LogOptions, PrismaClientConstructor

### Community 77 - "감자마켓 디자인"
Cohesion: 0.12
Nodes (16): Accessibility, Brand, Components, Content voice, Design principles, Implementation constraints, Information architecture, Interaction states (+8 more)

### Community 79 - "감자마켓 웹페이지 구성 설계"
Cohesion: 0.13
Nodes (15): 14. 시스템 상태 화면, 15. 공통 컴포넌트, 16. 반응형 구성, 17. 접근성 및 키보드 동작, 18. 콘텐츠와 마이크로카피, 19. 화면 상태 체크리스트, 1. 문서 정보, 20. 분석 및 개인정보 제한 (+7 more)

### Community 80 - "감자마켓 Codex 활용 개발 WBS"
Cohesion: 0.13
Nodes (15): 10. 진행 현황 형식, 1. 문서 정보, 2. 목표와 완료 조건, 3.1 확정 기술 기준선, 3.2 승인된 제품·운영 결정, 3. 개발 전제와 출시 차단 결정, 4.1 작업 입력 계약, 4.2 역할 분담 (+7 more)

### Community 81 - "ChatController"
Cohesion: 0.14
Nodes (14): AdminGuard, Injectable, readCookie(), SessionGuard, SessionRequest, Injectable, BlockUserDto, CreateReportDto (+6 more)

### Community 82 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, exactOptionalPropertyTypes, lib, module, moduleResolution, noUncheckedIndexedAccess, resolveJsonModule (+5 more)

### Community 84 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir, extends (+3 more)

### Community 85 - "6. 상세 WBS"
Cohesion: 0.17
Nodes (12): 6. 상세 WBS, WBS-00 기준선과 기술 의사결정, WBS-01 저장소와 플랫폼 기반, WBS-02 회원, 인증, 계정과 지역, WBS-03 상품과 검색, WBS-04 채팅, 신고와 차단, WBS-05 직거래 도메인, WBS-06 토스페이먼츠 결제, 에스크로와 정산 (+4 more)

### Community 86 - "database/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, outDir, rootDir, types, extends, include, node, src/**/*.ts (+3 more)

### Community 88 - "ReadinessService"
Cohesion: 0.19
Nodes (13): connection, logger, start(), dispatchOutboxJobs(), finish(), lookupPayment(), processOutboxEvent(), processPaymentWebhook() (+5 more)

### Community 90 - "test-utils/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, types, extends, include, node, src/**/*.ts (+1 more)

### Community 91 - "ui/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, jsx, outDir, rootDir, extends, include, src/**/*.ts, ../../tsconfig.base.json (+1 more)

### Community 92 - "trade-client.tsx"
Cohesion: 0.08
Nodes (17): ChatMessage, mergeMessages(), ChatDetail, ChatPage(), BrowserCrypto, createClientId(), Payment, PaymentDetail() (+9 more)

### Community 93 - "worker/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, module, outDir, rootDir, extends, include, src/**/*.ts, ../../tsconfig.base.json

### Community 94 - "감자마켓 기술 스택 및 개발 계획"
Cohesion: 0.12
Nodes (16): 1. 문서 목적, 2. 아키텍처 원칙, 3.1 코어 런타임, 3.2 프런트엔드, 3.3 백엔드, 3.4 데이터와 검색, 3.5 큐와 실시간 처리, 3.6 보안과 관측성 (+8 more)

### Community 98 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, start, test:integration, test:unit, typecheck

### Community 99 - "API 계약 기준"
Cohesion: 0.25
Nodes (7): API 계약 기준, 계약 변경 규칙, 목록·동시성·멱등성, 범위와 원칙, 오류 형식, 인증·인가, 채팅·신고·차단

### Community 100 - "13. 최고관리자 페이지"
Cohesion: 0.25
Nodes (8): 13.1 ADMIN-01 최고관리자 로그인, 13.2 ADMIN-02 운영 홈, 13.3 ADMIN-03 사용자 관리, 13.4 ADMIN-04 상품 관리, 13.5 ADMIN-05 신고 처리, 13.6 ADMIN-06 거래·결제 관리, 13.7 ADMIN-07 감사 로그, 13. 최고관리자 페이지

### Community 101 - "contracts/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src/**/*.ts, ../../tsconfig.base.json

### Community 103 - "trade.controller.ts"
Cohesion: 0.20
Nodes (9): 1. 실행 환경, 2. 종합 결과, 3. 배포 차단 결함, 4. 보안·배포 구성 확인 사항, 5. 미실행 필수 시험, 6. 최종 판정과 재시험 범위, PD-001 Redis 장애 시 readiness 응답 지연 — 높음, PD-002 Redis 재기동 후 Worker 자동 복구 실패 — 높음 (+1 more)

### Community 104 - "AuthenticatedUser"
Cohesion: 0.21
Nodes (5): AuthenticatedUser, Inject, TradeService, Inject, Injectable

### Community 105 - "도메인·상태 모델"
Cohesion: 0.29
Nodes (6): 거래와 결제, 공통 불변 조건, 도메인·상태 모델, 사용자, 상품, 신고와 차단

### Community 106 - "8. 인증·계정 페이지"
Cohesion: 0.29
Nodes (7): 8.1 AUTH-01 로그인, 8.2 AUTH-02 회원가입·성인 확인, 8.3 AUTH-03 연락처 인증, 8.4 AUTH-04 비밀번호 재설정, 8.5 ACCOUNT-01 내 활동 홈, 8.6 ACCOUNT-02 계정·인증·세션, 8. 인증·계정 페이지

### Community 107 - "ReadinessService"
Cohesion: 0.18
Nodes (10): HealthController, Controller, Get, HttpCode, Inject, ReadinessService, redisPing(), Injectable (+2 more)

### Community 108 - "8. 기능 테스트 매트릭스"
Cohesion: 0.22
Nodes (8): UT-EXT-001 실제 Toss 테스트 결제 — 필수, UT-EXT-002 연락처 전달 공급자 — 필수, UT-EXT-003 지급·정산 공급자 — 필수, UT-OPS-001 장애·복구 훈련 — 필수, UT-UX-001 실기기·키보드·스크린리더 — 필수, 결과 기록, 사용자·외부 시스템 검증 체크리스트, 증거 작성 규칙

### Community 110 - "ADR-0001: 모듈형 모놀리스와 계약 우선 기반"
Cohesion: 0.33
Nodes (5): ADR-0001: 모듈형 모놀리스와 계약 우선 기반, 결과와 제약, 결정, 선택하지 않은 대안, 이유

### Community 111 - "F0 기반 구현 검토 기록"
Cohesion: 0.33
Nodes (5): F0 기반 구현 검토 기록, 검증 증적, 구현 범위, 잔여 운영 검토, 후속 이력

### Community 112 - "F1 계정·인증 기반 검토 기록"
Cohesion: 0.33
Nodes (5): F1 계정·인증 기반 검토 기록, 검증 증적, 구현 범위, 확정된 운영·서비스 기준, 후속 이력

### Community 113 - "F2 상품·검색 검토 기록"
Cohesion: 0.33
Nodes (5): F2 상품·검색 검토 기록, 검증 증적, 구현 범위, 확정된 서비스 기준, 후속 이력

### Community 114 - "F3 채팅·안전 구현 검토 기록"
Cohesion: 0.33
Nodes (5): F3 채팅·안전 구현 검토 기록, 구현된 범위, 종료 전에 남은 항목, 판정과 다음 개발 단위, 현재 검증 증적

### Community 120 - "verify-baseline.mjs"
Cohesion: 0.33
Nodes (5): byFile, openapi, required, requirementIds, trace

### Community 121 - "api/package.json"
Cohesion: 0.14
Nodes (12): ChatController, Body, Controller, Get, Inject, Param, Post, Req (+4 more)

### Community 122 - "layout.tsx"
Cohesion: 0.28
Nodes (5): AuthNavAction(), AuthState, metadata, SiteShell(), SiteShellProps

### Community 124 - "결제 위협 모델"
Cohesion: 0.40
Nodes (4): 결제 위협 모델, 범위와 신뢰 경계, 위협과 통제, 필수 설계 규칙

### Community 125 - "11. 거래·결제 페이지"
Cohesion: 0.40
Nodes (5): 11.1 TRADE-01 거래 목록, 11.2 TRADE-02 거래 상세·상태 관리, 11.3 PAY-01 에스크로 결제, 11.4 PAY-02 결제 결과 확인, 11. 거래·결제 페이지

### Community 126 - "5. 공통 내비게이션"
Cohesion: 0.40
Nodes (5): 5.1 데스크톱 헤더, 5.2 모바일 하단 내비게이션, 5.3 최고관리자 내비게이션, 5.4 전역 레이어, 5. 공통 내비게이션

### Community 127 - "security-check.mjs"
Cohesion: 0.40
Nodes (3): findings, forbidden, ignored

### Community 135 - "Gamja Market"
Cohesion: 0.14
Nodes (14): Gamja Market, 결제·정산, 구성, 기본 연결과 인증, 데이터베이스, 보안 운영 주의사항, 빠른 실행, 사전 준비 (+6 more)

### Community 136 - "admin/page.tsx"
Cohesion: 0.33
Nodes (4): OutboxEvent, Overview, Payment, User

### Community 137 - "출시 차단 결정대장"
Cohesion: 0.50
Nodes (3): 승인 기록 형식, 출시 차단 결정대장, 현재 구현 제한

### Community 138 - "12. 신고·차단 페이지"
Cohesion: 0.50
Nodes (4): 12.1 SAFE-01 신고 접수, 12.2 SAFE-02 내 신고 내역, 12.3 SAFE-03 차단 사용자 관리, 12. 신고·차단 페이지

### Community 139 - "7. 공개·탐색 페이지"
Cohesion: 0.50
Nodes (4): 7.1 PUB-01 홈·가까운 상품, 7.2 PUB-02 상품 검색 결과, 7.3 PUB-03 상품 상세, 7. 공개·탐색 페이지

### Community 140 - "9. 판매 페이지"
Cohesion: 0.50
Nodes (4): 9.1 SELL-01 상품 등록, 9.2 SELL-02 상품 수정, 9.3 SELL-03 내 상품 관리, 9. 판매 페이지

### Community 141 - "11. 성능, 복원력과 관측성"
Cohesion: 0.25
Nodes (7): PostgreSQL 백업·복원 검증, 배포와 롤백, 상태 확인, 운영·복구 실행서, 웹훅·Outbox 장애, 정산 실패, 출시 전 필수 수동 검증

### Community 142 - "13. 진입·종료와 출시 판정"
Cohesion: 0.25
Nodes (5): concurrency, requests, result, samples, thresholdMs

### Community 143 - "9. 페이지와 UI 상태 검증"
Cohesion: 0.33
Nodes (5): F4 결제·내구성·출시 준비 검토 기록, 구현 결과, 외부 확인이 필요한 항목, 자동화 검증 결과, 판정

### Community 144 - "config/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 145 - "events.ts"
Cohesion: 0.50
Nodes (3): OutboxEvent, OutboxEventType, ProblemDetails

### Community 159 - "ProductService"
Cohesion: 0.22
Nodes (3): Inject, ProductService, Injectable

### Community 161 - "@nestjs/platform-express"
Cohesion: 0.18
Nodes (10): 1. 수정 결과, 2.1 경쟁 구매 제어, 2.2 미결제 예약 해제, 2.3 결제 취소 기간, 2.4 기존 데이터 보정, 2. 서버와 데이터 정합성, 3. 거래 화면, 4. 검증 결과 (+2 more)

### Community 162 - "NeighborhoodController"
Cohesion: 0.33
Nodes (4): NeighborhoodController, Controller, Get, Param

### Community 187 - "8. 기능 테스트 매트릭스"
Cohesion: 0.29
Nodes (7): 8.1 회원과 계정, 8.2 상품과 검색, 8.3 채팅, 신고와 차단, 8.4 직거래와 시간 정책, 8.5 결제, 웹훅과 정산, 8.6 최고관리자, 8. 기능 테스트 매트릭스

### Community 190 - "@nestjs/platform-socket.io"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 198 - "요구사항·화면 추적표"
Cohesion: 0.40
Nodes (4): M0 인수 기준, 기준선 검사, 변경 규칙, 요구사항·화면 추적표

### Community 199 - "TradeActionDto"
Cohesion: 0.21
Nodes (14): AuthenticatedRequest, TradeController, Body, Controller, Get, Param, Post, Req (+6 more)

### Community 200 - "취약 비밀번호 차단 기능 구현·검증 보고서"
Cohesion: 0.33
Nodes (5): 1. 문제와 위험, 2. 변경 내용, 3. 보안 검증, 4. 잔여 위험과 유지보수, 취약 비밀번호 차단 기능 구현·검증 보고서

### Community 201 - "11. 성능, 복원력과 관측성"
Cohesion: 0.50
Nodes (4): 11.1 성능, 11.2 장애 주입, 11.3 관측성 판정, 11. 성능, 복원력과 관측성

### Community 202 - "13. 진입·종료와 출시 판정"
Cohesion: 0.50
Nodes (4): 13.1 테스트 진입 조건, 13.2 작업 종료 조건, 13.3 출시 차단 기준, 13. 진입·종료와 출시 판정

### Community 204 - "10. 채팅 페이지"
Cohesion: 0.67
Nodes (3): 10.1 CHAT-01 채팅 목록, 10.2 CHAT-02 1:1 상품 채팅, 10. 채팅 페이지

## Knowledge Gaps
- **2928 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+2923 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **77 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ProductStatus` connect `enums.ts` to `ReadinessService`, `AuthenticatedRequest`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `argon2` connect `enums.ts` to `scripts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _2928 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `User.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0091324200913242 - nodes in this community are weakly interconnected._
- **Should `prismaNamespace.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.012738853503184714 - nodes in this community are weakly interconnected._
- **Should `Trade.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.014705882352941176 - nodes in this community are weakly interconnected._
- **Should `Product.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.014925373134328358 - nodes in this community are weakly interconnected._