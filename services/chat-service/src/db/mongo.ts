import mongoose from 'mongoose';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Conecta ao MongoDB com retry (robustez no boot quando o Mongo ainda sobe).
 */
export async function connectMongo(
  url: string,
  { retries = 10, delayMs = 3000 }: { retries?: number; delayMs?: number } = {}
): Promise<typeof mongoose> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(url);
      console.log(`[mongo] connected to ${url}`);
      return mongoose;
    } catch (err) {
      lastErr = err;
      console.warn(
        `[mongo] connection attempt ${attempt}/${retries} failed: ${(err as Error).message}`
      );
      if (attempt < retries) await sleep(delayMs);
    }
  }
  throw lastErr;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
