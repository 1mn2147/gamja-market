import { Injectable } from '@nestjs/common';

export type TossSandboxPayment = {
  paymentKey: string;
  orderId: string;
  amountKrw: bigint;
  status: 'DONE' | 'CANCELED' | 'REFUNDED';
  methodMasked: string;
};

@Injectable()
export class TossSandboxAdapter {
  private readonly payments = new Map<string, TossSandboxPayment>();

  confirm(input: { paymentKey: string; orderId: string; amountKrw: bigint }): TossSandboxPayment {
    const existing = this.payments.get(input.paymentKey);
    if (existing) return existing;
    const payment = {
      ...input,
      status: 'DONE' as const,
      methodMasked: '카드 ****-****-****-4242',
    };
    this.payments.set(input.paymentKey, payment);
    return payment;
  }

  cancel(paymentKey: string): TossSandboxPayment | undefined {
    const existing = this.payments.get(paymentKey);
    if (!existing) return undefined;
    const cancelled = { ...existing, status: 'CANCELED' as const };
    this.payments.set(paymentKey, cancelled);
    return cancelled;
  }

  refund(paymentKey: string): TossSandboxPayment | undefined {
    const existing = this.payments.get(paymentKey);
    if (!existing) return undefined;
    const refunded = { ...existing, status: 'REFUNDED' as const };
    this.payments.set(paymentKey, refunded);
    return refunded;
  }

  lookup(paymentKey: string): TossSandboxPayment | undefined {
    return this.payments.get(paymentKey);
  }
}
