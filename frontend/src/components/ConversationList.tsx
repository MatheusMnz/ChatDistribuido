import type { Conversation, User } from '../types';
import { Avatar } from './Avatar';
import { conversationDisplay, formatPreviewTime } from '../lib/format';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  currentUser: User | null;
  usersById: Map<string, User>;
  onlineUsers: Set<string>;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ConversationList({
  conversations,
  activeId,
  loading,
  currentUser,
  usersById,
  onlineUsers,
  onSelect,
  onNew,
}: ConversationListProps) {
  return (
    <div className="conversation-list">
      <div className="conversation-list__head">
        <h2>Conversas</h2>
        <button type="button" className="btn btn--primary btn--sm" onClick={onNew}>
          <span aria-hidden="true">+</span> Nova conversa
        </button>
      </div>

      <div className="conversation-list__scroll">
        {loading ? (
          <ul className="conversation-list__items" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="conv-item conv-item--skeleton">
                <span className="skeleton skeleton--avatar" />
                <span className="conv-item__body">
                  <span className="skeleton skeleton--line" />
                  <span className="skeleton skeleton--line skeleton--short" />
                </span>
              </li>
            ))}
          </ul>
        ) : conversations.length === 0 ? (
          <div className="empty empty--sidebar">
            <p className="empty__title">Nenhuma conversa ainda</p>
            <p className="empty__hint">Clique em "Nova conversa" para começar.</p>
          </div>
        ) : (
          <ul className="conversation-list__items">
            {conversations.map((conv) => {
              const { title, seed, subtitle } = conversationDisplay(
                conv,
                currentUser?.id ?? null,
                usersById,
              );
              const isActive = conv.id === activeId;
              const otherId =
                conv.type === 'direct'
                  ? conv.participantIds.find((id) => id !== currentUser?.id)
                  : undefined;
              const online = otherId ? onlineUsers.has(otherId) : false;
              const preview = conv.lastMessage?.content ?? subtitle ?? 'Sem mensagens';
              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    className={`conv-item${isActive ? ' conv-item--active' : ''}`}
                    onClick={() => onSelect(conv.id)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <Avatar name={title} seed={seed} online={online} group={conv.type === 'group'} />
                    <span className="conv-item__body">
                      <span className="conv-item__top">
                        <span className="conv-item__title">{title}</span>
                        {conv.lastMessage && (
                          <span className="conv-item__time">
                            {formatPreviewTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </span>
                      <span className="conv-item__preview">{preview}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
