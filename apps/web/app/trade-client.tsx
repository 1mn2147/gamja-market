'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { createClientId } from './client-id';

type Trade = {
  id: string;
  status: string;
  priceKrw: string;
  role: 'BUYER' | 'SELLER';
  reason: string | null;
  updatedAt: string;
  product: { id: string; title: string; status: string };
  payment: {
    orderId: string;
    status: string;
    settlementStatus: string;
    approvedAt: string | null;
    settlementAvailableAt: string | null;
    settledAt: string | null;
  } | null;
  history?: Array<{ id: string; toStatus: string; reason?: string; occurredAt: string }>;
};

class TradeApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const tradeStatusLabel: Record<string, string> = {
  REQUESTED: '거래 요청',
  ACCEPTED: '판매자 수락',
  REJECTED: '요청 거절',
  DELIVERED: '인도 완료',
  CONFIRMED: '구매 확정',
  DISPUTED: '분쟁 처리 중',
  CANCELLED: '거래 취소',
};

const paymentStatusLabel: Record<string, string> = {
  READY: '결제 대기',
  APPROVED: '에스크로 결제 완료',
  UNCONFIRMED: '결제 확인 중',
  FAILED: '결제 실패',
  CANCEL_PENDING: '결제 취소 처리 중',
  CANCELLED: '결제 취소',
  REFUND_PENDING: '환불 처리 중',
  REFUNDED: '환불 완료',
};

const reasonLabel: Record<string, string> = {
  PRODUCT_RESERVED_BY_ANOTHER_TRADE: '다른 구매자의 거래 요청이 먼저 수락되었습니다.',
  AUTO_CANCELLED_UNPAID_AFTER_7_DAYS: '수락 후 7일 동안 결제가 없어 거래가 자동 취소되었습니다.',
};

function actionErrorMessage(error: unknown) {
  const code = error instanceof TradeApiError ? error.code : '';
  const messages: Record<string, string> = {
    PRODUCT_ALREADY_RESERVED: '다른 구매자의 거래가 이미 수락되어 이 요청을 진행할 수 없습니다.',
    ESCROW_PAYMENT_REQUIRED: '에스크로 결제가 완료된 뒤에 인도 완료로 표시할 수 있습니다.',
    PAYMENT_REVERSAL_REQUIRED: '결제 완료 거래는 결제 상세에서 취소를 요청해 주세요.',
    PAYMENT_CANCELLATION_WINDOW_EXPIRED: '결제일로부터 7일이 지나 취소 가능 기간이 끝났습니다.',
    TRADE_NOT_FOUND: '거래를 찾을 수 없거나 이 작업을 수행할 권한이 없습니다.',
  };
  return messages[code] ?? '현재 거래 상태에서는 이 작업을 수행할 수 없습니다.';
}

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const options: RequestInit = { method, credentials: 'include' };
  if (body !== undefined) {
    options.headers = { 'content-type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`/api/v1${path}`, options);
  if (!response.ok) {
    const problem = await response.json().catch(() => undefined) as { code?: string } | undefined;
    throw new TradeApiError(problem?.code ?? 'TRADE_REQUEST_FAILED');
  }
  return response.json() as Promise<T>;
}

export function TradeList() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [message, setMessage] = useState('거래를 불러오는 중입니다.');
  useEffect(() => {
    void api<{ trades: Trade[] }>('/trades')
      .then((result) => { setTrades(result.trades); setMessage(result.trades.length ? '' : '진행 중인 거래가 없습니다.'); })
      .catch(() => setMessage('로그인이 필요합니다.'));
  }, []);
  return <><p role="status">{message}</p><ul>{trades.map((trade) => <li key={trade.id}><Link href={`/trades/${trade.id}`}>{trade.product.title}</Link><p>{tradeStatusLabel[trade.status] ?? trade.status} · {Number(trade.priceKrw).toLocaleString('ko-KR')}원{trade.payment ? ` · ${paymentStatusLabel[trade.payment.status] ?? trade.payment.status}` : ''}</p></li>)}</ul></>;
}

export function TradeDetail({ id }: { id: string }) {
  const [trade, setTrade] = useState<Trade>();
  const [message, setMessage] = useState('거래를 불러오는 중입니다.');
  const load = () => void api<Trade>(`/trades/${id}`).then((result) => { setTrade(result); setMessage(''); }).catch(() => setMessage('거래를 찾을 수 없습니다.'));
  useEffect(load, [id]);
  async function action(name: string, reason?: string) {
    try {
      await api(`/trades/${id}/${name}`, 'POST', reason ? { reason } : undefined);
      load();
    } catch (error) {
      setMessage(actionErrorMessage(error));
    }
  }
  async function createPayment() {
    try {
      const response = await fetch('/api/v1/payments/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'idempotency-key': createClientId() },
        body: JSON.stringify({ tradeId: id }),
      });
      if (!response.ok) throw new Error();
      const payment = await response.json() as { orderId: string };
      window.location.assign(`/payments/${payment.orderId}`);
    } catch (error) {
      setMessage(actionErrorMessage(error) === '현재 거래 상태에서는 이 작업을 수행할 수 없습니다.'
        ? '결제 주문을 만들 수 없습니다. 거래 상태를 새로 확인해 주세요.'
        : actionErrorMessage(error));
    }
  }
  function reasonAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action(String(form.get('action')), String(form.get('reason')));
  }
  if (!trade) return <section><h1>거래 상세</h1><p role="status">{message}</p></section>;
  const paymentApproved = trade.payment?.status === 'APPROVED';
  const canCancelTrade = trade.status === 'REQUESTED' || (trade.status === 'ACCEPTED' && !paymentApproved);
  const paymentDueAt = trade.status === 'ACCEPTED' && !trade.payment
    ? new Date(new Date(trade.updatedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
    : undefined;
  return <section><h1>{trade.product.title} 거래</h1><p>{Number(trade.priceKrw).toLocaleString('ko-KR')}원 · {tradeStatusLabel[trade.status] ?? trade.status}</p><p role="status" aria-live="polite">{message}</p>
    {trade.reason && <p>{reasonLabel[trade.reason] ?? trade.reason}</p>}
    <section aria-labelledby="escrow-heading"><h2 id="escrow-heading">에스크로 상태</h2>
      {trade.payment
        ? <><p>{paymentStatusLabel[trade.payment.status] ?? trade.payment.status} · 정산 {trade.payment.settlementStatus}</p><p><Link href={`/payments/${trade.payment.orderId}`}>결제 상세 보기</Link></p></>
        : <p>생성된 결제 주문이 없습니다.</p>}
      {paymentDueAt && <p>결제 기한: <time dateTime={paymentDueAt.toISOString()}>{paymentDueAt.toLocaleString('ko-KR')}</time> · 기한이 지나면 예약이 자동 해제됩니다.</p>}
    </section>
    {trade.role === 'SELLER' && trade.status === 'REQUESTED' && <><button onClick={() => void action('accept')}>거래 요청 수락</button><form onSubmit={reasonAction}><input type="hidden" name="action" value="reject" /><label>거절 사유<input name="reason" required minLength={2} /></label><button>거절</button></form></>}
    {trade.role === 'SELLER' && trade.status === 'ACCEPTED' && (paymentApproved
      ? <button onClick={() => void action('deliver')}>인도 완료로 표시</button>
      : <p>구매자의 에스크로 결제를 기다리고 있습니다. 결제 전에는 인도 완료로 표시할 수 없습니다.</p>)}
    {trade.role === 'BUYER' && trade.status === 'DELIVERED' && <button onClick={() => void action('confirm')}>구매 확정하기</button>}
    {trade.role === 'BUYER' && trade.status === 'ACCEPTED' && !trade.payment && <button onClick={() => void createPayment()}>에스크로 결제하기</button>}
    {trade.role === 'BUYER' && trade.status === 'ACCEPTED' && trade.payment?.status === 'READY' && <Link href={`/payments/${trade.payment.orderId}`}>에스크로 결제 계속하기</Link>}
    {trade.role === 'BUYER' && trade.status === 'ACCEPTED' && paymentApproved && <p>에스크로 결제가 완료되었습니다. 판매자와 인도 일정을 확인해 주세요.</p>}
    {canCancelTrade && <form onSubmit={reasonAction}><input type="hidden" name="action" value="cancel" /><label>취소 사유<input name="reason" required minLength={2} /></label><button>거래 취소</button></form>}
    {trade.status === 'ACCEPTED' && paymentApproved && trade.payment && <p>결제 취소는 <Link href={`/payments/${trade.payment.orderId}`}>결제 상세</Link>에서 요청할 수 있습니다.</p>}
    {['ACCEPTED', 'DELIVERED', 'CONFIRMED'].includes(trade.status) && <form onSubmit={reasonAction}><input type="hidden" name="action" value="dispute" /><label>분쟁 사유<input name="reason" required minLength={2} /></label><button>분쟁 신청</button></form>}
    <h2>거래 이력</h2><ol>{trade.history?.map((item) => <li key={item.id}>{tradeStatusLabel[item.toStatus] ?? item.toStatus} · <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString('ko-KR')}</time>{item.reason ? ` · ${reasonLabel[item.reason] ?? item.reason}` : ''}</li>)}</ol>
  </section>;
}
