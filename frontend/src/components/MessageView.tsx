import { useEffect, useMemo, useRef } from 'react';
import type { Conversation, Message, User } from '../types';
import { Avatar } from './Avatar';
import { MessageComposer } from './MessageComposer';
import {
  conversationDisplay,
  formatDayLabel,
  formatTime,
} from '../lib/format';

interface MessageViewProps {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  currentUser: User | null;
  usersById: Map<string, User>;
  onlineUsers: Set<string>;
  typingUsers: { userId: string; username: string }[];
  onBack: () => void;
  onSend: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
}

type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; message: Message; showMeta: boolean };

export function MessageView({
  conversation,
  messages,
  loading,
  currentUser,
  usersById,
  onlineUsers,
  typingUsers,
  onBack,
  onSend,
  onTyping,
}: MessageViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build rows with day separators and grouped meta.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = '';
    let lastSender = '';
    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        out.push({ kind: 'day', key: `day-${day}`, label: formatDayLabel(m.createdAt) });
        lastDay = day;
        lastSender = '';
      }
      const isMine = m.senderId === currentUser?.id;
      const showMeta = m.senderId !== lastSender;
      lastSender = m.senderId;
      out.push({ kind: 'msg', key: m.id, message: m, showMeta: showMeta && !isMine });
    }
    return out;
  }, [messages, currentUser?.id]);

  // Auto-scroll to newest when messages or typing change.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows.length, typingUsers.length, conversation?.id]);

  if (!conversation) {
    return (
      <section className="message-view message-view--empty">
        <div className="empty empty--center">
          <div className="empty__icon" aria-hidden="true">💬</div>
          <p className="empty__title">Selecione uma conversa</p>
          <p className="empty__hint">
            Escolha uma conversa à esquerda ou inicie uma nova para começar a trocar mensagens.
          </p>
        </div>
      </section>
    );
  }

  const { title, seed } = conversationDisplay(
    conversation,
    currentUser?.id ?? null,
    usersById,
  );
  const otherId =
    conversation.type === 'direct'
      ? conversation.participantIds.find((id) => id !== currentUser?.id)
      : undefined;
  const online = otherId ? onlineUsers.has(otherId) : false;
  const presenceLabel =
    conversation.type === 'group'
      ? `${conversation.participantIds.length} participantes`
      : online
        ? 'Online'
        : 'Offline';

  const typingLabel =
    typingUsers.length === 1
      ? `${typingUsers[0].username} está digitando…`
      : typingUsers.length > 1
        ? `${typingUsers.length} pessoas estão digitando…`
        : '';

  return (
    <section className="message-view">
      <header className="message-view__header">
        <button
          type="button"
          className="icon-btn message-view__back"
          onClick={onBack}
          aria-label="Voltar para a lista de conversas"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Avatar name={title} seed={seed} size={40} group={conversation.type === 'group'} online={online} />
        <div className="message-view__heading">
          <h2 className="message-view__title">{title}</h2>
          <span className={`message-view__sub${online ? ' is-online' : ''}`}>{presenceLabel}</span>
        </div>
      </header>

      <div className="message-view__scroll" ref={scrollRef}>
        {loading ? (
          <div className="message-view__loading">
            <span className="spinner" aria-hidden="true" />
            <span>Carregando mensagens…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty empty--center">
            <p className="empty__title">Sem mensagens ainda</p>
            <p className="empty__hint">Seja o primeiro a enviar uma mensagem.</p>
          </div>
        ) : (
          <ul className="messages">
            {rows.map((row) => {
              if (row.kind === 'day') {
                return (
                  <li key={row.key} className="messages__day">
                    <span>{row.label}</span>
                  </li>
                );
              }
              const m = row.message;
              const isMine = m.senderId === currentUser?.id;
              return (
                <li
                  key={row.key}
                  className={`bubble-row${isMine ? ' bubble-row--mine' : ''}`}
                >
                  <div className={`bubble${isMine ? ' bubble--mine' : ''}`}>
                    {row.showMeta && (
                      <span className="bubble__sender">{m.senderUsername}</span>
                    )}
                    <span className="bubble__content">{m.content}</span>
                    <span className="bubble__time">{formatTime(m.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="message-view__footer">
        <div className={`typing-indicator${typingLabel ? ' is-visible' : ''}`} aria-live="polite">
          {typingLabel && (
            <>
              <span className="typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              {typingLabel}
            </>
          )}
        </div>
        <MessageComposer onSend={onSend} onTyping={onTyping} />
      </div>
    </section>
  );
}
