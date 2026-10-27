import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../src/app.js';
import { env } from '../../../src/config/env.js';
import { eligibilityService } from '../../../src/modules/eligibility/eligibility.service.js';

describe('Eligibility API Routes Integration Tests', () => {
  const validUserToken = jwt.sign(
    { userId: 'user_authenticated_123', email: 'applicant@test.ac.in' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  it('POST /api/v1/eligibility/evaluate returns 401 when token is missing', async () => {
    const res = await request(app)
      .post('/api/v1/eligibility/evaluate')
      .send({ opportunityId: 'opp_css_01' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/eligibility/evaluate returns 400 when opportunityId is omitted', async () => {
    const res = await request(app)
      .post('/api/v1/eligibility/evaluate')
      .set('Authorization', `Bearer ${validUserToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('opportunityId is required');
  });

  it('POST /api/v1/eligibility/evaluate succeeds with valid token and opportunityId', async () => {
    vi.spyOn(eligibilityService, 'evaluateOpportunity').mockResolvedValueOnce({
      opportunityId: 'opp_css_01',
      opportunityTitle: 'Central Sector Scheme',
      overallStatus: 'PASS',
      confidenceScore: 95,
      evaluatedAt: new Date().toISOString(),
      summary: 'All criteria satisfied.',
      requirements: [
        {
          id: 'crit_1',
          field: 'percentage',
          fieldLabel: 'Percentage',
          operator: 'GTE',
          expectedValue: 80,
          actualValue: 85,
          status: 'PASS',
          explanation: 'Value 85 satisfies condition: GTE 80.',
          isMandatory: true,
        },
      ],
      missingDocuments: [],
      actionItems: [],
    });

    const res = await request(app)
      .post('/api/v1/eligibility/evaluate')
      .set('Authorization', `Bearer ${validUserToken}`)
      .send({ opportunityId: 'opp_css_01' });

    expect(res.status).toBe(200);
    expect(res.body.opportunityId).toBe('opp_css_01');
    expect(res.body.overallStatus).toBe('PASS');
    expect(res.body.requirements).toBeInstanceOf(Array);
  });

  it('GET /api/v1/eligibility/all returns summaries for authenticated user', async () => {
    vi.spyOn(eligibilityService, 'getAllEligibilitySummaries').mockResolvedValueOnce([
      {
        opportunityId: 'opp_css_01',
        opportunityTitle: 'Central Sector Scheme',
        overallStatus: 'PASS',
        confidenceScore: 95,
        evaluatedAt: new Date().toISOString(),
        summary: 'All criteria satisfied.',
        requirements: [],
        missingDocuments: [],
        actionItems: [],
      },
    ]);

    const res = await request(app)
      .get('/api/v1/eligibility/all')
      .set('Authorization', `Bearer ${validUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].opportunityId).toBe('opp_css_01');
  });

  it('GET /api/v1/eligibility/action-items returns aggregated action items', async () => {
    vi.spyOn(eligibilityService, 'getActionItems').mockResolvedValueOnce([
      {
        id: 'act_1',
        title: 'Upload Income Certificate',
        description: 'Required for income verification',
        type: 'UPLOAD_DOCUMENT',
        targetDocumentType: 'INCOME_CERTIFICATE',
        isCompleted: false,
        priority: 'HIGH',
      },
    ]);

    const res = await request(app)
      .get('/api/v1/eligibility/action-items')
      .set('Authorization', `Bearer ${validUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].type).toBe('UPLOAD_DOCUMENT');
  });
});

