'use client';

import { FormEvent, useEffect, useState } from 'react';
import { evaluatePassword, passwordPolicyMessage, type PasswordPolicyResult } from './password-policy';

type Account = {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  neighborhood: { code: string; name: string } | null;
};

type ApiBody = { code?: string; debugCode?: string; user?: Account; status?: string; retentionUntil?: string; hiddenProductCount?: number };

async function api(path: string, method: string, body?: Record<string, unknown>): Promise<ApiBody> {
  const options: RequestInit = { method, credentials: 'include' };
  if (body) {
    options.headers = { 'content-type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  // Account requests use the same-origin web gateway. This avoids embedded
  // browsers blocking direct cross-port requests to localhost:4000 and keeps
  // session cookies on the page origin.
  const response = await fetch(`/api/v1${path}`, options);
  if (response.status === 204) return {};
  const result = await response.json() as ApiBody;
  if (!response.ok) throw new Error(result.code ?? 'REQUEST_FAILED');
  return result;
}

function Message({ value }: { value: string }) {
  return <p role="status" aria-live="polite">{value}</p>;
}

function PasswordPolicyChecklist({ id, result }: { id: string; result: PasswordPolicyResult }) {
  const checks = [
    [result.lengthValid, '12~128자'],
    [result.hasUppercase, '영문 대문자 1자 이상'],
    [result.hasLowercase, '영문 소문자 1자 이상'],
    [result.hasNumber, '숫자 1자 이상'],
    [result.hasSpecialCharacter, '공백이 아닌 특수문자 1자 이상'],
    [result.avoidsCommonPattern, '흔한 단어·연속 문자열 제외'],
    [result.avoidsRepeatedRun, '같은 문자 4회 연속 제외'],
    [result.excludesIdentifier, '이메일 아이디·휴대전화 번호 제외'],
  ] as const;
  return <ul id={id} className="password-policy-list" aria-label="비밀번호 안전 조건">{checks.map(([passed, label]) => (
    <li key={label} className={`password-policy-item ${passed ? 'is-passed' : 'is-missing'}`}>
      <span className="sr-only">{passed ? '충족: ' : '필요: '}</span>
      <span className="password-policy-icon" aria-hidden="true">{passed ? '✓' : '✕'}</span>
      <span>{label}</span>
    </li>
  ))}</ul>;
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
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const passwordPolicy = evaluatePassword(password, [email, phone]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    const adultConfirmed = form.get('adultConfirmed') === 'on';
    const identifier = normalizedEmail || normalizedPhone;
    const emailInput = event.currentTarget.elements.namedItem('email') as HTMLInputElement;
    if (!identifier) return setMessage('이메일 또는 휴대전화 중 하나를 입력해 주세요.');
    if (normalizedEmail && !emailInput.validity.valid) return setMessage('올바른 이메일 주소를 입력해 주세요.');
    if (normalizedPhone && !/^[0-9+ -]{8,24}$/.test(normalizedPhone)) return setMessage('휴대전화는 숫자와 +, 공백, 하이픈을 사용해 8~24자로 입력해 주세요.');
    if (!passwordPolicy.valid) return setMessage(passwordPolicyMessage(passwordPolicy));
    if (!adultConfirmed) return setMessage('회원가입을 위해 만 19세 이상임을 확인해 주세요.');
    setSubmitting(true);
    setMessage('인증 코드를 발급하는 중입니다.');
    try {
      const result = await api('/auth/signups', 'POST', { email: normalizedEmail || undefined, phone: normalizedPhone || undefined, password, adultConfirmed });
      sessionStorage.setItem('verification-identifier', identifier);
      if (result.debugCode) sessionStorage.setItem('verification-debug-code', result.debugCode);
      window.location.assign('/verify');
    } catch (error) {
      const code = error instanceof Error ? error.message : 'REQUEST_FAILED';
      if (code === 'CONTACT_ALREADY_REGISTERED') setMessage('이미 등록된 연락처입니다. 로그인하거나 비밀번호를 재설정해 주세요.');
      else if (code === 'VERIFICATION_RATE_LIMITED') setMessage('인증 코드 요청이 너무 많습니다. 10분 후 다시 시도해 주세요.');
      else if (code.startsWith('CONTACT_DELIVERY_')) setMessage('인증 코드 전달 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.');
      else if (code === 'CONTACT_REQUIRED') setMessage('이메일 또는 휴대전화 중 하나를 입력해 주세요.');
      else if (code === 'ADULT_CONFIRMATION_REQUIRED') setMessage('만 19세 이상 확인이 필요합니다.');
      else if (code === 'WEAK_PASSWORD') setMessage('안전 조건을 모두 충족하는 비밀번호를 입력해 주세요.');
      else if (code === 'API_UNAVAILABLE') setMessage('회원가입 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      else setMessage('가입 정보를 처리할 수 없습니다. 입력 형식과 비밀번호 안전 조건을 확인해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }
  return <form onSubmit={submit} noValidate><p>이메일 또는 휴대전화 입력 후 소유 인증을 완료하면 가입됩니다.</p><label>이메일<input name="email" type="email" autoComplete="email" aria-describedby="contact-help" value={email} onChange={(event) => setEmail(event.currentTarget.value)} /></label><label>또는 휴대전화<input name="phone" inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" aria-describedby="contact-help" value={phone} onChange={(event) => setPhone(event.currentTarget.value)} /></label><p id="contact-help">이메일과 휴대전화 중 하나만 입력해도 됩니다.</p><label>안전한 비밀번호<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="signup-password-policy" aria-invalid={password.length > 0 && !passwordPolicy.valid} value={password} onChange={(event) => setPassword(event.currentTarget.value)} /></label><PasswordPolicyChecklist id="signup-password-policy" result={passwordPolicy} /><label><input name="adultConfirmed" type="checkbox" /> 만 19세 이상입니다.</label><button type="submit" disabled={submitting}>{submitting ? '처리 중…' : '인증 코드 받기'}</button><Message value={message} /></form>;
}

export function VerifyForm() {
  const [message, setMessage] = useState('');
  const [identifier, setIdentifier] = useState('');
  useEffect(() => {
    setIdentifier(sessionStorage.getItem('verification-identifier') ?? '');
    const debugCode = sessionStorage.getItem('verification-debug-code');
    if (debugCode) setMessage(`로컬 개발 인증 코드: ${debugCode}`);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/auth/contact-confirmations', 'POST', { identifier, code: form.get('code') });
      sessionStorage.removeItem('verification-identifier');
      sessionStorage.removeItem('verification-debug-code');
      window.location.assign('/login');
    } catch {
      setMessage('인증 코드가 올바르지 않거나 만료됐습니다.');
    }
  }
  async function resend() {
    try {
      const result = await api('/auth/contact-confirmations/request', 'POST', { identifier });
      if (result.debugCode) sessionStorage.setItem('verification-debug-code', result.debugCode);
      setMessage(result.debugCode ? `로컬 개발 인증 코드: ${result.debugCode}` : '인증 코드를 다시 보냈습니다.');
    } catch { setMessage('잠시 후 다시 요청해 주세요.'); }
  }
  return <form onSubmit={submit}><label>인증할 연락처<input value={identifier} onChange={(event) => setIdentifier(event.currentTarget.value)} required /></label><label>6자리 인증 코드<input name="code" inputMode="numeric" pattern="[0-9]{6}" required /></label><button type="submit">인증 완료</button><button type="button" onClick={() => void resend()}>인증 코드 다시 받기</button><Message value={message} /></form>;
}

export function PasswordResetForm() {
  const [identifier, setIdentifier] = useState('');
  const [requested, setRequested] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const passwordPolicy = evaluatePassword(newPassword, [identifier]);
  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await api('/auth/password-resets', 'POST', { identifier });
      setRequested(true);
      setMessage(result.debugCode ? `로컬 개발 인증 코드: ${result.debugCode}` : '등록된 연락처라면 재설정 코드를 보냈습니다.');
    } catch { setMessage('요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'); }
    finally { setSubmitting(false); }
  }
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!passwordPolicy.valid) return setMessage(passwordPolicyMessage(passwordPolicy));
    if (newPassword !== passwordConfirmation) return setMessage('새 비밀번호 확인이 일치하지 않습니다.');
    setSubmitting(true);
    try {
      await api('/auth/password-resets/confirm', 'POST', { identifier, code: form.get('code'), newPassword });
      window.location.assign('/login');
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'WEAK_PASSWORD'
        ? '안전 조건을 모두 충족하는 새 비밀번호를 입력해 주세요.'
        : '인증 코드가 올바르지 않거나 만료됐습니다. 새 코드를 요청해 주세요.');
    }
    finally { setSubmitting(false); }
  }
  if (requested) return <form onSubmit={reset} noValidate><p>안전 조건을 모두 충족하는 새 비밀번호를 설정해 주세요. 변경하면 기존 로그인 세션은 모두 종료됩니다.</p><label>6자리 인증 코드<input name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required /></label><label>새 비밀번호<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required aria-describedby="reset-password-policy" aria-invalid={newPassword.length > 0 && !passwordPolicy.valid} value={newPassword} onChange={(event) => setNewPassword(event.currentTarget.value)} /></label><PasswordPolicyChecklist id="reset-password-policy" result={passwordPolicy} /><label>새 비밀번호 확인<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.currentTarget.value)} /></label><button type="submit" disabled={submitting}>{submitting ? '변경 중…' : '비밀번호 변경'}</button><button type="button" onClick={() => { setRequested(false); setMessage(''); setNewPassword(''); setPasswordConfirmation(''); }}>연락처 다시 입력</button><Message value={message} /></form>;
  return <form onSubmit={requestCode}><label>검증된 이메일 또는 휴대전화<input value={identifier} onChange={(event) => setIdentifier(event.currentTarget.value)} autoComplete="username" required /></label><button type="submit" disabled={submitting}>{submitting ? '요청 중…' : '재설정 코드 받기'}</button><Message value={message} /></form>;
}

export function AccountPanel() {
  const [account, setAccount] = useState<Account>();
  const [message, setMessage] = useState('계정 정보를 불러오는 중입니다.');
  useEffect(() => { void api('/auth/me', 'GET').then((body) => { if (body.user) setAccount(body.user); setMessage(''); }).catch(() => { setMessage('로그인이 필요합니다.'); }); }, []);
  async function logout() { await api('/auth/logout', 'POST'); window.location.assign('/'); }
  async function withdraw() {
    if (!window.confirm('탈퇴하면 로그인할 수 없으며 개인정보·채팅·거래 데이터는 정책에 따라 탈퇴 후 1년까지 보관됩니다. 계속할까요?')) return;
    const result = await api('/auth/me/withdrawal', 'POST');
    setMessage(`탈퇴 처리되었습니다. 판매중 상품 ${result.hiddenProductCount ?? 0}개를 숨겼습니다. 보존 기한: ${result.retentionUntil ?? ''}`);
    setAccount(undefined);
  }
  if (!account) return <Message value={message} />;
  return <section><p>{account.email ?? account.phone} · {account.status}</p><p>선택 동네: {account.neighborhood?.name ?? '선택하지 않음'}</p><button type="button" onClick={logout}>로그아웃</button><button type="button" onClick={() => void withdraw()}>회원 탈퇴</button><Message value={message} /></section>;
}
