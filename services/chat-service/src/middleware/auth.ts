import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthUser {
  userId: string;
  username: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface JwtPayload {
  sub: string;
  username: string;
}

/**
 * Extrai e valida o JWT (assinado pelo auth-service com o mesmo JWT_SECRET).
 * Payload do contrato: { sub: userId, username }.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing or malformed Authorization header' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { userId: String(payload.sub), username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}
