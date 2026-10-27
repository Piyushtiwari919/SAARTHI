import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';

async function bootstrap() {
  try {
    // 1. Connect to MongoDB
    await connectDatabase();

    // 2. Start HTTP Server
    const server = app.listen(env.PORT, () => {
      console.log(`[Saarthi API] Server listening on http://localhost:${env.PORT}`);
      console.log(`[Saarthi API] Environment: ${env.NODE_ENV}`);
      console.log(`[Saarthi API] Storage driver: ${env.STORAGE_DRIVER}`);
    });

    // 3. Graceful Shutdown Handlers
    const shutdown = async (signal: string) => {
      console.log(`[Saarthi API] Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        console.log('[Saarthi API] HTTP server closed.');
        await disconnectDatabase();
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        console.error('[Saarthi API] Forceful shutdown initiated after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('[Saarthi API] Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();

