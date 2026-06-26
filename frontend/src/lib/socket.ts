import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './env';

let socket: Socket | null = null;

// Creates (or returns) the singleton socket.io connection. The chat-service
// handshake expects auth.token. When SOCKET_URL is empty we connect to the
// current origin (the same-origin nginx gateway) using path '/socket.io'.
export function getSocket(token: string): Socket {
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL || undefined, {
    path: '/socket.io',
    auth: { token },
    // websocket-only: evita o handshake em 2 fases do long-polling, permitindo
    // que o NGINX distribua as conexões entre as instâncias (least_conn) sem
    // precisar de sticky sessions. A entrega entre instâncias fica a cargo do
    // Redis adapter no chat-service.
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
