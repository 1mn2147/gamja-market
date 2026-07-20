'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';
type Trade = {
  id: string;
  status: string;
  priceKrw: string;
  role: 'BUYER' | 'SELLER';
  product: { id: string; title: string; status: string };
  history?: Array<{ id: string; toStatus: string; reason?: string; occurredAt: string }>;
};

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const options: RequestInit = { method, credentials: 'include' };
  if (body !== undefined) {
    options.headers = { 'content-type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${origin}/api/v1${path}`, options);
  if (!response.ok) throw new Error('TRADE_REQUEST_FAILED');
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
  return <><p role="status">{message}</p><ul>{trades.map((trade) => <li key={trade.id}><Link href={`/trades/${trade.id}`}>{trade.product.title}</Link><p>{trade.status} · {Number(trade.priceKrw).toLocaleString('ko-KR')}원</p></li>)}</ul></>;
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
    } catch {
      setMessage('현재 상태에서는 이 작업을 수행할 수 없습니다.');
    }
  }
  async function createPayment() {
    try {
      const response = await fetch(`${origin}/api/v1/payments/orders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ tradeId: id }),
      });
      if (!response.ok) throw new Error();
      const payment = await response.json() as { orderId: string };
      window.location.assign(`/payments/${payment.orderId}`);
    } catch {
      setMessage('결제 주문을 만들 수 없습니다.');
    }
  }
  function reasonAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action(String(form.get('action')), String(form.get('reason')));
  }
  if (!trade) return <section><h1>거래 상세</h1><p role="status">{message}</p></section>;
  return <section><h1>{trade.product.title} 거래</h1><p>{Number(trade.priceKrw).toLocaleString('ko-KR')}원 · {trade.status}</p><p role="status">{message}</p>
    {trade.role === 'SELLER' && trade.status === 'REQUESTED' && <><button onClick={() => void action('accept')}>거래 요청 수락</button><form onSubmit={reasonAction}><input type="hidden" name="action" value="reject" /><label>거절 사유<input name="reason" required minLength={2} /></label><button>거절</button></form></>}
    {trade.role === 'SELLER' && trade.status === 'ACCEPTED' && <button onClick={() => void action('deliver')}>인도 완료로 표시</button>}
    {trade.role === 'BUYER' && trade.status === 'DELIVERED' && <button onClick={() => void action('confirm')}>구매 확정하기</button>}
    {trade.role === 'BUYER' && trade.status === 'ACCEPTED' && <button onClick={() => void createPayment()}>에스크로 결제하기</button>}
    {['REQUESTED', 'ACCEPTED'].includes(trade.status) && <form onSubmit={reasonAction}><input type="hidden" name="action" value="cancel" /><label>취소 사유<input name="reason" required minLength={2} /></label><button>거래 취소</button></form>}
    {['ACCEPTED', 'DELIVERED', 'CONFIRMED'].includes(trade.status) && <form onSubmit={reasonAction}><input type="hidden" name="action" value="dispute" /><label>분쟁 사유<input name="reason" required minLength={2} /></label><button>분쟁 신청</button></form>}
    <h2>거래 이력</h2><ol>{trade.history?.map((item) => <li key={item.id}>{item.toStatus} · <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString('ko-KR')}</time>{item.reason ? ` · ${item.reason}` : ''}</li>)}</ol>
  </section>;
}
