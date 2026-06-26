import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AppError } from '../utils/AppError';
import {
  createConversation,
  listConversations,
  getConversationById,
  isParticipant
} from '../services/conversationService';
import { fetchMessages } from '../services/messageService';
import { emitter } from '../realtime/emitter';

const router = Router();

// Helper para encaminhar erros async ao errorHandler central.
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

router.use(authMiddleware);

// POST /api/conversations
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { type, participantIds, name } = req.body ?? {};
    if (!Array.isArray(participantIds)) {
      throw new AppError('participantIds must be an array', 400);
    }

    const conversation = await createConversation({
      type,
      participantIds,
      name,
      requesterId: req.user!.userId
    });

    // Notifica os participantes em tempo real (ex.: nova DM/grupo).
    emitter.emitConversationUpdated(conversation);

    res.status(201).json(conversation.toJSON());
  })
);

// GET /api/conversations
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const conversations = await listConversations(req.user!.userId);
    res.json(conversations.map((c) => c.toJSON()));
  })
);

// GET /api/conversations/:id/messages
router.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const conversation = await getConversationById(req.params.id);
    if (!conversation) {
      throw new AppError('conversation not found', 404);
    }
    if (!isParticipant(conversation, req.user!.userId)) {
      throw new AppError('not a participant of this conversation', 403);
    }

    const limitRaw = req.query.limit;
    const beforeRaw = req.query.before;
    const limit =
      typeof limitRaw === 'string' && limitRaw.length > 0 ? parseInt(limitRaw, 10) : undefined;

    const messages = await fetchMessages(req.params.id, {
      limit: Number.isNaN(limit as number) ? undefined : limit,
      before: typeof beforeRaw === 'string' ? beforeRaw : undefined
    });

    res.json(messages.map((m) => m.toJSON()));
  })
);

export default router;
