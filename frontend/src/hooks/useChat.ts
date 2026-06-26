import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket';
import {
  fetchConversations,
  fetchMessages,
  getErrorMessage,
} from '../lib/api';
import type {
  ConnectionStatus,
  Conversation,
  Message,
  PresencePayload,
  TypingPayload,
  User,
} from '../types';

interface UseChatResult {
  conversations: Conversation[];
  messages: Message[];
  activeId: string | null;
  loadingConversations: boolean;
  loadingMessages: boolean;
  error: string | null;
  status: ConnectionStatus;
  onlineUsers: Set<string>;
  typingUsers: { userId: string; username: string }[];
  selectConversation: (id: string) => void;
  clearActive: () => void;
  sendMessage: (content: string) => void;
  emitTyping: (isTyping: boolean) => void;
  upsertConversation: (conv: Conversation) => void;
}

// Bumps a conversation to the top, optionally updating its lastMessage.
function bumpConversation(
  list: Conversation[],
  id: string,
  patch: Partial<Conversation>,
): Conversation[] {
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return list;
  const updated = { ...list[idx], ...patch };
  const rest = list.filter((c) => c.id !== id);
  return [updated, ...rest];
}

export function useChat(token: string | null, currentUser: User | null): UseChatResult {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingMap, setTypingMap] = useState<Record<string, { username: string }>>({});

  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  // Per-user typing timeouts so stale "is typing" indicators auto-clear.
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ---- Initial load of conversations ----
  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const data = await fetchConversations();
      setConversations(data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Falha ao carregar conversas.'));
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadConversations();
  }, [token, loadConversations]);

  // ---- Socket lifecycle ----
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socketRef.current = socket;

    const onConnect = () => {
      setStatus('connected');
      // Re-join the open conversation room after a reconnect.
      if (activeIdRef.current) {
        socket.emit('conversation:join', { conversationId: activeIdRef.current });
      }
    };
    const onDisconnect = () => setStatus('disconnected');
    const onReconnectAttempt = () => setStatus('connecting');
    const onConnectError = () => setStatus('connecting');

    const onMessageNew = (msg: Message) => {
      // Append to the open conversation.
      if (msg.conversationId === activeIdRef.current) {
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
        );
      }
      // Bump + update preview in the list.
      setConversations((prev) =>
        bumpConversation(prev, msg.conversationId, {
          lastMessage: {
            content: msg.content,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
          },
          updatedAt: msg.createdAt,
        }),
      );
    };

    const onConversationUpdated = (conv: Conversation) => {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id);
        if (exists) {
          return prev
            .map((c) => (c.id === conv.id ? { ...c, ...conv } : c))
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            );
        }
        return [conv, ...prev];
      });
    };

    const onTyping = (payload: TypingPayload) => {
      if (payload.conversationId !== activeIdRef.current) return;
      if (currentUser && payload.userId === currentUser.id) return;

      const key = payload.userId;
      const existing = typingTimers.current[key];
      if (existing) clearTimeout(existing);

      if (payload.isTyping) {
        setTypingMap((prev) => ({ ...prev, [key]: { username: payload.username } }));
        typingTimers.current[key] = setTimeout(() => {
          setTypingMap((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }, 4000);
      } else {
        setTypingMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    };

    const onPresence = (payload: PresencePayload) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (payload.online) next.add(payload.userId);
        else next.delete(payload.userId);
        return next;
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('connect_error', onConnectError);
    socket.on('message:new', onMessageNew);
    socket.on('conversation:updated', onConversationUpdated);
    socket.on('typing', onTyping);
    socket.on('presence', onPresence);

    if (socket.connected) setStatus('connected');

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('connect_error', onConnectError);
      socket.off('message:new', onMessageNew);
      socket.off('conversation:updated', onConversationUpdated);
      socket.off('typing', onTyping);
      socket.off('presence', onPresence);
    };
    // currentUser id is stable for the session; token drives reconnection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUser?.id]);

  // ---- Selecting a conversation ----
  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
    setMessages([]);
    setTypingMap({});
    setLoadingMessages(true);

    const socket = socketRef.current;
    if (socket) socket.emit('conversation:join', { conversationId: id });

    fetchMessages(id)
      .then((data) => {
        // Only apply if still the active conversation.
        if (activeIdRef.current === id) setMessages(data);
      })
      .catch((err) => setError(getErrorMessage(err, 'Falha ao carregar mensagens.')))
      .finally(() => {
        if (activeIdRef.current === id) setLoadingMessages(false);
      });
  }, []);

  const clearActive = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setTypingMap({});
  }, []);

  // ---- Sending ----
  const sendMessage = useCallback((content: string) => {
    const trimmed = content.trim();
    const socket = socketRef.current;
    const id = activeIdRef.current;
    if (!trimmed || !socket || !id) return;
    socket.emit('message:send', { conversationId: id, content: trimmed });
  }, []);

  const emitTyping = useCallback((isTyping: boolean) => {
    const socket = socketRef.current;
    const id = activeIdRef.current;
    if (!socket || !id) return;
    socket.emit('typing', { conversationId: id, isTyping });
  }, []);

  const upsertConversation = useCallback((conv: Conversation) => {
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === conv.id);
      if (exists) return prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c));
      return [conv, ...prev];
    });
  }, []);

  const typingUsers = Object.entries(typingMap).map(([userId, v]) => ({
    userId,
    username: v.username,
  }));

  return {
    conversations,
    messages,
    activeId,
    loadingConversations,
    loadingMessages,
    error,
    status,
    onlineUsers,
    typingUsers,
    selectConversation,
    clearActive,
    sendMessage,
    emitTyping,
    upsertConversation,
  };
}
