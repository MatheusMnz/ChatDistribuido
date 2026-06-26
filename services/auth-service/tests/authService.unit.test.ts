import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createAuthService } from '../src/services/authService';
import {
  UserRepository,
  UserRow,
} from '../src/repositories/userRepository';
import { AppError } from '../src/utils/AppError';

const JWT_SECRET = 'test-secret';
const CONFIG = { jwtSecret: JWT_SECRET, jwtExpiresIn: '1d' };

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
    id: '11111111-1111-1111-1111-111111111111',
    username: 'alice',
    password_hash: 'placeholder',
    created_at: new Date(),
    ...overrides,
  };
}

describe('authService.register', () => {
  it('hashes the password and persists the user', async () => {
    const repo = makeRepoMock();
    repo.findByUsername.mockResolvedValue(null);
    repo.createUser.mockImplementation(async (username) => ({
      id: 'new-id',
      username,
    }));

    const service = createAuthService(repo, CONFIG);
    const result = await service.register('alice', 'secret123');

    expect(result).toEqual({ id: 'new-id', username: 'alice' });
    expect(repo.createUser).toHaveBeenCalledTimes(1);

    const [, passedHash] = repo.createUser.mock.calls[0];
    // Hash must NOT equal the plaintext, and must verify with bcrypt.
    expect(passedHash).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', passedHash)).toBe(true);
  });

  it('rejects a duplicate username with 409', async () => {
    const repo = makeRepoMock();
    repo.findByUsername.mockResolvedValue(fakeUserRow());

    const service = createAuthService(repo, CONFIG);

    await expect(service.register('alice', 'secret123')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it('rejects an invalid username length with 400', async () => {
    const repo = makeRepoMock();
    const service = createAuthService(repo, CONFIG);

    await expect(service.register('ab', 'secret123')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rejects a too-short password with 400', async () => {
    const repo = makeRepoMock();
    const service = createAuthService(repo, CONFIG);

    await expect(service.register('alice', '123')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('authService.login', () => {
  it('returns a valid token for correct credentials', async () => {
    const repo = makeRepoMock();
    const hash = await bcrypt.hash('secret123', 10);
    repo.findByUsername.mockResolvedValue(
      fakeUserRow({ password_hash: hash })
    );

    const service = createAuthService(repo, CONFIG);
    const result = await service.login('alice', 'secret123');

    expect(result.user).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      username: 'alice',
    });

    const decoded = jwt.verify(result.token, JWT_SECRET) as {
      sub: string;
      username: string;
    };
    expect(decoded.sub).toBe('11111111-1111-1111-1111-111111111111');
    expect(decoded.username).toBe('alice');
  });

  it('throws 401 on a wrong password', async () => {
    const repo = makeRepoMock();
    const hash = await bcrypt.hash('secret123', 10);
    repo.findByUsername.mockResolvedValue(
      fakeUserRow({ password_hash: hash })
    );

    const service = createAuthService(repo, CONFIG);

    await expect(service.login('alice', 'wrong')).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('throws 401 for an unknown user', async () => {
    const repo = makeRepoMock();
    repo.findByUsername.mockResolvedValue(null);

    const service = createAuthService(repo, CONFIG);

    await expect(
      service.login('nobody', 'secret123')
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('authService token round-trip', () => {
  it('issues and verifies a token with the correct payload', () => {
    const repo = makeRepoMock();
    const service = createAuthService(repo, CONFIG);

    const token = service.issueToken({ id: 'abc', username: 'bob' });
    const payload = service.verifyToken(token);

    expect(payload.sub).toBe('abc');
    expect(payload.username).toBe('bob');
  });

  it('throws AppError(401) on a tampered token', () => {
    const repo = makeRepoMock();
    const service = createAuthService(repo, CONFIG);

    expect(() => service.verifyToken('not-a-real-token')).toThrow(AppError);
    try {
      service.verifyToken('not-a-real-token');
    } catch (e) {
      expect((e as AppError).statusCode).toBe(401);
    }
  });
});
