import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { UserRepository } from '../repositories/userRepository';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createUserRoutes(
  repo: UserRepository,
  authMiddleware: RequestHandler
): Router {
  const router = Router();

  // GET /api/users — all users except the requester
  router.get(
    '/',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const users = await repo.listExcept(req.userId as string);
      res.status(200).json(users);
    })
  );

  return router;
}
