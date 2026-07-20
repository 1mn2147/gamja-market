'use client';

import { FormEvent, useEffect, useState } from 'react';

const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';
type Payment = {
  orderId: string;
  paymentKey: string | null;
  amountKrw: string;
  status: string;
  settlementStatus: string;
  methodMasked: string | null;
};

export function PaymentDetail({ orderId }: { orderId: string }) {
  const [payment, setPayment] = useState<Payment>();
  const [message, setMessage] = useState('결제 상태를 확인하는 중입니다.');
  const load = () => void fetch(`${origin}/api/v1/payments/${orderId}`, { credentials: 'include' })
    .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<Payment>; })
    .then((result) => { setPayment(result); setMessage(''); })
    .catch(() => setMessage('결제 정보를 찾을 수 없습니다.'));
  useEffect(load, [orderId]);

  async function confirm() {
    if (!payment) return;
    const paymentKey = `sandbox_${crypto.randomUUID()}`;
    const response = await fetch(`${origin}/api/v1/payments/${orderId}/confirm`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ paymentKey, orderId, amountKrw: payment.amountKrw }),
    });
    setMessage(response.ok ? '결제가 sandbox에서 승인되었습니다.' : '결제 승인 정보가 일치하지 않습니다.');
    if (response.ok) load();
  }

  async function reverse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = String(form.get('action'));
    const response = await fetch(`${origin}/api/v1/payments/${orderId}/${action}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
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
    <p>이 화면은 Toss sandbox 동작만 검증하며 실제 결제나 정산을 수행하지 않습니다.</p>
    {payment.status === 'READY' && <button onClick={() => void confirm()}>Sandbox 결제 승인</button>}
    {payment.status === 'APPROVED' && <form onSubmit={reverse}><label>사유<input name="reason" required minLength={2} /></label><button name="action" value="cancel">결제 취소</button><button name="action" value="refund">환불 요청</button></form>}
    <p role="status">{message}</p>
  </section>;
}
