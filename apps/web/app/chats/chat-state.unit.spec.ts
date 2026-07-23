import { describe, expect, it } from 'vitest';
import { mergeMessages } from './chat-state';

describe('WBS-04 chat message state', () => {
  it('deduplicates a retried client message by its stable id', () => {
    const optimistic = { id: 'message-1', authorId: 'user-a', body: '안녕하세요', createdAt: '2026-07-18T00:00:00.000Z' };
    const acknowledged = { ...optimistic, createdAt: '2026-07-18T00:00:01.000Z' };
    expect(mergeMessages([optimistic], acknowledged)).toEqual([acknowledged]);
  });

  it('restores chronological order after reconnect delivery', () => {
    const later = { id: 'message-2', authorId: 'user-b', body: '두 번째', createdAt: '2026-07-18T00:00:02.000Z' };
    const earlier = { id: 'message-1', authorId: 'user-a', body: '첫 번째', createdAt: '2026-07-18T00:00:01.000Z' };
    expect(mergeMessages([later], earlier).map((message) => message.id)).toEqual(['message-1', 'message-2']);
  });
});
