// Define o JWT_SECRET ANTES de importar qualquer módulo que leia env.
process.env.JWT_SECRET = 'test-secret';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { startMemoryMongo, stopMemoryMongo, clearDatabase } from './setup';
import { buildApp } from '../src/app';
import { persistMessage } from '../src/services/messageService';
import { createConversation } from '../src/services/conversationService';

const app = buildApp();

function token(userId: string, username: string): string {
  return jwt.sign({ sub: userId, username }, 'test-secret', { expiresIn: '1h' });
}

describe('REST routes', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('GET /health retorna ok + instance', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('instance');
  });

  it('define o header X-Instance em toda resposta', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-instance']).toBeDefined();
  });

  it('rejeita sem Authorization (401)', async () => {
    const res = await request(app).get('/api/conversations');
    expect(res.status).toBe(401);
  });

  it('rejeita token inválido (401)', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  it('POST /api/conversations cria conversa direct e retorna 201 com id', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${token('userA', 'alice')}`)
      .send({ type: 'direct', participantIds: ['userB'] });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).not.toHaveProperty('_id');
    expect(res.body.type).toBe('direct');
    expect(res.body.participantIds.sort()).toEqual(['userA', 'userB']);
    expect(typeof res.body.createdAt).toBe('string');
  });

  it('POST /api/conversations reusa direct existente', async () => {
    const auth = `Bearer ${token('userA', 'alice')}`;
    const first = await request(app)
      .post('/api/conversations')
      .set('Authorization', auth)
      .send({ type: 'direct', participantIds: ['userB'] });

    const second = await request(app)
      .post('/api/conversations')
      .set('Authorization', auth)
      .send({ type: 'direct', participantIds: ['userB'] });

    expect(second.body.id).toBe(first.body.id);
  });

  it('GET /api/conversations lista as conversas do usuário', async () => {
    await createConversation({ type: 'direct', participantIds: ['userB'], requesterId: 'userA' });

    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${token('userA', 'alice')}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it('GET /api/conversations/:id/messages retorna mensagens asc', async () => {
    const conv = await createConversation({
      type: 'direct',
      participantIds: ['userB'],
      requesterId: 'userA'
    });
    await persistMessage({
      conversationId: String(conv.id),
      senderId: 'userA',
      senderUsername: 'alice',
      content: 'hi'
    });

    const res = await request(app)
      .get(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${token('userA', 'alice')}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('hi');
    expect(res.body[0]).toHaveProperty('id');
  });

  it('GET messages retorna 403 para não-participante', async () => {
    const conv = await createConversation({
      type: 'direct',
      participantIds: ['userB'],
      requesterId: 'userA'
    });

    const res = await request(app)
      .get(`/api/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${token('intruder', 'eve')}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('GET messages retorna 404 para conversa inexistente', async () => {
    const res = await request(app)
      .get('/api/conversations/64b7f0f0f0f0f0f0f0f0f0f0/messages')
      .set('Authorization', `Bearer ${token('userA', 'alice')}`);
    expect(res.status).toBe(404);
  });
});
