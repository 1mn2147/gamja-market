export type OutboxEventType = 'audit.recorded' | 'ledger.recorded' | 'webhook.received';

export interface OutboxEvent<TPayload = Record<string, never>> {
  id: string;
  type: OutboxEventType;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  payload: TPayload;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  requestId: string;
  errors?: Array<{ field?: string; code: string; message?: string }>;
}
