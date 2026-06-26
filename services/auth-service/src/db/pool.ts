import { Pool } from 'pg';
import { loadEnv } from '../config/env';

let pool: Pool | null = null;

/**
 * Lazily creates (and memoizes) the pg Pool from DATABASE_URL.
 * Kept lazy so importing modules that depend on the repository does not
 * force a DB connection at import time (important for unit tests).
 */
export function getPool(): Pool {
  if (!pool) {
    const env = loadEnv();
    pool = new Pool({ connectionString: env.DATABASE_URL });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
