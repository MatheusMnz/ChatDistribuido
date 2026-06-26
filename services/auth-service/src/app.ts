import express, { Express } from 'express';
import cors from 'cors';
import { UserRepository } from './repositories/userRepository';
import { createAuthService } from './services/authService';
import { createAuthMiddleware } from './middleware/auth';
import { createAuthRoutes } from './routes/authRoutes';
import { createUserRoutes } from './routes/userRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export interface AppDeps {
  repo: UserRepository;
  jwtSecret: string;
  jwtExpiresIn: string;
}

/**
 * Builds and returns the Express app. The repository is injected so tests
 * can pass a mock and run without a real Postgres.
 */
export function buildApp(deps: AppDeps): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const authService = createAuthService(deps.repo, {
    jwtSecret: deps.jwtSecret,
    jwtExpiresIn: deps.jwtExpiresIn,
  });
  const authMiddleware = createAuthMiddleware(authService);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRoutes(authService, deps.repo, authMiddleware));
  app.use('/api/users', createUserRoutes(deps.repo, authMiddleware));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
