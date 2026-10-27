import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('API Contract & Route Integration Tests', () => {
  describe('Health Check Endpoints', () => {
    it('GET /health returns 200 with service info', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.service).toBe('saarthi-node-api');
      expect(res.body.timestamp).toBeDefined();
    });

    it('GET /api/v1/health returns 200 with service info', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
    });

    it('GET /api/health (direct alias) returns 200', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
    });

    it('GET /health/ready returns readiness check with component breakdown', async () => {
      const res = await request(app).get('/health/ready');
      expect([200, 503]).toContain(res.status);
      expect(res.body.checks).toBeDefined();
      expect(res.body.checks.mongodb).toBeDefined();
      expect(res.body.checks.redis).toBeDefined();
    });
  });

  describe('Route Not Found (404)', () => {
    it('Returns 404 with structured JSON for nonexistent endpoints', async () => {
      const res = await request(app).get('/api/v1/nonexistent-route');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Endpoint not found');
    });
  });

  describe('Authentication Enforcement on Protected Routes', () => {
    it('GET /api/v1/auth/me rejects requests missing token or cookie with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Authentication required');
    });

    it('GET /api/v1/documents rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/documents');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/eligibility/all rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/eligibility/all');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Input Validation on Auth Endpoints', () => {
    it('POST /api/v1/auth/login validates required fields and rejects empty request', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('POST /api/v1/auth/signup validates input schema and returns 400 on invalid email', async () => {
      const res = await request(app).post('/api/v1/auth/signup').send({
        fullName: 'Student',
        email: 'bad-email-format',
        password: 'Pass',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.some((e: any) => e.field === 'email')).toBe(true);
      expect(res.body.errors.some((e: any) => e.field === 'password')).toBe(true);
    });
  });
});

