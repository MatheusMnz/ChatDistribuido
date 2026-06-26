import type { Server } from 'socket.io';
import type { AuthedSocket, SocketUser } from './auth';
import { env } from '../config/env';
import { emitter } from '../realtime/emitter';
import { getConversationById, isParticipant } from '../services/conversationService';
import { persistMessage } from '../services/messageService';
import { AppError } from '../utils/AppError';

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

/**
 * Coleta os usuários atualmente conectados (em todas as instâncias, via adapter)
 * e emite um `presence { online: true }` por usuário para o socket recém-chegado.
 */
async function sendPresenceSnapshot(
  io: Server,
  socket: AuthedSocket,
  selfId: string
): Promise<void> {
  try {
    const sockets = await io.fetchSockets();
    const onlineUserIds = new Set<string>();
    for (const s of sockets) {
      const u = (s.data as { user?: SocketUser }).user;
      if (u?.userId && u.userId !== selfId) onlineUserIds.add(u.userId);
    }
    for (const userId of onlineUserIds) {
      socket.emit('presence', { userId, online: true });
    }
  } catch (err) {
    // O adapter pode não estar pronto em cenários sem Redis; ignora silenciosamente.
    console.warn(`[socket][${env.INSTANCE_ID}] presence snapshot falhou: ${(err as Error).message}`);
  }
}

/**
 * Registra os handlers de uma conexão de socket já autenticada.
 */
export function registerConnectionHandlers(io: Server, socket: AuthedSocket): void {
  const user = socket.data.user as SocketUser;

  console.log(
    `[socket][${env.INSTANCE_ID}] connected user=${user.userId} (${user.username}) socket=${socket.id}`
  );

  // Cada usuário entra em sua sala pessoal `user:<userId>`.
  socket.join(userRoom(user.userId));

  // Presença: avisa os demais que o usuário ficou online.
  socket.broadcast.emit('presence', { userId: user.userId, online: true });

  // Snapshot de presença: envia ao socket recém-conectado quem JÁ está online (em
  // qualquer instância, via Redis adapter). Sem isto, quem conecta por último não
  // saberia quem já estava conectado — só receberia eventos de quem entrasse depois.
  void sendPresenceSnapshot(io, socket, user.userId);

  // conversation:join — entra na sala da conversa se for participante.
  socket.on('conversation:join', async (payload: { conversationId?: string } = {}) => {
    try {
      const { conversationId } = payload;
      if (!conversationId) return;
      const conversation = await getConversationById(conversationId);
      if (!conversation || !isParticipant(conversation, user.userId)) {
        socket.emit('error', { error: 'cannot join conversation' });
        return;
      }
      socket.join(conversationRoom(conversationId));
    } catch (err) {
      socket.emit('error', { error: (err as Error).message });
    }
  });

  // message:send — valida participação, persiste e faz broadcast.
  socket.on(
    'message:send',
    async (payload: { conversationId?: string; content?: string } = {}) => {
      try {
        const { conversationId, content } = payload;
        if (!conversationId) {
          throw new AppError('conversationId is required', 400);
        }

        const conversation = await getConversationById(conversationId);
        if (!conversation) {
          throw new AppError('conversation not found', 404);
        }
        if (!isParticipant(conversation, user.userId)) {
          throw new AppError('not a participant of this conversation', 403);
        }

        const message = await persistMessage({
          conversationId,
          senderId: user.userId,
          senderUsername: user.username,
          content: content as string
        });

        // Broadcast a CADA participante na sua sala pessoal (cross-instância via Redis).
        emitter.emitMessageNew(message, conversation.participantIds);
      } catch (err) {
        const msg = err instanceof AppError ? err.message : 'failed to send message';
        socket.emit('error', { error: msg });
      }
    }
  );

  // typing — repassa o indicador para a sala da conversa (exceto o remetente).
  socket.on(
    'typing',
    (payload: { conversationId?: string; isTyping?: boolean } = {}) => {
      const { conversationId, isTyping } = payload;
      if (!conversationId) return;
      socket.to(conversationRoom(conversationId)).emit('typing', {
        conversationId,
        userId: user.userId,
        username: user.username,
        isTyping: Boolean(isTyping)
      });
    }
  );

  socket.on('disconnect', () => {
    console.log(
      `[socket][${env.INSTANCE_ID}] disconnected user=${user.userId} socket=${socket.id}`
    );
    socket.broadcast.emit('presence', { userId: user.userId, online: false });
  });
}
