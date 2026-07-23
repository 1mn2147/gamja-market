'use client';

import { FormEvent, useEffect, useState } from 'react';

type Overview = { users: number; products: number; openReports: number; activeTrades: number };
type User = { id: string; email: string | null; phone: string | null; status: string; role: string };
type Payment = { id: string; orderId: string; amountKrw: string; status: string; settlementStatus: string; failureCode: string | null };
type OutboxEvent = { id: string; type: string; status: string; attempts: number; lastError: string | null };

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview>();
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [events, setEvents] = useState<OutboxEvent[]>([]);
  const [message, setMessage] = useState('관리자 데이터를 불러오는 중입니다.');

  const load = () => {
    void Promise.all([
      fetch('/api/v1/admin/overview', { credentials: 'include' }),
      fetch('/api/v1/admin/users', { credentials: 'include' }),
      fetch('/api/v1/admin/payments', { credentials: 'include' }),
      fetch('/api/v1/admin/outbox-events', { credentials: 'include' }),
    ]).then(async ([overviewResponse, usersResponse, paymentsResponse, eventsResponse]) => {
      if (!overviewResponse.ok || !usersResponse.ok || !paymentsResponse.ok || !eventsResponse.ok) throw new Error();
      setOverview(await overviewResponse.json());
      const result = await usersResponse.json() as { users: User[] };
      setUsers(result.users);
      setPayments(((await paymentsResponse.json()) as { payments: Payment[] }).payments);
      setEvents(((await eventsResponse.json()) as { events: OutboxEvent[] }).events);
      setMessage('');
    }).catch(() => setMessage('최고관리자 권한이 필요합니다.'));
  };
  useEffect(load, []);

  async function action(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const userId = String(form.get('userId'));
    const status = String(form.get('status'));
    const response = await fetch(`/api/v1/admin/users/${userId}/${status}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: form.get('reason'), password: form.get('password') }),
    });
    setMessage(response.ok ? '관리자 조치가 기록되었습니다.' : '재인증 또는 권한을 확인해 주세요.');
    if (response.ok) load();
  }

  async function operation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const path = String(form.get('path'));
    const response = await fetch(`/api/v1/admin/${path}`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: form.get('reason'), password: form.get('password') }),
    });
    setMessage(response.ok ? '운영 작업과 감사 로그가 기록되었습니다.' : '운영 작업에 실패했습니다. 제공자 상태와 재인증을 확인해 주세요.');
    if (response.ok) load();
  }

  return <main><h1>운영 관리</h1><p role="status">{message}</p>
    {overview && <dl><div><dt>사용자</dt><dd>{overview.users}</dd></div><div><dt>상품</dt><dd>{overview.products}</dd></div><div><dt>미처리 신고</dt><dd>{overview.openReports}</dd></div><div><dt>활성 거래</dt><dd>{overview.activeTrades}</dd></div></dl>}
    <h2>사용자 조치</h2>
    <ul>{users.map((user) => <li key={user.id}><span>{user.email ?? user.phone ?? user.id} · {user.status}</span>{user.role !== 'SUPER_ADMIN' && <form onSubmit={action}><input type="hidden" name="userId" value={user.id} /><label>조치<select name="status" defaultValue="suspend"><option value="suspend">이용정지</option><option value="activate">복구</option></select></label><label>사유<input name="reason" required minLength={2} /></label><label>관리자 비밀번호<input name="password" type="password" required minLength={12} /></label><button>조치 실행</button></form>}</li>)}</ul>
    <h2>결제·정산 운영</h2>
    <ul>{payments.map((payment) => <li key={payment.id}><span>{payment.orderId} · {Number(payment.amountKrw).toLocaleString('ko-KR')}원 · {payment.status}/{payment.settlementStatus}{payment.failureCode ? ` · ${payment.failureCode}` : ''}</span><form onSubmit={operation}><input type="hidden" name="path" value={`payments/${payment.id}/reconcile`} /><label>대사 사유<input name="reason" required minLength={2} /></label><label>관리자 비밀번호<input name="password" type="password" required minLength={12} /></label><button>제공자 대사</button></form></li>)}</ul>
    <h2>실패 이벤트</h2>
    <ul>{events.map((item) => <li key={item.id}><span>{item.type} · {item.status} · 시도 {item.attempts}회{item.lastError ? ` · ${item.lastError}` : ''}</span><form onSubmit={operation}><input type="hidden" name="path" value={`outbox-events/${item.id}/retry`} /><label>재처리 사유<input name="reason" required minLength={2} /></label><label>관리자 비밀번호<input name="password" type="password" required minLength={12} /></label><button>재처리</button></form></li>)}</ul>
  </main>;
}
