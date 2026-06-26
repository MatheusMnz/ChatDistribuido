/**
 * Erro de aplicação com status HTTP associado.
 * O errorHandler central converte isto em uma resposta `{ error }`.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
