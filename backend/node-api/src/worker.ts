import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createDocumentWorker } from './queue/document-worker.js';
import { getSharedRedisClient } from './config/redis.js';

console.info('[Worker] Initializing Saarthi Background Processing Worker...');

async function startWorker() {
  await connectDatabase();
  const worker = createDocumentWorker(2);

  console.info('[Worker] Document processing worker is listening for jobs on queue "document-processing"');

  const shutdown = async (signal: string) => {
    console.info(`[Worker] Received ${signal}. Shutting down worker gracefully...`);
    try {
      await worker.close();
      const redis = getSharedRedisClient();
      await redis.quit();
      await disconnectDatabase();
      console.info('[Worker] Graceful shutdown completed.');
      process.exit(0);
    } catch (err: any) {
      console.error('[Worker] Error during shutdown:', err.message);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startWorker().catch((err) => {
  console.error('[Worker] Fatal error starting worker:', err);
  process.exit(1);
});

