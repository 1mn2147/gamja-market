import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';

export type TossPayment = {
  paymentKey: string;
  orderId: string;
  amountKrw: bigint;
  status: 'DONE' | 'CANCELED' | 'REFUNDED';
  methodMasked: string;
};

type TossResponse = {
  paymentKey: string;
  orderId: string;
  totalAmount: number;
  status: string;
  method?: string;
  card?: { number?: string };
};

/**
 * Toss Payments boundary. With a secret key it calls the real sandbox/production
 * HTTP API. The deterministic in-memory implementation is only available for
 * tests or when TOSS_SANDBOX_MODE=true is explicitly configured.
 */
@Injectable()
export class TossSandboxAdapter {
  private readonly payments = new Map<string, TossPayment>();
  private readonly secretKey = process.env.TOSS_SECRET_KEY ?? process.env.TOSS_SANDBOX_SECRET_KEY;
  private readonly baseUrl = process.env.TOSS_API_ORIGIN ?? 'https://api.tosspayments.com';

  private useMemorySandbox() {
    return process.env.NODE_ENV === 'test' || process.env.TOSS_SANDBOX_MODE === 'true';
  }

  private assertConfigured() {
    if (!this.secretKey) {
      throw new ServiceUnavailableException({ code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' });
    }
  }

  private async request(path: string, init: RequestInit = {}) {
    this.assertConfigured();
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(8_000),
        headers: {
          authorization: `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`,
          'content-type': 'application/json',
          ...init.headers,
        },
      });
    } catch {
      throw new ServiceUnavailableException({ code: 'PAYMENT_PROVIDER_UNAVAILABLE' });
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { code?: string };
      throw new BadGatewayException({ code: body.code ?? 'PAYMENT_PROVIDER_REJECTED' });
    }
    return response.json() as Promise<TossResponse>;
  }

  private normalize(payment: TossResponse): TossPayment {
    const status = payment.status === 'DONE'
      ? 'DONE'
      : payment.status === 'CANCELED' || payment.status === 'PARTIAL_CANCELED'
        ? 'CANCELED'
        : 'REFUNDED';
    return {
      paymentKey: payment.paymentKey,
      orderId: payment.orderId,
      amountKrw: BigInt(payment.totalAmount),
      status,
      methodMasked: payment.card?.number ?? payment.method ?? '결제수단 비공개',
    };
  }

  async confirm(input: { paymentKey: string; orderId: string; amountKrw: bigint; idempotencyKey?: string }): Promise<TossPayment> {
    if (this.useMemorySandbox()) {
      const existing = this.payments.get(input.paymentKey);
      if (existing) return existing;
      const payment = { paymentKey: input.paymentKey, orderId: input.orderId, amountKrw: input.amountKrw, status: 'DONE' as const, methodMasked: '카드 ****-****-****-4242' };
      this.payments.set(input.paymentKey, payment);
      return payment;
    }
    const result = await this.request('/v1/payments/confirm', {
      method: 'POST',
      headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {},
      body: JSON.stringify({ paymentKey: input.paymentKey, orderId: input.orderId, amount: Number(input.amountKrw) }),
    });
    return this.normalize(result);
  }

  async cancel(paymentKey: string, reason = '사용자 요청 취소', idempotencyKey?: string): Promise<TossPayment | undefined> {
    if (this.useMemorySandbox()) {
      const existing = this.payments.get(paymentKey);
      if (!existing) return undefined;
      const cancelled = { ...existing, status: 'CANCELED' as const };
      this.payments.set(paymentKey, cancelled);
      return cancelled;
    }
    return this.normalize(await this.request(`/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
      method: 'POST', headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}, body: JSON.stringify({ cancelReason: reason }),
    }));
  }

  async refund(paymentKey: string, reason = '분쟁 환불', idempotencyKey?: string): Promise<TossPayment | undefined> {
    if (this.useMemorySandbox()) {
      const existing = this.payments.get(paymentKey);
      if (!existing) return undefined;
      const refunded = { ...existing, status: 'REFUNDED' as const };
      this.payments.set(paymentKey, refunded);
      return refunded;
    }
    const result = await this.request(`/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
      method: 'POST', headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}, body: JSON.stringify({ cancelReason: reason }),
    });
    return { ...this.normalize(result), status: 'REFUNDED' };
  }

  async lookup(paymentKey: string): Promise<TossPayment | undefined> {
    if (this.useMemorySandbox()) return this.payments.get(paymentKey);
    return this.normalize(await this.request(`/v1/payments/${encodeURIComponent(paymentKey)}`));
  }
}
