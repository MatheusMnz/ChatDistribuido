import express, { Application } from 'express';
import cors from 'cors';
import conversationRoutes from './routes/conversationRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { env } from './config/env';

/**
 * Constrói a aplicação Express. Exportado para uso direto nos testes (supertest).
 */
export function buildApp(): Application {
  const app = express();

  app.use(cors({ exposedHeaders: ['X-Instance'] }));
  app.use(express.json());

  // Identifica a instância que atendeu a requisição (evidencia o balanceamento de carga).
  // Um teste de load balancing no topo lê este header para provar a distribuição de tráfego.
  app.use((_req, res, next) => {
    res.setHeader('X-Instance', env.INSTANCE_ID || 'chat');
    next();
  });

  // Health check — inclui o INSTANCE_ID para evidenciar o balanceador de carga.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', instance: env.INSTANCE_ID });
  });

  app.use('/api/conversations', conversationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
