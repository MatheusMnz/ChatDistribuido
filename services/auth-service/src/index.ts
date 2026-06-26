import { loadEnv } from './config/env';
import { getPool } from './db/pool';
import { connectWithRetry } from './db/migrate';
import { createUserRepository } from './repositories/userRepository';
import { buildApp } from './app';

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = getPool();

  // Defensive: Postgres may not be ready yet on startup.
  await connectWithRetry(pool);

  const repo = createUserRepository(pool);
  const app = buildApp({
    repo,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
  });

  app.listen(env.PORT, () => {
    console.log(`[auth-service] listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('[auth-service] fatal startup error:', err);
  process.exit(1);
});
