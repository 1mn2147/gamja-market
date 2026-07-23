import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

function escapePath(value: string) {
  return value.replace(/[{}]/g, '\\$&');
}

function pathBlock(openapi: string, path: string) {
  const match = openapi.match(new RegExp(`^  ${escapePath(path)}:\\n([\\s\\S]*?)(?=^  /|^components:)`, 'm'));
  expect(match, `missing OpenAPI path ${path}`).not.toBeNull();
  return match?.[1] ?? '';
}

function schemaBlock(openapi: string, schema: string) {
  const match = openapi.match(new RegExp(`^    ${schema}:\\n([\\s\\S]*?)(?=^    [A-Z][A-Za-z]+:|^  responses:)`, 'm'));
  expect(match, `missing OpenAPI schema ${schema}`).not.toBeNull();
  return match?.[1] ?? '';
}

describe('OpenAPI baseline', () => {
  it('CONTRACT-F3-001: defines the versioned API, session security, and safe problem response', async () => {
    const openapi = await readFile('../../docs/baseline/openapi.yaml', 'utf8');
    expect(openapi).toContain('openapi: 3.1.0');
    expect(openapi).toContain('version: 0.9.0');
    expect(openapi).toContain('/healthz:');
    expect(openapi).toContain('/readyz:');
    expect(openapi).toContain('application/problem+json');
    expect(openapi).toContain('sessionCookie: { type: apiKey, in: cookie, name: gm_session }');
    expect(pathBlock(openapi, '/auth/signups')).toContain('operationId: signUp');
    expect(pathBlock(openapi, '/neighborhoods/{code}/nearby')).toContain('operationId: listNearbyNeighborhoods');
    expect(pathBlock(openapi, '/products')).toContain("$ref: '#/components/schemas/CreateProductRequest'");
    const signup = schemaBlock(openapi, 'SignUpRequest');
    expect(signup).toContain('minLength: 12');
    expect(signup).toContain('maxLength: 128');
    expect(signup).toContain('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])');
    const reset = schemaBlock(openapi, 'PasswordResetConfirmRequest');
    expect(reset).toContain('Uses the same server-enforced strength policy as signup.');
  });

  it('CONTRACT-F3-002: covers every WBS-04 REST operation with opaque-session protection', async () => {
    const openapi = await readFile('../../docs/baseline/openapi.yaml', 'utf8');
    const operations = [
      ['/products/{productId}/chats', 'post', 'createProductChat'],
      ['/chats', 'get', 'listChats'],
      ['/chats/{chatId}', 'get', 'getChat'],
      ['/chats/{chatId}/messages', 'post', 'sendChatMessage'],
      ['/blocks', 'get', 'listBlockedUsers'],
      ['/blocks', 'post', 'blockUser'],
      ['/blocks/{userId}', 'delete', 'unblockUser'],
      ['/reports', 'post', 'createReport'],
      ['/reports/me', 'get', 'listMyReports'],
    ] as const;

    for (const [path, method, operationId] of operations) {
      const block = pathBlock(openapi, path);
      expect(block).toContain(`    ${method}:`);
      expect(block).toContain(`operationId: ${operationId}`);
      expect(block).toContain('security: [{ sessionCookie: [] }]');
    }

    const operationIds = [...openapi.matchAll(/^\s{6}operationId: (\S+)$/gm)].map((match) => match[1]);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('CONTRACT-F3-003: locks chat, block, and report request validation to the server DTO bounds', async () => {
    const openapi = await readFile('../../docs/baseline/openapi.yaml', 'utf8');
    const message = schemaBlock(openapi, 'SendMessageRequest');
    expect(message).toContain('additionalProperties: false');
    expect(message).toContain('body: { type: string, minLength: 1, maxLength: 1000 }');

    const block = schemaBlock(openapi, 'BlockUserRequest');
    expect(block).toContain('required: [userId]');

    const report = schemaBlock(openapi, 'CreateReportRequest');
    expect(report).toContain('targetType: { type: string, enum: [USER, PRODUCT, MESSAGE] }');
    expect(report).toContain('reason: { type: string, minLength: 2, maxLength: 100 }');
    expect(report).toContain('detail: { type: string, maxLength: 2000 }');

    const responses = openapi.slice(openapi.lastIndexOf('\n  responses:\n'));
    expect(responses).not.toContain('CreateProductRequest:');
  });

  it('CONTRACT-WBS05-004: covers the implemented participant trade REST operations and action bounds', async () => {
    const openapi = await readFile('../../docs/baseline/openapi.yaml', 'utf8');
    const operations = [
      ['/trades', 'get', 'listTrades'],
      ['/trades', 'post', 'requestTrade'],
      ['/trades/{tradeId}', 'get', 'getTrade'],
      ['/trades/{tradeId}/accept', 'post', 'acceptTrade'],
      ['/trades/{tradeId}/reject', 'post', 'rejectTrade'],
      ['/trades/{tradeId}/deliver', 'post', 'deliverTrade'],
      ['/trades/{tradeId}/confirm', 'post', 'confirmTrade'],
      ['/trades/{tradeId}/dispute', 'post', 'disputeTrade'],
      ['/trades/{tradeId}/cancel', 'post', 'cancelTrade'],
    ] as const;

    for (const [path, method, operationId] of operations) {
      const block = pathBlock(openapi, path);
      expect(block).toContain('    ' + method + ':');
      expect(block).toContain('operationId: ' + operationId);
      expect(block).toContain('security: [{ sessionCookie: [] }]');
    }

    expect(pathBlock(openapi, '/trades')).toContain("$ref: '#/components/schemas/CreateTradeRequest'");
    for (const path of ['/trades/{tradeId}/reject', '/trades/{tradeId}/dispute', '/trades/{tradeId}/cancel']) {
      expect(pathBlock(openapi, path)).toContain("$ref: '#/components/schemas/TradeActionRequest'");
    }

    expect(schemaBlock(openapi, 'CreateTradeRequest')).toContain('required: [productId]');
    const action = schemaBlock(openapi, 'TradeActionRequest');
    expect(action).toContain('additionalProperties: false');
    expect(action).toContain('reason: { type: string, minLength: 2, maxLength: 500 }');
  });

  it('CONTRACT-WBS06-006: locks configurable payment routes, DTOs, signatures, raw webhook, and response shapes', async () => {
    const openapi = await readFile('../../docs/baseline/openapi.yaml', 'utf8');
    const participantOperations = [
      ['/payments/orders', 'post', 'createPaymentOrder'],
      ['/payments/{orderId}/confirm', 'post', 'confirmPayment'],
      ['/payments/{orderId}/cancel', 'post', 'cancelPayment'],
      ['/payments/{orderId}/refund', 'post', 'refundPayment'],
      ['/payments/{orderId}', 'get', 'getPayment'],
    ] as const;

    for (const [path, method, operationId] of participantOperations) {
      const block = pathBlock(openapi, path);
      expect(block).toContain('    ' + method + ':');
      expect(block).toContain('operationId: ' + operationId);
      expect(block).toContain('security: [{ sessionCookie: [] }]');
      expect(block).toContain("$ref: '#/components/schemas/PaymentView'");
    }

    for (const path of participantOperations.filter(([, method]) => method === 'post').map(([path]) => path)) {
      const block = pathBlock(openapi, path);
      expect(block).toContain('name: Idempotency-Key');
      expect(block).toContain('in: header');
      expect(block).toContain('required: true');
      expect(block).toContain('minLength: 8, maxLength: 200');
    }

    expect(pathBlock(openapi, '/payments/orders')).toContain("$ref: '#/components/schemas/CreatePaymentOrderRequest'");
    expect(pathBlock(openapi, '/payments/{orderId}/confirm')).toContain("$ref: '#/components/schemas/ConfirmPaymentRequest'");
    for (const path of ['/payments/{orderId}/cancel', '/payments/{orderId}/refund']) {
      expect(pathBlock(openapi, path)).toContain("$ref: '#/components/schemas/PaymentReasonRequest'");
    }

    const confirm = schemaBlock(openapi, 'ConfirmPaymentRequest');
    expect(confirm).toContain('required: [paymentKey, orderId, amountKrw]');
    expect(confirm).toContain('paymentKey: { type: string, minLength: 8, maxLength: 200 }');
    expect(confirm).toContain("amountKrw: { type: string, pattern: '^[0-9]+$'");
    expect(schemaBlock(openapi, 'PaymentReasonRequest')).toContain('reason: { type: string, minLength: 2, maxLength: 500 }');

    const view = schemaBlock(openapi, 'PaymentView');
    expect(view).toContain('status: { type: string, enum: [READY, APPROVED, UNCONFIRMED, FAILED, CANCEL_PENDING, CANCELLED, REFUND_PENDING, REFUNDED] }');
    expect(view).toContain('settlementStatus: { type: string, enum: [HOLD, PAUSED, READY, PROCESSING, SETTLED, FAILED, SANDBOX_SETTLED] }');

    const webhook = pathBlock(openapi, '/payments/webhooks/toss');
    expect(webhook).toContain('operationId: receiveTossPaymentWebhook');
    expect(webhook).toContain('x-raw-body-required: true');
    expect(webhook).toContain('security: []');
    expect(webhook).toContain('name: toss-transmission-id');
    expect(webhook).toContain('name: toss-transmission-time');
    expect(webhook).toContain('name: toss-transmission-signature');
    expect(webhook).toContain("$ref: '#/components/schemas/TossPaymentWebhookRequest'");
    expect(webhook).toContain("'202':");
    expect(webhook).toContain("$ref: '#/components/schemas/PaymentWebhookReceipt'");
    expect(schemaBlock(openapi, 'PaymentWebhookReceipt')).toContain('status: { type: string, enum: [RECEIVED, PROCESSED, IGNORED, FAILED] }');
  });

  it('CONTRACT-WBS07-005: covers SUPER_ADMIN reads, payment operations, and reauthenticated actions', async () => {
    const openapi = await readFile('../../docs/baseline/openapi.yaml', 'utf8');
    const operations = [
      ['/admin/overview', 'get', 'getAdminOverview'],
      ['/admin/users', 'get', 'listAdminUsers'],
      ['/admin/reports', 'get', 'listAdminReports'],
      ['/admin/trades', 'get', 'listAdminTrades'],
      ['/admin/audit-logs', 'get', 'listAdminAuditLogs'],
      ['/admin/payments', 'get', 'listAdminPayments'],
      ['/admin/outbox-events', 'get', 'listFailedOutboxEvents'],
      ['/admin/outbox-events/{eventId}/retry', 'post', 'retryOutboxEvent'],
      ['/admin/payments/{paymentId}/reconcile', 'post', 'reconcileAdminPayment'],
      ['/admin/users/{userId}/suspend', 'post', 'suspendAdminUser'],
      ['/admin/users/{userId}/activate', 'post', 'activateAdminUser'],
      ['/admin/products/{productId}/hide', 'post', 'hideAdminProduct'],
      ['/admin/reports/{reportId}/resolve', 'post', 'resolveAdminReport'],
      ['/admin/reports/{reportId}/dismiss', 'post', 'dismissAdminReport'],
    ] as const;

    for (const [path, method, operationId] of operations) {
      const block = pathBlock(openapi, path);
      expect(block).toContain('    ' + method + ':');
      expect(block).toContain('operationId: ' + operationId);
      expect(block).toContain('security: [{ sessionCookie: [] }]');
      expect(block).toContain('SUPER_ADMIN');
    }

    for (const path of operations.filter(([, method]) => method === 'post').map(([path]) => path)) {
      expect(pathBlock(openapi, path)).toContain("$ref: '#/components/schemas/AdminActionRequest'");
    }

    const action = schemaBlock(openapi, 'AdminActionRequest');
    expect(action).toContain('required: [reason, password]');
    expect(action).toContain('reason: { type: string, minLength: 2, maxLength: 500 }');
    expect(action).toContain('password: { type: string, minLength: 12, maxLength: 200, writeOnly: true }');
    expect(pathBlock(openapi, '/auth/contact-confirmations/request')).toContain('operationId: resendContactConfirmation');
  });
});
