'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { createClientId } from '../../client-id';
import { mergeMessages, type ChatMessage } from '../chat-state';

type ChatDetail = {
  viewerId: string;
  product: { id: string; title: string; priceKrw: string; status: string };
  trade: { id: string; status: string } | null;
  messages: ChatMessage[];
};

export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const [id, setId] = useState('');
  const [title, setTitle] = useState('상품 채팅');
  const [product, setProduct] = useState<ChatDetail['product']>();
  const [trade, setTrade] = useState<ChatDetail['trade']>(null);
  const [viewerId, setViewerId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState('채팅을 불러오는 중입니다.');
  const [connectionStatus, setConnectionStatus] = useState('실시간 연결을 확인하는 중입니다.');
  const [blocked, setBlocked] = useState(false);
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async (chatId: string) => {
    try {
      const response = await fetch(`/api/v1/chats/${chatId}`, { credentials: 'include' });
      if (!response.ok) throw new Error(String(response.status));
      const chat = await response.json() as ChatDetail;
      setTitle(chat.product.title);
      setProduct(chat.product);
      setTrade(chat.trade);
      setViewerId(chat.viewerId);
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
    const socket = io('/chats', {
      path: '/socket.io',
      addTrailingSlash: false,
      transports: ['polling'],
      withCredentials: true,
      retries: 3,
      ackTimeout: 5_000,
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnectionStatus('실시간 채팅에 연결되었습니다.');
      socket.emit('chat:join', { chatId: id });
    });
    socket.on('disconnect', () => {
      setConnectionStatus('연결이 끊어졌습니다. 메시지는 안전한 대체 경로로 전송됩니다.');
    });
    socket.on('connect_error', () => setConnectionStatus('실시간 연결을 복구하는 중입니다. 메시지는 안전한 대체 경로로 전송됩니다.'));
    socket.on('chat:message', (message: ChatMessage) => {
      setMessages((current) => mergeMessages(current, message));
      void load(id);
    });
    socket.on('safety:relationship', () => void load(id));
    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [id, load]);

  async function sendRest(body: string, clientMessageId: string) {
    const response = await fetch(`/api/v1/chats/${id}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body, clientMessageId }),
    });
    if (!response.ok) throw new Error(String(response.status));
    return response.json() as Promise<ChatMessage>;
  }

  function sendSocket(socket: Socket, body: string, clientMessageId: string) {
    return new Promise<ChatMessage>((resolve, reject) => {
      socket.timeout(6_000).emit('chat:send', { chatId: id, body, clientMessageId }, (error: Error | null, message?: ChatMessage) => {
        if (error || !message) reject(error ?? new Error('CHAT_ACK_MISSING'));
        else resolve(message);
      });
    });
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    const socket = socketRef.current;
    if (!body || blocked || sending) return;
    const clientMessageId = createClientId();
    setSending(true);
    setStatus('메시지를 전송하는 중입니다.');
    try {
      let message: ChatMessage;
      if (socket?.connected) {
        try {
          message = await sendSocket(socket, body, clientMessageId);
        } catch {
          setConnectionStatus('실시간 응답이 없어 안전한 대체 경로로 저장했습니다.');
          message = await sendRest(body, clientMessageId);
        }
      } else {
        message = await sendRest(body, clientMessageId);
      }
      setMessages((current) => mergeMessages(current, message));
      form.reset();
      setStatus('');
    } catch {
      setStatus('메시지를 전송하지 못했습니다. 로그인·차단·연결 상태를 확인해 주세요.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main>
      <h1>{title}</h1>
      <p role="status">{status}</p>
      <p className="connection-status" aria-live="polite">{connectionStatus}</p>
      {product && <aside className="chat-product"><Link href={`/products/${product.id}`}>상품 보기</Link><strong>{Number(product.priceKrw).toLocaleString('ko-KR')}원 · {product.status}</strong>{trade && <Link href={`/trades/${trade.id}`}>거래 보기 · {trade.status}</Link>}</aside>}
      <ol className="chat-messages" aria-live="polite">{messages.map((message) => <li className={message.authorId === viewerId ? 'chat-message mine' : 'chat-message'} key={message.id}><span>{message.body}</span><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('ko-KR')}</time></li>)}</ol>
      <form onSubmit={send}>
        <label>메시지<input name="body" required maxLength={1000} disabled={blocked} /></label>
        <button disabled={blocked || sending}>{sending ? '전송 중…' : '전송'}</button>
      </form>
    </main>
  );
}
