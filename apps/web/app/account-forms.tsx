'use client';

import { FormEvent, useEffect, useState } from 'react';

const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';

type Account = {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  neighborhood: { code: string; name: string } | null;
};

type ApiBody = { code?: string; user?: Account; status?: string; retentionUntil?: string };

async function api(path: string, method: string, body?: Record<string, unknown>): Promise<ApiBody> {
  const options: RequestInit = { method, credentials: 'include' };
  if (body) {
    options.headers = { 'content-type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${apiOrigin}/api/v1${path}`, options);
  if (response.status === 204) return {};
  const result = await response.json() as ApiBody;
  if (!response.ok) throw new Error(result.code ?? 'REQUEST_FAILED');
  return result;
}

function Message({ value }: { value: string }) {
  return <p role="status" aria-live="polite">{value}</p>;
}

export function LoginForm() {
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/auth/login', 'POST', { identifier: form.get('identifier'), password: form.get('password') });
      window.location.assign('/me');
    } catch (error) {
      setMessage(error instanceof Error ? '로그인에 실패했습니다. 입력 정보를 확인해 주세요.' : '로그인에 실패했습니다.');
    }
  }
  return <form onSubmit={submit}><label>이메일 또는 휴대전화<input name="identifier" autoComplete="username" required /></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required minLength={12} /></label><button type="submit">로그인</button><Message value={message} /></form>;
}

export function SignupForm() {
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get('email') || form.get('phone') || '');
    try {
      await api('/auth/signups', 'POST', { email: form.get('email') || undefined, phone: form.get('phone') || undefined, password: form.get('password'), adultConfirmed: form.get('adultConfirmed') === 'on' });
      sessionStorage.setItem('verification-identifier', identifier);
      window.location.assign('/verify');
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'CONTACT_ALREADY_REGISTERED' ? '이미 등록된 연락처입니다.' : '가입을 완료할 수 없습니다. 입력을 확인해 주세요.');
    }
  }
  return <form onSubmit={submit}><p>연락처 입력, 소유 인증, 성인 확인, 비밀번호 설정 순서로 진행됩니다.</p><label>이메일<input name="email" type="email" autoComplete="email" /></label><label>또는 휴대전화<input name="phone" inputMode="tel" autoComplete="tel" /></label><label>비밀번호 (12자 이상)<input name="password" type="password" autoComplete="new-password" required minLength={12} /></label><label><input name="adultConfirmed" type="checkbox" required /> 만 19세 이상입니다.</label><button type="submit">인증 코드 받기</button><Message value={message} /></form>;
}

export function VerifyForm() {
  const [message, setMessage] = useState('');
  const [identifier, setIdentifier] = useState('');
  useEffect(() => setIdentifier(sessionStorage.getItem('verification-identifier') ?? ''), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/auth/contact-confirmations', 'POST', { identifier, code: form.get('code') });
      sessionStorage.removeItem('verification-identifier');
      window.location.assign('/login');
    } catch {
      setMessage('인증 코드가 올바르지 않거나 만료됐습니다.');
    }
  }
  return <form onSubmit={submit}><label>인증할 연락처<input value={identifier} onChange={(event) => setIdentifier(event.currentTarget.value)} required /></label><label>6자리 인증 코드<input name="code" inputMode="numeric" pattern="[0-9]{6}" required /></label><button type="submit">인증 완료</button><Message value={message} /></form>;
}

export function PasswordResetForm() {
  const [identifier, setIdentifier] = useState('');
  const [requested, setRequested] = useState(false);
  const [message, setMessage] = useState('');
  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api('/auth/password-resets', 'POST', { identifier });
      setRequested(true);
      setMessage('등록된 연락처라면 재설정 코드를 보냈습니다.');
    } catch { setMessage('요청을 처리할 수 없습니다.'); }
  }
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/auth/password-resets/confirm', 'POST', { identifier, code: form.get('code'), newPassword: form.get('newPassword') });
      window.location.assign('/login');
    } catch { setMessage('인증 코드 또는 새 비밀번호를 확인해 주세요.'); }
  }
  if (requested) return <form onSubmit={reset}><p>{message}</p><label>6자리 인증 코드<input name="code" inputMode="numeric" pattern="[0-9]{6}" required /></label><label>새 비밀번호<input name="newPassword" type="password" autoComplete="new-password" minLength={12} required /></label><button type="submit">비밀번호 변경</button></form>;
  return <form onSubmit={requestCode}><label>검증된 이메일 또는 휴대전화<input value={identifier} onChange={(event) => setIdentifier(event.currentTarget.value)} required /></label><button type="submit">재설정 코드 받기</button><Message value={message} /></form>;
}

export function AccountPanel() {
  const [account, setAccount] = useState<Account>();
  const [message, setMessage] = useState('계정 정보를 불러오는 중입니다.');
  useEffect(() => { void api('/auth/me', 'GET').then((body) => { if (body.user) setAccount(body.user); setMessage(''); }).catch(() => { setMessage('로그인이 필요합니다.'); }); }, []);
  async function logout() { await api('/auth/logout', 'POST'); window.location.assign('/'); }
  async function withdraw() {
    if (!window.confirm('탈퇴하면 로그인할 수 없으며 개인정보·채팅·거래 데이터는 정책에 따라 탈퇴 후 1년까지 보관됩니다. 계속할까요?')) return;
    const result = await api('/auth/me/withdrawal', 'POST');
    setMessage(`탈퇴 처리되었습니다. 보존 기한: ${result.retentionUntil ?? ''}`);
    setAccount(undefined);
  }
  if (!account) return <Message value={message} />;
  return <section><p>{account.email ?? account.phone} · {account.status}</p><p>선택 동네: {account.neighborhood?.name ?? '선택하지 않음'}</p><button type="button" onClick={logout}>로그아웃</button><button type="button" onClick={() => void withdraw()}>회원 탈퇴</button><Message value={message} /></section>;
}
