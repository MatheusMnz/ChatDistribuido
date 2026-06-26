import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import { fetchUsers } from '../lib/api';
import type { User } from '../types';
import { Avatar } from '../components/Avatar';
import { ConversationList } from '../components/ConversationList';
import { MessageView } from '../components/MessageView';
import { NewConversationModal } from '../components/NewConversationModal';

export function ChatPage() {
  const { user, token, signOut } = useAuth();
  const {
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
  } = useChat(token, user);

  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // Load the user directory once so we can resolve names/avatars for DMs.
  useEffect(() => {
    let active = true;
    fetchUsers()
      .then((data) => {
        if (active) setUsers(data);
      })
      .catch(() => {
        // Non-fatal: names will fall back to generic labels.
      });
    return () => {
      active = false;
    };
  }, []);

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) map.set(u.id, u);
    if (user) map.set(user.id, user);
    return map;
  }, [users, user]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const statusLabel =
    status === 'connected'
      ? 'Conectado'
      : status === 'connecting'
        ? 'Reconectando…'
        : 'Desconectado';

  return (
    <div className={`chat-shell${activeId ? ' chat-shell--conversation-open' : ''}`}>
      <aside className="sidebar">
        <header className="sidebar__header">
          <div className="sidebar__me">
            <Avatar name={user?.username ?? '?'} seed={user?.id} size={40} />
            <div className="sidebar__me-info">
              <span className="sidebar__me-name">{user?.username}</span>
              <span className={`status-pill status-pill--${status}`}>
                <span className="status-dot" aria-hidden="true" />
                {statusLabel}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={signOut}
            aria-label="Sair"
            title="Sair"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 12H4m0 0 4-4m-4 4 4 4M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </header>

        {error && <div className="sidebar__error">{error}</div>}

        <ConversationList
          conversations={conversations}
          activeId={activeId}
          loading={loadingConversations}
          currentUser={user}
          usersById={usersById}
          onlineUsers={onlineUsers}
          onSelect={selectConversation}
          onNew={() => setShowModal(true)}
        />
      </aside>

      <main className="main">
        <MessageView
          conversation={activeConversation}
          messages={messages}
          loading={loadingMessages}
          currentUser={user}
          usersById={usersById}
          onlineUsers={onlineUsers}
          typingUsers={typingUsers}
          onBack={clearActive}
          onSend={sendMessage}
          onTyping={emitTyping}
        />
      </main>

      {showModal && (
        <NewConversationModal
          onClose={() => setShowModal(false)}
          onCreated={(conv) => {
            upsertConversation(conv);
            selectConversation(conv.id);
          }}
        />
      )}
    </div>
  );
}
