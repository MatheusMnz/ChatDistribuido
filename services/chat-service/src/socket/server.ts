import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { socketAuthMiddleware, AuthedSocket } from './auth';
import { registerConnectionHandlers } from './handlers';
import { emitter } from '../realtime/emitter';

export interface SocketServerOptions {
  cors?: { origin: string | string[] | boolean };
}

/**
 * Cria o servidor Socket.IO, registra a auth middleware e os handlers de conexão.
 * O Redis adapter é conectado separadamente em index.ts (pulado em testes).
 */
export function createSocketServer(
  httpServer: HttpServer,
  options: SocketServerOptions = {}
): Server {
  const io = new Server(httpServer, {
    cors: options.cors ?? { origin: '*' }
  });

  // Disponibiliza o io para a camada REST emitir eventos.
  emitter.setIo(io);

  io.use((socket, next) => socketAuthMiddleware(socket as AuthedSocket, next));

  io.on('connection', (socket) => {
    registerConnectionHandlers(io, socket as AuthedSocket);
  });

  return io;
}
