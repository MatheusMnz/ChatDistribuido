import { useEffect, useRef, useState } from 'react';

interface MessageComposerProps {
  disabled?: boolean;
  onSend: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
}

export function MessageComposer({ disabled, onSend, onTyping }: MessageComposerProps) {
  const [value, setValue] = useState('');
  const typingActive = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Stop emitting "typing" when unmounting.
  useEffect(() => {
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (typingActive.current) onTyping(false);
    };
  }, [onTyping]);

  function signalTyping() {
    if (!typingActive.current) {
      typingActive.current = true;
      onTyping(true);
    }
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      typingActive.current = false;
      onTyping(false);
    }, 1500);
  }

  function stopTyping() {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (typingActive.current) {
      typingActive.current = false;
      onTyping(false);
    }
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    stopTyping();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor="composer-input" className="sr-only">
        Escreva uma mensagem
      </label>
      <textarea
        id="composer-input"
        ref={textareaRef}
        className="composer__input"
        placeholder="Escreva uma mensagem..."
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value);
          if (e.target.value.trim()) signalTyping();
          else stopTyping();
        }}
        onKeyDown={handleKeyDown}
        onBlur={stopTyping}
      />
      <button
        type="submit"
        className="btn btn--primary composer__send"
        disabled={disabled || !value.trim()}
        aria-label="Enviar mensagem"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2 .4 6.4Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </form>
  );
}
