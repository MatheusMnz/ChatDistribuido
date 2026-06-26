import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { AuthService } from '../services/authService';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      username?: string;
    }
  }
}

/**
 * Builds an auth middleware that verifies the Bearer JWT using the given
 * authService and attaches userId/username to the request.
 */
export function createAuthMiddleware(authService: AuthService) {
  return function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('missing or malformed Authorization header', 401);
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new AppError('missing token', 401);
    }

    const payload = authService.verifyToken(token);
    req.userId = payload.sub;
    req.username = payload.username;
    next();
  };
}
