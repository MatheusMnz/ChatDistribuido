import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

/**
 * Handler de erros centralizado. Sempre responde no formato `{ error }`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // next é necessário para o Express reconhecer isto como error handler.
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error('[error]', err);
  res.status(500).json({ error: 'internal server error' });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'not found' });
}
