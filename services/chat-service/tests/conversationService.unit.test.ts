import { startMemoryMongo, stopMemoryMongo, clearDatabase } from './setup';
import {
  createConversation,
  listConversations,
  isParticipant,
  getConversationById
} from '../src/services/conversationService';

describe('conversationService', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('inclui sempre o requester nos participantes', async () => {
    const conv = await createConversation({
      type: 'direct',
      participantIds: ['userB'],
      requesterId: 'userA'
    });
    expect(conv.participantIds.sort()).toEqual(['userA', 'userB']);
  });

  it('reusa conversa direct existente entre os 2 mesmos usuários (sem duplicar)', async () => {
    const first = await createConversation({
      type: 'direct',
      participantIds: ['userB'],
      requesterId: 'userA'
    });

    // Mesma dupla, ordem invertida do requester/participant.
    const second = await createConversation({
      type: 'direct',
      participantIds: ['userA'],
      requesterId: 'userB'
    });

    expect(String(second.id)).toBe(String(first.id));

    // Confirma que existe apenas 1 conversa para esses usuários.
    const list = await listConversations('userA');
    expect(list).toHaveLength(1);
  });

  it('cria um grupo com N participantes', async () => {
    const conv = await createConversation({
      type: 'group',
      participantIds: ['userB', 'userC', 'userD'],
      name: 'Equipe',
      requesterId: 'userA'
    });

    expect(conv.type).toBe('group');
    expect(conv.name).toBe('Equipe');
    expect(conv.participantIds.sort()).toEqual(['userA', 'userB', 'userC', 'userD']);
  });

  it('rejeita conversa direct com número de participantes diferente de 2', async () => {
    await expect(
      createConversation({
        type: 'direct',
        participantIds: ['userB', 'userC'],
        requesterId: 'userA'
      })
    ).rejects.toThrow();
  });

  it('autorização de participante (isParticipant)', async () => {
    const conv = await createConversation({
      type: 'direct',
      participantIds: ['userB'],
      requesterId: 'userA'
    });
    expect(isParticipant(conv, 'userA')).toBe(true);
    expect(isParticipant(conv, 'userB')).toBe(true);
    expect(isParticipant(conv, 'intruder')).toBe(false);
  });

  it('lista conversas ordenadas por updatedAt desc', async () => {
    const c1 = await createConversation({
      type: 'group',
      participantIds: ['userB'],
      name: 'g1',
      requesterId: 'userA'
    });
    await new Promise((r) => setTimeout(r, 20));
    const c2 = await createConversation({
      type: 'group',
      participantIds: ['userC'],
      name: 'g2',
      requesterId: 'userA'
    });

    const list = await listConversations('userA');
    expect(list.map((c) => String(c.id))).toEqual([String(c2.id), String(c1.id)]);
  });

  it('getConversationById retorna null para id inválido', async () => {
    expect(await getConversationById('not-an-objectid')).toBeNull();
  });
});
