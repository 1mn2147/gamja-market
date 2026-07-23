'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createClientId } from './client-id';

const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
const localSandbox = process.env.NEXT_PUBLIC_PAYMENT_SANDBOX_MODE === 'true';

type Payment = {
  orderId: string;
  paymentKey: string | null;
  amountKrw: string;
  status: string;
  settlementStatus: string;
  methodMasked: string | null;
};

type TossPaymentClient = {
  requestPayment(input: Record<string, unknown>): Promise<void>;
};

declare global {
  interface Window {
    TossPayments?: ((clientKey: string) => { payment(input: { customerKey: string }): TossPaymentClient }) & { ANONYMOUS: string };
  }
}

function loadTossSdk() {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  return new Promise<NonNullable<Window['TossPayments']>>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-toss-payments]');
    const script = existing ?? document.createElement('script');
    if (!existing) {
      script.src = 'https://js.tosspayments.com/v2/standard';
      script.dataset.tossPayments = 'true';
      document.head.append(script);
    }
    script.addEventListener('load', () => window.TossPayments ? resolve(window.TossPayments) : reject(new Error('TOSS_SDK_UNAVAILABLE')), { once: true });
    script.addEventListener('error', () => reject(new Error('TOSS_SDK_UNAVAILABLE')), { once: true });
  });
}

export function PaymentDetail({ orderId }: { orderId: string }) {
  const [payment, setPayment] = useState<Payment>();
  const [message, setMessage] = useState('결제 상태를 확인하는 중입니다.');
  const load = () => void fetch(`/api/v1/payments/${orderId}`, { credentials: 'include' })
    .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<Payment>; })
    .then((result) => { setPayment(result); setMessage(''); })
    .catch(() => setMessage('결제 정보를 찾을 수 없습니다.'));

  useEffect(load, [orderId]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const paymentKey = query.get('paymentKey');
    const redirectedOrderId = query.get('orderId');
    const amount = query.get('amount');
    const failureCode = query.get('code');
    if (failureCode) {
      setMessage(`결제가 완료되지 않았습니다. 오류 코드: ${failureCode}`);
      return;
    }
    if (!paymentKey || redirectedOrderId !== orderId || !amount) return;
    setMessage('결제 승인 결과를 확인하는 중입니다.');
    void fetch(`/api/v1/payments/${orderId}/confirm`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'idempotency-key': `confirm-${paymentKey}` },
      body: JSON.stringify({ paymentKey, orderId, amountKrw: amount }),
    }).then((response) => {
      setMessage(response.ok ? '결제가 승인되었습니다.' : '결제 승인 결과를 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.');
      if (response.ok) {
        window.history.replaceState({}, '', `/payments/${orderId}`);
        load();
      }
    });
  }, [orderId]);

  async function requestPayment() {
    if (!payment) return;
    try {
      if (localSandbox && !tossClientKey) {
        const paymentKey = `sandbox_${createClientId()}`;
        const response = await fetch(`/api/v1/payments/${orderId}/confirm`, {
          method: 'POST', credentials: 'include',
          headers: { 'content-type': 'application/json', 'idempotency-key': `confirm-${paymentKey}` },
          body: JSON.stringify({ paymentKey, orderId, amountKrw: payment.amountKrw }),
        });
        setMessage(response.ok ? '로컬 샌드박스 결제가 승인되었습니다.' : '샌드박스 승인에 실패했습니다.');
        if (response.ok) load();
        return;
      }
      if (!tossClientKey) throw new Error('TOSS_CLIENT_KEY_REQUIRED');
      const TossPayments = await loadTossSdk();
      const client = TossPayments(tossClientKey).payment({ customerKey: TossPayments.ANONYMOUS });
      await client.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: Number(payment.amountKrw) },
        orderId,
        orderName: '감자마켓 안전결제',
        successUrl: `${window.location.origin}/payments/${orderId}`,
        failUrl: `${window.location.origin}/payments/${orderId}`,
      });
    } catch {
      setMessage('결제창을 열 수 없습니다. 연결과 결제 설정을 확인해 주세요.');
    }
  }

  async function reverse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = String(form.get('action'));
    const response = await fetch(`/api/v1/payments/${orderId}/${action}`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json', 'idempotency-key': createClientId() },
      body: JSON.stringify({ reason: form.get('reason') }),
    });
    setMessage(response.ok ? '결제 상태가 변경되었습니다.' : '현재 거래 상태에서는 처리할 수 없습니다.');
    if (response.ok) load();
  }

  if (!payment) return <section><h1>에스크로 결제</h1><p role="status">{message}</p></section>;
  return <section><h1>에스크로 결제</h1>
    <p>{Number(payment.amountKrw).toLocaleString('ko-KR')}원</p>
    <p>결제 {payment.status} · 정산 {payment.settlementStatus}</p>
    {payment.methodMasked && <p>결제수단 {payment.methodMasked}</p>}
    {payment.status === 'READY' && <button onClick={() => void requestPayment()}>{localSandbox && !tossClientKey ? '로컬 샌드박스 승인' : 'Toss로 결제하기'}</button>}
    {payment.status === 'APPROVED' && <form onSubmit={reverse}><label>사유<input name="reason" required minLength={2} /></label><button name="action" value="cancel">결제 취소</button><button name="action" value="refund">환불 요청</button></form>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
