import type { Server } from 'socket.io';
import type { IConversation } from '../models/Conversation';
import type { IMessage } from '../models/Message';

/**
 * Wrapper fino sobre o io para emitir eventos de domínio.
 * Compartilhado entre a camada REST e a camada de socket, para que a criação
 * de uma conversa via HTTP também notifique os usuários em tempo real.
 *
 * Os eventos são emitidos para a sala `user:<participantId>` de CADA participante,
 * de modo que o Redis adapter entregue a mensagem em QUALQUER instância.
 */
export class RealtimeEmitter {
  private io: Server | null = null;

  setIo(io: Server): void {
    this.io = io;
  }

  userRoom(userId: string): string {
    return `user:${userId}`;
  }

  conversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  /** Emite `conversation:updated` a todos os participantes. */
  emitConversationUpdated(conversation: IConversation): void {
    if (!this.io) return;
    const payload = conversation.toJSON();
    for (const participantId of conversation.participantIds) {
      this.io.to(this.userRoom(participantId)).emit('conversation:updated', payload);
    }
  }

  /** Emite `message:new` à sala de cada participante. */
  emitMessageNew(message: IMessage, participantIds: string[]): void {
    if (!this.io) return;
    const payload = message.toJSON();
    for (const participantId of participantIds) {
      this.io.to(this.userRoom(participantId)).emit('message:new', payload);
    }
  }
}

// Instância singleton compartilhada.
export const emitter = new RealtimeEmitter();
