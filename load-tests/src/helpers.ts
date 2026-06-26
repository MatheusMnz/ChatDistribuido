import axios, { AxiosInstance } from "axios";
import { io, Socket } from "socket.io-client";

// Aponta para o gateway NGINX (balanceador de carga). Pode ser sobrescrito por env.
export const GATEWAY = process.env.GATEWAY_URL ?? "http://localhost:8080";

export interface SessionUser {
  id: string;
  username: string;
  token: string;
  http: AxiosInstance;
  socket?: Socket;
}

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Registra (ou loga, se já existir) um usuário e devolve uma sessão autenticada. */
export async function ensureUser(username: string, password = "senha123"): Promise<SessionUser> {
  const base = `${GATEWAY}/api`;
  try {
    await axios.post(`${base}/auth/register`, { username, password });
  } catch (err: any) {
    // 409 = já existe; qualquer outro erro é relançado
    if (err?.response?.status !== 409) throw err;
  }
  const { data } = await axios.post(`${base}/auth/login`, { username, password });
  const token: string = data.token;
  const http = axios.create({
    baseURL: base,
    headers: { Authorization: `Bearer ${token}` },
  });
  return { id: data.user.id, username: data.user.username, token, http };
}

/** Abre uma conexão Socket.IO autenticada através do gateway e resolve quando conectada. */
export function connectSocket(user: SessionUser): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(GATEWAY, {
      path: "/socket.io",
      auth: { token: user.token },
      transports: ["websocket"],
      reconnection: true,
    });
    const timer = setTimeout(() => reject(new Error(`timeout conectando ${user.username}`)), 15000);
    socket.on("connect", () => {
      clearTimeout(timer);
      user.socket = socket;
      resolve(socket);
    });
    socket.on("connect_error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
