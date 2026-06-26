import { Conversation, IConversation } from '../models/Conversation';
import { AppError } from '../utils/AppError';

export interface CreateConversationInput {
  type: 'direct' | 'group';
  participantIds: string[];
  name?: string;
  requesterId: string;
}

/**
 * Normaliza a lista de participantes: inclui sempre o requester e remove duplicatas.
 */
function buildParticipantList(requesterId: string, participantIds: string[]): string[] {
  const set = new Set<string>([requesterId, ...participantIds.map((p) => String(p))]);
  return Array.from(set);
}

/**
 * Cria uma conversa. Para `direct`, reusa uma conversa existente entre exatamente
 * os 2 mesmos usuários (evita DMs duplicadas).
 */
export async function createConversation(
  input: CreateConversationInput
): Promise<IConversation> {
  const { type, name, requesterId } = input;

  if (type !== 'direct' && type !== 'group') {
    throw new AppError('type must be "direct" or "group"', 400);
  }

  const participants = buildParticipantList(requesterId, input.participantIds || []);

  if (type === 'direct') {
    if (participants.length !== 2) {
      throw new AppError('direct conversations must have exactly 2 participants', 400);
    }
    // Reuso: procura uma conversa direct cujos participantes sejam exatamente esses 2.
    const existing = await Conversation.findOne({
      type: 'direct',
      participantIds: { $all: participants, $size: participants.length }
    });
    if (existing) return existing;
  } else {
    if (participants.length < 2) {
      throw new AppError('group conversations must have at least 2 participants', 400);
    }
  }

  const conversation = await Conversation.create({
    type,
    name: type === 'group' ? name : undefined,
    participantIds: participants
  });

  return conversation;
}

/**
 * Lista as conversas das quais o usuário participa, ordenadas por updatedAt desc.
 */
export async function listConversations(userId: string): Promise<IConversation[]> {
  return Conversation.find({ participantIds: userId }).sort({ updatedAt: -1 });
}

export async function getConversationById(id: string): Promise<IConversation | null> {
  // Evita lançar CastError em ids inválidos.
  if (!/^[a-fA-F0-9]{24}$/.test(id)) return null;
  return Conversation.findById(id);
}

export function isParticipant(conversation: IConversation, userId: string): boolean {
  return conversation.participantIds.includes(userId);
}

/**
 * Atualiza lastMessage + updatedAt da conversa. Retorna a conversa atualizada.
 */
export async function touchConversation(
  conversationId: string,
  lastMessage: { content: string; senderId: string; createdAt: Date }
): Promise<IConversation | null> {
  return Conversation.findByIdAndUpdate(
    conversationId,
    { lastMessage },
    { new: true, timestamps: true }
  );
}
