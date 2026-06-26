/**
 * Application error carrying an HTTP status code.
 * Thrown by services / repositories and translated to a JSON response
 * by the centralized error handler.
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
