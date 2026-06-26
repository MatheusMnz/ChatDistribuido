import http from 'http';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { buildApp } from './app';
import { createSocketServer } from './socket/server';
import { connectMongo, disconnectMongo } from './db/mongo';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  // 1) Mongo (com retry para robustez no boot).
  await connectMongo(env.MONGO_URL);

  // 2) HTTP + Socket.IO.
  const app = buildApp();
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer);

  // 3) Redis adapter — habilita broadcast entre as N instâncias.
  //    Pulado graciosamente se REDIS_URL não estiver definido.
  if (env.REDIS_URL) {
    try {
      const pubClient = createClient({ url: env.REDIS_URL });
      const subClient = pubClient.duplicate();

      pubClient.on('error', (e) => console.error('[redis][pub] error', e.message));
      subClient.on('error', (e) => console.error('[redis][sub] error', e.message));

      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log(`[redis] adapter connected to ${env.REDIS_URL}`);
    } catch (err) {
      console.error(
        `[redis] failed to connect adapter, continuing single-instance: ${(err as Error).message}`
      );
    }
  } else {
    console.warn('[redis] REDIS_URL not set — running without Redis adapter (single instance)');
  }

  httpServer.listen(env.PORT, () => {
    console.log(
      `[chat-service][${env.INSTANCE_ID}] listening on port ${env.PORT} (mongo + socket.io ready)`
    );
  });

  // Encerramento gracioso.
  const shutdown = async (signal: string) => {
    console.log(`[chat-service] received ${signal}, shutting down...`);
    io.close();
    httpServer.close();
    await disconnectMongo();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[chat-service] fatal boot error', err);
  process.exit(1);
});
