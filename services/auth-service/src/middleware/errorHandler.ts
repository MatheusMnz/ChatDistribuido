import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

/**
 * Centralized error handler. Returns `{ error: message }` with the proper
 * status code. Unknown errors become a 500.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error('[error]', err);
  res.status(500).json({ error: 'internal server error' });
}

/**
 * 404 fallback for unmatched routes.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'not found' });
}
