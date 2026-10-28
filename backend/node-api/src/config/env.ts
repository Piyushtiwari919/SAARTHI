import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/saarthi'),
  JWT_SECRET: z.string().min(8).default('saarthi_dev_secret_key_change_in_production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().default('saarthi_cookie_secret_dev'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./storage/documents'),
  AWS_REGION: z.string().optional().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().optional().default('saarthi-private-documents'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AI_SERVICE_URL: z.string().default('http://127.0.0.1:8000'),
  INTERNAL_SERVICE_TOKEN: z.string().default('dev_internal_secret_token_change_me_in_production'),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  ENABLE_BACKGROUND_WORKER: z.coerce.boolean().default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration validation failed');
}

export const env = {
  ...parsed.data,
  RESOLVED_LOCAL_STORAGE_DIR: path.resolve(process.cwd(), parsed.data.LOCAL_STORAGE_DIR),
};
