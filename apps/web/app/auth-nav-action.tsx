'use client';

import { useEffect, useState } from 'react';

type AuthState = 'checking' | 'authenticated' | 'anonymous';

export function AuthNavAction() {
  const [state, setState] = useState<AuthState>('checking');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void fetch('/api/v1/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    }).then((response) => {
      if (active) setState(response.ok ? 'authenticated' : 'anonymous');
    }).catch(() => {
      if (active) setState('anonymous');
    });
    return () => { active = false; };
  }, []);

  async function logout() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok && response.status !== 401) throw new Error('LOGOUT_FAILED');
      window.location.assign('/');
    } catch {
      setBusy(false);
      setMessage('로그아웃하지 못했습니다.');
    }
  }

  return (
    <div className="site-auth">
      {state === 'checking' && <span className="site-auth-placeholder" aria-hidden="true" />}
      {state === 'anonymous' && <a className="site-auth-action" href="/login">로그인</a>}
      {state === 'authenticated' && <button className="site-auth-action" type="button" disabled={busy} onClick={() => void logout()}>{busy ? '로그아웃 중…' : '로그아웃'}</button>}
      <span className="site-auth-message" role="status" aria-live="polite">{message}</span>
    </div>
  );
}
