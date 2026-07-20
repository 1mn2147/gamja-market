export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
};

export function mergeMessages(current: ChatMessage[], incoming: ChatMessage | ChatMessage[]) {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of Array.isArray(incoming) ? incoming : [incoming]) messages.set(message.id, message);
  return [...messages.values()].sort((left, right) => {
    const chronological = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    return chronological || left.id.localeCompare(right.id);
  });
}
