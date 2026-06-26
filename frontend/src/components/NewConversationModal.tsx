import { useEffect, useMemo, useState } from 'react';
import type { Conversation, User } from '../types';
import { Avatar } from './Avatar';
import {
  createConversation,
  fetchUsers,
  getErrorMessage,
} from '../lib/api';

interface NewConversationModalProps {
  onClose: () => void;
  onCreated: (conv: Conversation) => void;
}

type Mode = 'direct' | 'group';

export function NewConversationModal({ onClose, onCreated }: NewConversationModalProps) {
  const [mode, setMode] = useState<Mode>('direct');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingUsers(true);
    fetchUsers()
      .then((data) => {
        if (active) setUsers(data);
      })
      .catch((err) => {
        if (active) setLoadError(getErrorMessage(err, 'Falha ao carregar usuários.'));
      })
      .finally(() => {
        if (active) setLoadingUsers(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.username.toLowerCase().includes(q));
  }, [users, query]);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === 'direct') {
        // Single selection for direct chats.
        next.clear();
        if (!prev.has(userId)) next.add(userId);
        return next;
      }
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function switchMode(next: Mode) {
    setMode(next);
    setSelected(new Set());
    setSubmitError(null);
  }

  const canSubmit =
    mode === 'direct'
      ? selected.size === 1
      : selected.size >= 1 && groupName.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const conv = await createConversation({
        type: mode,
        participantIds: Array.from(selected),
        ...(mode === 'group' ? { name: groupName.trim() } : {}),
      });
      onCreated(conv);
      onClose();
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Não foi possível criar a conversa.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-conv-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <header className="modal__head">
          <h2 id="new-conv-title">Nova conversa</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="segmented" role="tablist" aria-label="Tipo de conversa">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'direct'}
            className={`segmented__btn${mode === 'direct' ? ' is-active' : ''}`}
            onClick={() => switchMode('direct')}
          >
            Direta (1:1)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'group'}
            className={`segmented__btn${mode === 'group' ? ' is-active' : ''}`}
            onClick={() => switchMode('group')}
          >
            Grupo (1:N)
          </button>
        </div>

        {mode === 'group' && (
          <div className="field">
            <label htmlFor="group-name">Nome do grupo</label>
            <input
              id="group-name"
              type="text"
              className="input"
              placeholder="Ex.: Equipe do projeto"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={60}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="user-search">
            {mode === 'direct' ? 'Escolha um usuário' : 'Escolha os participantes'}
          </label>
          <input
            id="user-search"
            type="text"
            className="input"
            placeholder="Buscar usuário..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="user-picker">
          {loadingUsers ? (
            <div className="user-picker__state">
              <span className="spinner" aria-hidden="true" /> Carregando usuários…
            </div>
          ) : loadError ? (
            <div className="user-picker__state user-picker__state--error">{loadError}</div>
          ) : filtered.length === 0 ? (
            <div className="user-picker__state">Nenhum usuário encontrado.</div>
          ) : (
            <ul className="user-picker__list">
              {filtered.map((u) => {
                const isSelected = selected.has(u.id);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      className={`user-row${isSelected ? ' user-row--selected' : ''}`}
                      onClick={() => toggle(u.id)}
                      aria-pressed={isSelected}
                    >
                      <Avatar name={u.username} seed={u.id} size={36} />
                      <span className="user-row__name">{u.username}</span>
                      <span className={`checkmark${isSelected ? ' is-on' : ''}`} aria-hidden="true">
                        {isSelected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12l5 5 9-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {submitError && <p className="form-error">{submitError}</p>}

        <footer className="modal__foot">
          <span className="modal__count">
            {mode === 'group' && selected.size > 0 && `${selected.size} selecionado(s)`}
          </span>
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? 'Criando…' : 'Criar conversa'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
