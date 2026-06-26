import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthService } from '../services/authService';
import { UserRepository } from '../repositories/userRepository';
import { AppError } from '../utils/AppError';

/** Wraps an async handler so rejected promises reach the error handler. */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createAuthRoutes(
  authService: AuthService,
  repo: UserRepository,
  authMiddleware: RequestHandler
): Router {
  const router = Router();

  // POST /api/auth/register
  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const { username, password } = req.body ?? {};
      const user = await authService.register(username, password);
      res.status(201).json({ id: user.id, username: user.username });
    })
  );

  // POST /api/auth/login
  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const { username, password } = req.body ?? {};
      const result = await authService.login(username, password);
      res.status(200).json(result);
    })
  );

  // GET /api/auth/me
  router.get(
    '/me',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const user = await repo.findById(req.userId as string);
      if (!user) {
        throw new AppError('user not found', 404);
      }
      res.status(200).json({ id: user.id, username: user.username });
    })
  );

  return router;
}
