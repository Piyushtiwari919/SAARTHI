import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { errorHandler, AppError } from './middleware/error-handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { documentRoutes } from './modules/documents/document.routes.js';
import { eligibilityRouter } from './modules/eligibility/eligibility.routes.js';

export function createApp(): Express {
  const app = express();

  // 1. Security & Protection
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // 2. Request Parsers
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 3. Rate limiting for general API requests
  app.use('/api', apiLimiter);

  // 4. Health Check Endpoints
  const healthCheckHandler = (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      service: 'saarthi-node-api',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  };

  app.get('/health', healthCheckHandler);
  app.get('/api/v1/health', healthCheckHandler);
  app.get('/api/health', healthCheckHandler);

  // 5. Versioned API Routes (Day 1-2 API contract)
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/documents', documentRoutes);
  app.use('/api/v1/eligibility', eligibilityRouter);

  // 6. Direct /api/ aliases (Frontend service compatibility)
  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/eligibility', eligibilityRouter);

  // 7. 404 Route Handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(`Cannot ${req.method} ${req.originalUrl} - Endpoint not found`, 404));
  });

  // 8. Central Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();

