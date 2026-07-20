'use client';

import { FormEvent, useEffect, useState } from 'react';

const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';
type Overview = { users: number; products: number; openReports: number; activeTrades: number };
type User = { id: string; email: string | null; phone: string | null; status: string; role: string };

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview>();
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState('관리자 데이터를 불러오는 중입니다.');

  const load = () => {
    void Promise.all([
      fetch(`${origin}/api/v1/admin/overview`, { credentials: 'include' }),
      fetch(`${origin}/api/v1/admin/users`, { credentials: 'include' }),
    ]).then(async ([overviewResponse, usersResponse]) => {
      if (!overviewResponse.ok || !usersResponse.ok) throw new Error();
      setOverview(await overviewResponse.json());
      const result = await usersResponse.json() as { users: User[] };
      setUsers(result.users);
      setMessage('');
    }).catch(() => setMessage('최고관리자 권한이 필요합니다.'));
  };
  useEffect(load, []);

  async function action(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const userId = String(form.get('userId'));
    const status = String(form.get('status'));
    const response = await fetch(`${origin}/api/v1/admin/users/${userId}/${status}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: form.get('reason'), password: form.get('password') }),
    });
    setMessage(response.ok ? '관리자 조치가 기록되었습니다.' : '재인증 또는 권한을 확인해 주세요.');
    if (response.ok) load();
  }

  return <main><h1>운영 관리</h1><p role="status">{message}</p>
    {overview && <dl><div><dt>사용자</dt><dd>{overview.users}</dd></div><div><dt>상품</dt><dd>{overview.products}</dd></div><div><dt>미처리 신고</dt><dd>{overview.openReports}</dd></div><div><dt>활성 거래</dt><dd>{overview.activeTrades}</dd></div></dl>}
    <h2>사용자 조치</h2>
    <ul>{users.map((user) => <li key={user.id}><span>{user.email ?? user.phone ?? user.id} · {user.status}</span>{user.role !== 'SUPER_ADMIN' && <form onSubmit={action}><input type="hidden" name="userId" value={user.id} /><label>조치<select name="status" defaultValue="suspend"><option value="suspend">이용정지</option><option value="activate">복구</option></select></label><label>사유<input name="reason" required minLength={2} /></label><label>관리자 비밀번호<input name="password" type="password" required minLength={12} /></label><button>조치 실행</button></form>}</li>)}</ul>
  </main>;
}
