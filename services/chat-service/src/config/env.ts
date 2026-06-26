/**
 * Configuração central de variáveis de ambiente.
 * Segue o contrato definido em docs/ARCHITECTURE.md.
 */
export interface Env {
  PORT: number;
  MONGO_URL: string;
  REDIS_URL: string | undefined;
  JWT_SECRET: string;
  AUTH_SERVICE_URL: string;
  INSTANCE_ID: string;
}

export const env: Env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGO_URL: process.env.MONGO_URL || 'mongodb://mongo:27017/chatdb',
  // REDIS_URL pode ser indefinido (ex.: ambiente de teste single-instance).
  REDIS_URL: process.env.REDIS_URL || undefined,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://auth-service:4000',
  INSTANCE_ID: process.env.INSTANCE_ID || 'chat-local'
};

export const MAX_MESSAGE_LENGTH = 4000;
