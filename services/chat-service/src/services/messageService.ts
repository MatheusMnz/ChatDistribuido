import { Message, IMessage } from '../models/Message';
import { MAX_MESSAGE_LENGTH } from '../config/env';
import { AppError } from '../utils/AppError';
import { touchConversation } from './conversationService';

export interface PersistMessageInput {
  conversationId: string;
  senderId: string;
  senderUsername: string;
  content: string;
}

/**
 * Valida e normaliza o conteúdo de uma mensagem.
 */
export function normalizeContent(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new AppError('content must be a string', 400);
  }
  const content = raw.trim();
  if (content.length === 0) {
    throw new AppError('content must not be empty', 400);
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(`content exceeds max length of ${MAX_MESSAGE_LENGTH}`, 400);
  }
  return content;
}

/**
 * Persiste uma mensagem e atualiza lastMessage/updatedAt da conversa.
 */
export async function persistMessage(input: PersistMessageInput): Promise<IMessage> {
  const content = normalizeContent(input.content);

  const message = await Message.create({
    conversationId: input.conversationId,
    senderId: input.senderId,
    senderUsername: input.senderUsername,
    content
  });

  await touchConversation(input.conversationId, {
    content: message.content,
    senderId: message.senderId,
    createdAt: message.createdAt
  });

  return message;
}

export interface FetchMessagesOptions {
  limit?: number;
  before?: string;
}

/**
 * Busca mensagens de uma conversa em ordem ascendente (mais antiga → mais nova).
 * Pagina por `before` (createdAt ISO) e `limit`.
 */
export async function fetchMessages(
  conversationId: string,
  options: FetchMessagesOptions = {}
): Promise<IMessage[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  const query: Record<string, unknown> = { conversationId };
  if (options.before) {
    const beforeDate = new Date(options.before);
    if (!Number.isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  // Busca os N mais recentes antes do cursor, depois reverte para ordem asc.
  const docs = await Message.find(query).sort({ createdAt: -1 }).limit(limit);
  return docs.reverse();
}
