import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface SocketUser {
  userId: string;
  username: string;
}

interface JwtPayload {
  sub: string;
  username: string;
}

// Estende o socket com os dados do usuário autenticado.
export interface AuthedSocket extends Socket {
  data: {
    user?: SocketUser;
  } & Socket['data'];
}

/**
 * Middleware de autenticação do Socket.IO.
 * Lê o token de `socket.handshake.auth.token` e o valida com o JWT_SECRET.
 * Rejeita a conexão se o token for inválido/ausente.
 */
export function socketAuthMiddleware(
  socket: AuthedSocket,
  next: (err?: Error) => void
): void {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error('authentication required'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    socket.data.user = { userId: String(payload.sub), username: payload.username };
    next();
  } catch {
    next(new Error('invalid token'));
  }
}
