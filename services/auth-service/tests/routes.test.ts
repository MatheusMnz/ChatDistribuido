import request from 'supertest';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app';
import {
  UserRepository,
  UserRow,
} from '../src/repositories/userRepository';

const JWT_SECRET = 'test-secret';

function makeRepoMock(): jest.Mocked<UserRepository> {
  return {
    createUser: jest.fn(),
    findByUsername: jest.fn(),
    findById: jest.fn(),
    listExcept: jest.fn(),
  };
}

function fakeUserRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'user-1',
    username: 'alice',
    password_hash: 'placeholder',
    created_at: new Date(),
    ...overrides,
  };
}

function buildTestApp(repo: UserRepository) {
  return buildApp({ repo, jwtSecret: JWT_SECRET, jwtExpiresIn: '1d' });
}

describe('GET /health', () => {
  it('returns ok', async () => {
    const repo = makeRepoMock();
    const res = await request(buildTestApp(repo)).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/auth/register', () => {
  it('creates a user and returns 201 {id, username}', async () => {
    const repo = makeRepoMock();
    repo.findByUsername.mockResolvedValue(null);
    repo.createUser.mockResolvedValue({ id: 'user-1', username: 'alice' });

    const res = await request(buildTestApp(repo))
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'user-1', username: 'alice' });
  });

  it('returns 409 when the username is taken', async () => {
    const repo = makeRepoMock();
    repo.findByUsername.mockResolvedValue(fakeUserRow());

    const res = await request(buildTestApp(repo))
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'secret123' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'username already taken' });
  });

  it('returns 400 on validation error', async () => {
    const repo = makeRepoMock();
    const res = await request(buildTestApp(repo))
      .post('/api/auth/register')
      .send({ username: 'ab', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 {token, user} on valid credentials', async () => {
    const repo = makeRepoMock();
    const hash = await bcrypt.hash('secret123', 10);
    repo.findByUsername.mockResolvedValue(
      fakeUserRow({ password_hash: hash })
    );

    const res = await request(buildTestApp(repo))
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual({ id: 'user-1', username: 'alice' });
  });

  it('returns 401 on invalid credentials', async () => {
    const repo = makeRepoMock();
    const hash = await bcrypt.hash('secret123', 10);
    repo.findByUsername.mockResolvedValue(
      fakeUserRow({ password_hash: hash })
    );

    const res = await request(buildTestApp(repo))
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid credentials' });
  });
});

describe('GET /api/auth/me', () => {
  async function getToken(repo: jest.Mocked<UserRepository>) {
    const hash = await bcrypt.hash('secret123', 10);
    repo.findByUsername.mockResolvedValue(
      fakeUserRow({ password_hash: hash })
    );
    const res = await request(buildTestApp(repo))
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'secret123' });
    return res.body.token as string;
  }

  it('returns 401 without a token', async () => {
    const repo = makeRepoMock();
    const res = await request(buildTestApp(repo)).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const repo = makeRepoMock();
    const res = await request(buildTestApp(repo))
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });

  it('returns 200 {id, username} with a valid token', async () => {
    const repo = makeRepoMock();
    const token = await getToken(repo);
    repo.findById.mockResolvedValue(fakeUserRow());

    const res = await request(buildTestApp(repo))
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'user-1', username: 'alice' });
  });
});

describe('GET /api/users', () => {
  async function getToken(repo: jest.Mocked<UserRepository>) {
    const hash = await bcrypt.hash('secret123', 10);
    repo.findByUsername.mockResolvedValue(
      fakeUserRow({ password_hash: hash })
    );
    const res = await request(buildTestApp(repo))
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'secret123' });
    return res.body.token as string;
  }

  it('returns 401 without a token', async () => {
    const repo = makeRepoMock();
    const res = await request(buildTestApp(repo)).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('returns the list of other users with a valid token', async () => {
    const repo = makeRepoMock();
    const token = await getToken(repo);
    repo.listExcept.mockResolvedValue([
      { id: 'user-2', username: 'bob' },
      { id: 'user-3', username: 'carol' },
    ]);

    const res = await request(buildTestApp(repo))
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 'user-2', username: 'bob' },
      { id: 'user-3', username: 'carol' },
    ]);
    expect(repo.listExcept).toHaveBeenCalledWith('user-1');
  });
});
