'use client';

import { useCallback, useEffect, useState } from 'react';

const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';
type Block = { blockedId: string; displayName: string; createdAt: string };

export default function BlockedUsersPage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [message, setMessage] = useState('차단 목록을 불러오는 중입니다.');

  const reload = useCallback(async () => {
    try {
      const response = await fetch(`${origin}/api/v1/blocks`, { credentials: 'include' });
      if (!response.ok) throw new Error();
      const data = await response.json() as { blocks: Block[] };
      setBlocks(data.blocks);
      setMessage(data.blocks.length ? '' : '차단한 사용자가 없습니다.');
    } catch {
      setMessage('로그인이 필요합니다.');
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function unblock(blockedId: string) {
    const response = await fetch(`${origin}/api/v1/blocks/${blockedId}`, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) {
      setMessage('차단을 해제할 수 없습니다.');
      return;
    }
    setMessage('차단을 해제했습니다. 기존 상품과 대화를 다시 볼 수 있습니다.');
    await reload();
  }

  return (
    <main>
      <h1>차단 사용자</h1>
      <p role="status">{message}</p>
      <ul>{blocks.map((block) => <li key={block.blockedId}>{block.displayName}<button onClick={() => void unblock(block.blockedId)}>차단 해제</button></li>)}</ul>
    </main>
  );
}
