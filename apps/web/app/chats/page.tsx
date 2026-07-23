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

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [message, setMessage] = useState('채팅을 불러오는 중입니다.');
  const [connectionMessage, setConnectionMessage] = useState('실시간 연결을 확인하는 중입니다.');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/chats', { credentials: 'include' });
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
    const socket = io('/chats', {
      path: '/socket.io',
      addTrailingSlash: false,
      transports: ['polling'],
      withCredentials: true,
      retries: 3,
      ackTimeout: 5_000,
    });
    const refresh = () => void load();
    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener('focus', refresh);
    socket.on('connect', () => {
      setConnectionMessage('실시간 채팅에 연결되었습니다.');
      void load();
    });
    socket.on('chat:message', () => void load());
    socket.on('chat:created', () => void load());
    socket.on('safety:relationship', () => void load());
    socket.on('disconnect', () => setConnectionMessage('실시간 연결이 끊어졌습니다. 목록은 자동으로 갱신됩니다.'));
    socket.on('connect_error', () => setConnectionMessage('실시간 연결을 복구하는 중입니다. 목록은 자동으로 갱신됩니다.'));
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      socket.disconnect();
    };
  }, [load]);

  return (
    <main>
      <h1>채팅</h1>
      <p role="status">{message}</p>
      <p className="connection-status" aria-live="polite">{connectionMessage}</p>
      <ul className="chat-list">
        {chats.map((chat) => (
          <li key={chat.id}>
            <Link href={`/chats/${chat.id}`}>
              {chat.product.title}
              {chat.unreadCount > 0 && <strong aria-label={`읽지 않은 메시지 ${chat.unreadCount}개`}> {chat.unreadCount}</strong>}
            </Link>
            <p>{Number(chat.product.priceKrw).toLocaleString('ko-KR')}원 · {chat.product.status}</p>
            <p>{chat.latestMessage?.body ?? '메시지를 시작해 보세요.'}</p>
            {chat.latestMessage && <time dateTime={chat.latestMessage.createdAt}>{new Date(chat.latestMessage.createdAt).toLocaleString('ko-KR')}</time>}
          </li>
        ))}
      </ul>
    </main>
  );
}
