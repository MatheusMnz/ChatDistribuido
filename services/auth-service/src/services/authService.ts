import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import {
  PublicUser,
  UserRepository,
} from '../repositories/userRepository';

export interface JwtPayload {
  sub: string;
  username: string;
}

export interface LoginResult {
  token: string;
  user: PublicUser;
}

export interface AuthServiceConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
}

const SALT_ROUNDS = 10;
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 6;

/**
 * Pure business logic for authentication. No Express here so it can be
 * unit-tested by injecting a mocked repository.
 */
export function createAuthService(
  repo: UserRepository,
  config: AuthServiceConfig
) {
  function validateCredentials(username: unknown, password: unknown): {
    username: string;
    password: string;
  } {
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new AppError('username and password are required', 400);
    }
    const u = username.trim();
    if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) {
      throw new AppError(
        `username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters`,
        400
      );
    }
    if (password.length < PASSWORD_MIN) {
      throw new AppError(
        `password must be at least ${PASSWORD_MIN} characters`,
        400
      );
    }
    return { username: u, password };
  }

  function issueToken(user: PublicUser): string {
    const payload: JwtPayload = { sub: user.id, username: user.username };
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);
  }

  function verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      return decoded;
    } catch {
      throw new AppError('invalid token', 401);
    }
  }

  async function register(
    username: unknown,
    password: unknown
  ): Promise<PublicUser> {
    const creds = validateCredentials(username, password);

    const existing = await repo.findByUsername(creds.username);
    if (existing) {
      throw new AppError('username already taken', 409);
    }

    const passwordHash = await bcrypt.hash(creds.password, SALT_ROUNDS);
    const user = await repo.createUser(creds.username, passwordHash);
    return { id: user.id, username: user.username };
  }

  async function login(
    username: unknown,
    password: unknown
  ): Promise<LoginResult> {
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new AppError('invalid credentials', 401);
    }

    const user = await repo.findByUsername(username.trim());
    if (!user) {
      throw new AppError('invalid credentials', 401);
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new AppError('invalid credentials', 401);
    }

    const publicUser: PublicUser = { id: user.id, username: user.username };
    return { token: issueToken(publicUser), user: publicUser };
  }

  return {
    register,
    login,
    issueToken,
    verifyToken,
    validateCredentials,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
