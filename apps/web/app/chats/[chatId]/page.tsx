'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { mergeMessages, type ChatMessage } from '../chat-state';

const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';

type ChatDetail = {
  product: { title: string };
  messages: ChatMessage[];
};

export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const [id, setId] = useState('');
  const [title, setTitle] = useState('상품 채팅');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState('채팅을 불러오는 중입니다.');
  const [blocked, setBlocked] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async (chatId: string) => {
    try {
      const response = await fetch(`${origin}/api/v1/chats/${chatId}`, { credentials: 'include' });
      if (!response.ok) throw new Error(String(response.status));
      const chat = await response.json() as ChatDetail;
      setTitle(chat.product.title);
      setMessages((current) => mergeMessages(current, chat.messages));
      setBlocked(false);
      setStatus('');
    } catch (error) {
      const isBlocked = error instanceof Error && error.message === '403';
      setBlocked(isBlocked);
      setStatus(isBlocked ? '차단 관계에서는 기존 채팅을 열거나 메시지를 보낼 수 없습니다.' : '채팅에 접근할 수 없습니다.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void params.then(({ chatId }) => {
      if (active) setId(chatId);
    });
    return () => { active = false; };
  }, [params]);

  useEffect(() => {
    if (!id) return;
    void load(id);
    const socket = io(`${origin}/chats`, { withCredentials: true, retries: 3, ackTimeout: 5_000 });
    socketRef.current = socket;
    socket.on('connect', () => {
      setStatus('실시간 채팅에 연결되었습니다.');
      socket.emit('chat:join', { chatId: id });
    });
    socket.on('disconnect', () => {
      if (!blocked) setStatus('연결이 끊어져 재연결하는 중입니다.');
    });
    socket.on('chat:message', (message: ChatMessage) => {
      setMessages((current) => mergeMessages(current, message));
      void load(id);
    });
    socket.on('safety:relationship', () => void load(id));
    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [blocked, id, load]);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    const socket = socketRef.current;
    if (!body || !socket || blocked) return;
    const clientMessageId = crypto.randomUUID();
    setStatus(socket.connected ? '메시지를 전송하는 중입니다.' : '연결 복구 후 메시지를 전송합니다.');
    socket.timeout(6_000).emit('chat:send', { chatId: id, body, clientMessageId }, (error: Error | null, message?: ChatMessage) => {
      if (error || !message) {
        setStatus('메시지를 전송하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');
        return;
      }
      setMessages((current) => mergeMessages(current, message));
      form.reset();
      setStatus('');
    });
  }

  return (
    <main>
      <h1>{title}</h1>
      <p role="status">{status}</p>
      <ol aria-live="polite">{messages.map((message) => <li key={message.id}>{message.body}</li>)}</ol>
      <form onSubmit={send}>
        <label>메시지<input name="body" required maxLength={1000} disabled={blocked} /></label>
        <button disabled={blocked}>전송</button>
      </form>
    </main>
  );
}
