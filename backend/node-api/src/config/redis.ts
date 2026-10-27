import { Redis } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { env } from './env.js';

export function getRedisConnectionOptions(): ConnectionOptions {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      // Bounded retry with exponential backoff (up to 3 seconds)
      const delay = Math.min(times * 200, 3000);
      return delay;
    },
    lazyConnect: true,
  };
}

let sharedRedisClient: Redis | null = null;

export function getSharedRedisClient(): Redis {
  if (!sharedRedisClient) {
    sharedRedisClient = new Redis(getRedisConnectionOptions() as any);
    sharedRedisClient.on('error', (err) => {
      // Non-fatal logging during disconnected dev/test environments
      if (env.NODE_ENV !== 'test') {
        console.warn('[Redis] Connection warning:', err.message);
      }
    });
  }
  return sharedRedisClient;
}

export async function checkRedisHealth(): Promise<{ status: 'UP' | 'DOWN'; latencyMs?: number; message?: string }> {
  const client = getSharedRedisClient();
  const startTime = Date.now();
  try {
    if (client.status === 'wait') {
      await client.connect();
    }
    const pong = await client.ping();
    const latencyMs = Date.now() - startTime;
    if (pong === 'PONG') {
      return { status: 'UP', latencyMs };
    }
    return { status: 'DOWN', message: `Unexpected response: ${pong}` };
  } catch (err: any) {
    return { status: 'DOWN', message: err.message };
  }
}
