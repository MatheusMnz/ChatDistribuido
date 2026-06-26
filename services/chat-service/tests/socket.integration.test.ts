process.env.JWT_SECRET = 'test-secret';

import http from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { startMemoryMongo, stopMemoryMongo, clearDatabase } from './setup';
import { buildApp } from '../src/app';
import { createSocketServer } from '../src/socket/server';
import { createConversation } from '../src/services/conversationService';
import { Message } from '../src/models/Message';

function token(userId: string, username: string): string {
  return jwt.sign({ sub: userId, username }, 'test-secret', { expiresIn: '1h' });
}

function connectClient(port: number, jwtToken: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ClientIO(`http://localhost:${port}`, {
      auth: { token: jwtToken },
      transports: ['websocket'],
      reconnection: false
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

describe('Socket.IO integration (tempo real + persistência)', () => {
  let httpServer: http.Server;
  let port: number;
  let ioServer: ReturnType<typeof createSocketServer>;

  beforeAll(async () => {
    await startMemoryMongo();
    const app = buildApp();
    httpServer = http.createServer(app);
    ioServer = createSocketServer(httpServer);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    port = (httpServer.address() as AddressInfo).port;
  });

  afterAll(async () => {
    ioServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await stopMemoryMongo();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('rejeita conexão sem token válido', async () => {
    await expect(connectClient(port, 'invalid-token')).rejects.toBeDefined();
  });

  it('entrega message:new em tempo real ao outro participante e persiste no Mongo', async () => {
    const conv = await createConversation({
      type: 'direct',
      participantIds: ['userB'],
      requesterId: 'userA'
    });
    const conversationId = String(conv.id);

    const clientA = await connectClient(port, token('userA', 'alice'));
    const clientB = await connectClient(port, token('userB', 'bob'));

    try {
      // userB aguarda receber a mensagem em sua sala pessoal.
      const received = new Promise<any>((resolve) => {
        clientB.on('message:new', (msg: any) => resolve(msg));
      });

      // userA envia a mensagem.
      clientA.emit('message:send', { conversationId, content: 'olá bob!' });

      const msg = await received;
      expect(msg.content).toBe('olá bob!');
      expect(msg.senderId).toBe('userA');
      expect(msg.senderUsername).toBe('alice');
      expect(msg.conversationId).toBe(conversationId);
      expect(msg).toHaveProperty('id');

      // Persistência: a mensagem está no banco.
      const stored = await Message.find({ conversationId });
      expect(stored).toHaveLength(1);
      expect(stored[0].content).toBe('olá bob!');
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });

  it('relaya typing para a sala da conversa', async () => {
    const conv = await createConversation({
      type: 'direct',
      participantIds: ['userB'],
      requesterId: 'userA'
    });
    const conversationId = String(conv.id);

    const clientA = await connectClient(port, token('userA', 'alice'));
    const clientB = await connectClient(port, token('userB', 'bob'));

    try {
      // Ambos entram na sala da conversa.
      clientA.emit('conversation:join', { conversationId });
      clientB.emit('conversation:join', { conversationId });
      await new Promise((r) => setTimeout(r, 100));

      const typingReceived = new Promise<any>((resolve) => {
        clientB.on('typing', (payload: any) => resolve(payload));
      });

      clientA.emit('typing', { conversationId, isTyping: true });

      const payload = await typingReceived;
      expect(payload.conversationId).toBe(conversationId);
      expect(payload.userId).toBe('userA');
      expect(payload.username).toBe('alice');
      expect(payload.isTyping).toBe(true);
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });
});
