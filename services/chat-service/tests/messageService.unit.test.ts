import { startMemoryMongo, stopMemoryMongo, clearDatabase } from './setup';
import { createConversation } from '../src/services/conversationService';
import { persistMessage, fetchMessages, normalizeContent } from '../src/services/messageService';
import { Message } from '../src/models/Message';
import { Conversation } from '../src/models/Conversation';

describe('messageService (persistência de mensagens)', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('persiste uma mensagem corretamente e a torna recuperável', async () => {
    const conv = await createConversation({
      type: 'direct',
      participantIds: ['userB'],
      requesterId: 'userA'
    });

    const msg = await persistMessage({
      conversationId: String(conv.id),
      senderId: 'userA',
      senderUsername: 'alice',
      content: '  hello world  '
    });

    // Conteúdo é trimado.
    expect(msg.content).toBe('hello world');
    expect(msg.senderId).toBe('userA');
    expect(msg.senderUsername).toBe('alice');

    // Recuperável diretamente do banco.
    const stored = await Message.findById(msg.id);
    expect(stored).not.toBeNull();
    expect(stored!.content).toBe('hello world');

    // Recuperável via fetchMessages (ordem asc).
    const fetched = await fetchMessages(String(conv.id));
    expect(fetched).toHaveLength(1);
    expect(fetched[0].content).toBe('hello world');
  });

  it('atualiza lastMessage e updatedAt da conversa ao persistir', async () => {
    const conv = await createConversation({
      type: 'direct',
      participantIds: ['userB'],
      requesterId: 'userA'
    });
    const originalUpdatedAt = conv.updatedAt.getTime();

    // Pequena espera para garantir diferença de timestamp.
    await new Promise((r) => setTimeout(r, 20));

    await persistMessage({
      conversationId: String(conv.id),
      senderId: 'userA',
      senderUsername: 'alice',
      content: 'latest message'
    });

    const updated = await Conversation.findById(conv.id);
    expect(updated!.lastMessage).toBeDefined();
    expect(updated!.lastMessage!.content).toBe('latest message');
    expect(updated!.lastMessage!.senderId).toBe('userA');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt);
  });

  it('retorna mensagens em ordem ascendente e respeita o limite', async () => {
    const conv = await createConversation({
      type: 'group',
      participantIds: ['userB', 'userC'],
      name: 'grupo',
      requesterId: 'userA'
    });

    for (let i = 0; i < 5; i++) {
      await persistMessage({
        conversationId: String(conv.id),
        senderId: 'userA',
        senderUsername: 'alice',
        content: `msg ${i}`
      });
      await new Promise((r) => setTimeout(r, 5));
    }

    const all = await fetchMessages(String(conv.id));
    expect(all.map((m) => m.content)).toEqual(['msg 0', 'msg 1', 'msg 2', 'msg 3', 'msg 4']);

    const limited = await fetchMessages(String(conv.id), { limit: 2 });
    // Os 2 mais recentes, em ordem asc.
    expect(limited.map((m) => m.content)).toEqual(['msg 3', 'msg 4']);
  });

  it('valida conteúdo (não-vazio e tamanho máximo)', () => {
    expect(() => normalizeContent('   ')).toThrow();
    expect(() => normalizeContent(123 as unknown)).toThrow();
    expect(() => normalizeContent('a'.repeat(4001))).toThrow();
    expect(normalizeContent(' ok ')).toBe('ok');
  });
});
