'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

type Chat = {
  id: string;
  product: { id: string; title: string; priceKrw: string; status: string };
  latestMessage: { body: string; createdAt: string } | null;
  unreadCount: number;
};

const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [message, setMessage] = useState('채팅을 불러오는 중입니다.');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${origin}/api/v1/chats`, { credentials: 'include' });
      if (!response.ok) throw new Error();
      const data = await response.json() as { chats: Chat[] };
      setChats(data.chats);
      setMessage(data.chats.length ? '' : '진행 중인 채팅이 없습니다.');
    } catch {
      setChats([]);
      setMessage('로그인이 필요합니다.');
    }
  }, []);

  useEffect(() => {
    void load();
    const socket = io(`${origin}/chats`, { withCredentials: true, retries: 3, ackTimeout: 5_000 });
    socket.on('chat:message', () => void load());
    socket.on('safety:relationship', () => void load());
    socket.on('connect_error', () => setMessage('실시간 연결을 복구하는 중입니다.'));
    return () => { socket.disconnect(); };
  }, [load]);

  return (
    <main>
      <h1>채팅</h1>
      <p role="status">{message}</p>
      <ul>
        {chats.map((chat) => (
          <li key={chat.id}>
            <Link href={`/chats/${chat.id}`}>
              {chat.product.title}
              {chat.unreadCount > 0 && <strong aria-label={`읽지 않은 메시지 ${chat.unreadCount}개`}> {chat.unreadCount}</strong>}
            </Link>
            <p>{chat.latestMessage?.body ?? '메시지를 시작해 보세요.'}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
