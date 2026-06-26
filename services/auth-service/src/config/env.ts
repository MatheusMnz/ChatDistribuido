export interface Env {
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
}

/**
 * Reads and validates required environment variables.
 * Throws early (fail-fast) when a required variable is missing so the
 * service does not boot in a half-configured state.
 */
export function loadEnv(): Env {
  const DATABASE_URL = process.env.DATABASE_URL;
  const JWT_SECRET = process.env.JWT_SECRET;

  const missing: string[] = [];
  if (!DATABASE_URL) missing.push('DATABASE_URL');
  if (!JWT_SECRET) missing.push('JWT_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  return {
    PORT: Number(process.env.PORT) || 4000,
    DATABASE_URL: DATABASE_URL as string,
    JWT_SECRET: JWT_SECRET as string,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  };
}
