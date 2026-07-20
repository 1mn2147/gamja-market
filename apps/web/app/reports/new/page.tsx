'use client';

import { FormEvent, useState } from 'react';

const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';

const messages: Record<string, string> = {
  DUPLICATE_REPORT: '이미 접수된 대상입니다. 내 신고 내역에서 상태를 확인해 주세요.',
  REPORT_RATE_LIMITED: '신고 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  REPORT_TARGET_NOT_FOUND: '신고할 수 없는 대상입니다.',
};

export default function ReportPage() {
  const [status, setStatus] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`${origin}/api/v1/reports`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: form.get('targetType'), targetId: form.get('targetId'), reason: form.get('reason'), detail: form.get('detail') }),
    });
    const result = await response.json().catch(() => ({})) as { code?: string };
    setStatus(response.ok ? '신고가 접수되었습니다.' : messages[result.code ?? ''] ?? '신고를 접수할 수 없습니다.');
  }

  return (
    <main>
      <h1>신고</h1>
      <form onSubmit={submit}>
        <label>대상 유형<select name="targetType"><option value="USER">사용자</option><option value="PRODUCT">상품</option><option value="MESSAGE">메시지</option></select></label>
        <label>대상 ID<input name="targetId" required /></label>
        <label>사유<input name="reason" required minLength={2} maxLength={100} /></label>
        <label>상세<textarea name="detail" maxLength={2000} /></label>
        <button>신고 접수</button>
      </form>
      <p role="status">{status}</p>
    </main>
  );
}
