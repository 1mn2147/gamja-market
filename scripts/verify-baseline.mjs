import { readFile } from 'node:fs/promises';

const required = [
  'docs/baseline/README.md',
  'docs/baseline/traceability.md',
  'docs/baseline/decision-register.md',
  'docs/baseline/adr/0001-architecture-baseline.md',
  'docs/baseline/domain-state-model.md',
  'docs/baseline/api-contract.md',
  'docs/baseline/openapi.yaml',
  'docs/baseline/payment-threat-model.md',
];

const contents = await Promise.all(required.map(async (file) => [file, await readFile(file, 'utf8')]));
const requirements = await readFile('docs/requirements.md', 'utf8');
const requirementIds = [...requirements.matchAll(/^\| ((?:AUTH|ITEM|SEARCH|CHAT|PAY|SAFE|ADMIN|SEC)-\d{3}) /gm)].map((match) => match[1]);

if (requirementIds.length !== 88 || new Set(requirementIds).size !== 88) {
  throw new Error(`Expected 88 unique requirement IDs, received ${requirementIds.length}.`);
}

const byFile = new Map(contents);
const trace = byFile.get('docs/baseline/traceability.md');
for (const prefix of ['AUTH', 'ITEM', 'SEARCH', 'CHAT', 'PAY', 'SAFE', 'ADMIN', 'SEC']) {
  if (!trace.includes(`${prefix}-001`)) throw new Error(`Traceability matrix is missing ${prefix}.`);
}

const openapi = byFile.get('docs/baseline/openapi.yaml');
for (const expected of [
  'openapi: 3.1.0',
  '/healthz:',
  '/readyz:',
  '/products/{productId}/chats:',
  '/chats/{chatId}/messages:',
  '/blocks/{userId}:',
  '/reports/me:',
  '/trades/{tradeId}/cancel:',
  '/payments/orders:',
  '/payments/{orderId}/confirm:',
  '/payments/{orderId}/cancel:',
  '/payments/{orderId}/refund:',
  '/payments/{orderId}:',
  '/payments/webhooks/toss:',
  '/admin/overview:',
  '/admin/audit-logs:',
  'SendMessageRequest:',
  'BlockUserRequest:',
  'CreateReportRequest:',
  'CreateTradeRequest:',
  'TradeActionRequest:',
  'CreatePaymentOrderRequest:',
  'ConfirmPaymentRequest:',
  'PaymentReasonRequest:',
  'TossPaymentWebhookRequest:',
  'PaymentView:',
  'PaymentWebhookReceipt:',
  'name: Idempotency-Key',
  'name: toss-transmission-id',
  'x-raw-body-required: true',
  'x-sandbox-only: true',
  'AdminActionRequest:',
  'application/problem+json',
]) {
  if (!openapi.includes(expected)) throw new Error(`OpenAPI baseline is missing ${expected}.`);
}

console.log(`Baseline verification passed: ${required.length} artifacts, ${requirementIds.length} requirements.`);
