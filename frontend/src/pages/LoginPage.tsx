import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, register, getErrorMessage } from '../lib/api';

type Tab = 'login' | 'register';

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
    setInfo(null);
    setConfirm('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const u = username.trim();
    if (!u || !password) {
      setError('Preencha usuário e senha.');
      return;
    }
    if (tab === 'register' && password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      if (tab === 'login') {
        const res = await login(u, password);
        signIn(res.token, res.user);
        navigate(redirectTo, { replace: true });
      } else {
        await register(u, password);
        // Auto-login right after a successful registration.
        const res = await login(u, password);
        signIn(res.token, res.user);
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          tab === 'login' ? 'Falha ao entrar.' : 'Falha ao registrar.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__brand">
          <span className="auth__logo" aria-hidden="true">💬</span>
          <h1>Chat Distribuído</h1>
          <p>Conecte-se e converse em tempo real.</p>
        </div>

        <div className="segmented" role="tablist" aria-label="Autenticação">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            className={`segmented__btn${tab === 'login' ? ' is-active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'register'}
            className={`segmented__btn${tab === 'register' ? ' is-active' : ''}`}
            onClick={() => switchTab('register')}
          >
            Registrar
          </button>
        </div>

        <form className="auth__form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="username">Usuário</label>
            <input
              id="username"
              name="username"
              type="text"
              className="input"
              autoComplete="username"
              placeholder="seu_usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {tab === 'register' && (
            <div className="field">
              <label htmlFor="confirm">Confirmar senha</label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                className="input"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          {info && <p className="form-info" role="status">{info}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting
              ? 'Aguarde…'
              : tab === 'login'
                ? 'Entrar'
                : 'Criar conta'}
          </button>
        </form>

        <p className="auth__switch">
          {tab === 'login' ? (
            <>
              Não tem conta?{' '}
              <button type="button" className="link" onClick={() => switchTab('register')}>
                Registre-se
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button type="button" className="link" onClick={() => switchTab('login')}>
                Entrar
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
