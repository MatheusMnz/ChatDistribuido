import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from './env';
import { getToken, clearAuth } from './storage';
import type {
  AuthResponse,
  Conversation,
  Message,
  User,
} from '../types';

// Axios instance. baseURL + '/api' keeps all REST calls under the gateway path.
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

// Inject the JWT on every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear the stale session so the app falls back to /login.
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && getToken()) {
      clearAuth();
      // Force a reload so route guards send the user to /login.
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

// Extracts a human-readable message from an axios error.
export function getErrorMessage(err: unknown, fallback = 'Algo deu errado.'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
    if (err.code === 'ERR_NETWORK') return 'Não foi possível conectar ao servidor.';
    if (err.response?.status) return `Erro ${err.response.status}.`;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// ---- Auth ----

export async function login(username: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { username, password });
  return data;
}

export async function register(username: string, password: string): Promise<User> {
  const { data } = await api.post<User>('/auth/register', { username, password });
  return data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

export async function fetchUsers(): Promise<User[]> {
  const { data } = await api.get<User[]>('/users');
  return data;
}

// ---- Conversations ----

export async function fetchConversations(): Promise<Conversation[]> {
  const { data } = await api.get<Conversation[]>('/conversations');
  return data;
}

export interface CreateConversationInput {
  type: 'direct' | 'group';
  participantIds: string[];
  name?: string;
}

export async function createConversation(input: CreateConversationInput): Promise<Conversation> {
  const { data } = await api.post<Conversation>('/conversations', input);
  return data;
}

export async function fetchMessages(
  conversationId: string,
  opts: { limit?: number; before?: string } = {},
): Promise<Message[]> {
  const params: Record<string, string | number> = { limit: opts.limit ?? 50 };
  if (opts.before) params.before = opts.before;
  const { data } = await api.get<Message[]>(`/conversations/${conversationId}/messages`, { params });
  return data;
}
