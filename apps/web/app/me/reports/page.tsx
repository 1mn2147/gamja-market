'use client';
import { useEffect, useState } from 'react';
type Report = { id: string; targetType: string; targetId: string; reason: string; status: string; createdAt: string };
export default function MyReportsPage() {
  const [reports, setReports] = useState<Report[]>([]); const [message, setMessage] = useState('신고 내역을 불러오는 중입니다.');
  useEffect(() => { void fetch('/api/v1/reports/me', { credentials: 'include' }).then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ reports: Report[] }>; }).then((data) => { setReports(data.reports); setMessage(data.reports.length ? '' : '신고 내역이 없습니다.'); }).catch(() => setMessage('로그인이 필요합니다.')); }, []);
  return <main><h1>내 신고 내역</h1><p role="status">{message}</p><ul>{reports.map((report) => <li key={report.id}><strong>{report.reason}</strong><p>{report.targetType} · {report.status}</p><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString('ko-KR')}</time></li>)}</ul></main>;
}
