import { Pool } from 'pg';

const CREATE_SQL = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username      text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
  );
`;

/**
 * Idempotent schema migration. Safe to run on every boot.
 */
export async function migrate(pool: Pool): Promise<void> {
  await pool.query(CREATE_SQL);
}

/**
 * Connect + migrate with a retry loop, because Postgres may not be ready
 * yet when this container starts (defensive even with a compose healthcheck).
 */
export async function connectWithRetry(
  pool: Pool,
  attempts = 10,
  delayMs = 2000
): Promise<void> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      await migrate(pool);
      console.log('[db] connected and migrated');
      return;
    } catch (err) {
      lastErr = err;
      console.warn(
        `[db] connection attempt ${i}/${attempts} failed, retrying in ${delayMs}ms`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(
    `[db] could not connect after ${attempts} attempts: ${String(lastErr)}`
  );
}
