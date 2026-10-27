import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EligibilityService } from '../../../src/modules/eligibility/eligibility.service.js';
import { EligibilityRepository } from '../../../src/modules/eligibility/eligibility.repository.js';
import { AppError } from '../../../src/middleware/error-handler.js';

describe('EligibilityService Unit & Authorization Tests', () => {
  let mockRepo: EligibilityRepository;
  let service: EligibilityService;

  const mockOpportunity = {
    opportunityId: 'opp_test_01',
    title: 'Post-Matric Merit Scholarship',
    rules: [
      {
        ruleId: 'r1',
        field: 'percentage',
        operator: 'GTE' as const,
        expectedValue: 70,
        unit: '%',
        required: true,
      },
      {
        ruleId: 'r2',
        field: 'annual_family_income',
        operator: 'LTE' as const,
        expectedValue: 300000,
        unit: 'INR',
        required: true,
      },
    ],
    requiredDocumentTypes: ['MARKSHEET', 'INCOME_CERTIFICATE'],
    applicationUrl: 'https://scholarships.gov.in',
  };

  beforeEach(() => {
    mockRepo = {
      getOpportunityById: vi.fn(),
      getAllActiveOpportunities: vi.fn(),
      collectUserEvidence: vi.fn(),
      saveEvaluationResult: vi.fn(),
      getEvaluationResultsForUser: vi.fn(),
      getResultByUserAndOpportunity: vi.fn(),
      getResultById: vi.fn(),
    } as unknown as EligibilityRepository;

    service = new EligibilityService(mockRepo);
  });

  it('Evaluates opportunity and returns PASS when all required criteria are met', async () => {
    vi.mocked(mockRepo.getOpportunityById).mockResolvedValue(mockOpportunity as any);
    vi.mocked(mockRepo.collectUserEvidence).mockResolvedValue({
      evidence: [
        { field: 'percentage', value: 85, unit: '%', status: 'EXTRACTED' },
        { field: 'annual_family_income', value: 150000, unit: 'INR', status: 'EXTRACTED' },
      ],
      uploadedDocTypes: ['MARKSHEET', 'INCOME_CERTIFICATE'],
    });
    vi.mocked(mockRepo.saveEvaluationResult).mockResolvedValue({} as any);

    const result = await service.evaluateOpportunity('user_123', 'opp_test_01');

    expect(result.overallStatus).toBe('PASS');
    expect(result.confidenceScore).toBe(95);
    expect(result.missingDocuments).toEqual([]);
    expect(result.actionItems.some((a) => a.type === 'APPLY_NOW')).toBe(true);
    expect(mockRepo.saveEvaluationResult).toHaveBeenCalledOnce();
  });

  it('Identifies missing documents and generates UPLOAD_DOCUMENT action items', async () => {
    vi.mocked(mockRepo.getOpportunityById).mockResolvedValue(mockOpportunity as any);
    vi.mocked(mockRepo.collectUserEvidence).mockResolvedValue({
      evidence: [
        { field: 'percentage', value: 85, unit: '%', status: 'EXTRACTED' },
      ],
      // Missing INCOME_CERTIFICATE
      uploadedDocTypes: ['MARKSHEET'],
    });
    vi.mocked(mockRepo.saveEvaluationResult).mockResolvedValue({} as any);

    const result = await service.evaluateOpportunity('user_123', 'opp_test_01');

    expect(result.overallStatus).toBe('UNKNOWN');
    expect(result.missingDocuments).toContain('INCOME_CERTIFICATE');
    expect(
      result.actionItems.some(
        (a) => a.type === 'UPLOAD_DOCUMENT' && a.targetDocumentType === 'INCOME_CERTIFICATE'
      )
    ).toBe(true);
  });

  it('Enforces strict user isolation: throws 403 Forbidden when accessing another users evaluation result', async () => {
    const ownerUserId = 'user_legitimate_owner_111';
    const attackerUserId = 'user_attacker_999';

    vi.mocked(mockRepo.getResultById).mockResolvedValue({
      id: 'res_abc_123',
      userId: ownerUserId as any,
      opportunityId: 'opp_test_01',
      opportunityTitle: 'Post-Matric Merit Scholarship',
      overallStatus: 'PASS',
      confidenceScore: 95,
      evaluatedAt: new Date(),
      summary: 'Pass summary',
      requirements: [],
      missingDocuments: [],
      actionItems: [],
    } as any);

    // Attacker tries to read owner's result by guessing resultId
    await expect(service.getResultById(attackerUserId, 'res_abc_123')).rejects.toThrowError(
      new AppError('Forbidden: Access denied to this evaluation result', 403)
    );
  });

  it('Throws 404 when evaluated opportunity does not exist', async () => {
    vi.mocked(mockRepo.getOpportunityById).mockResolvedValue(null);

    await expect(service.evaluateOpportunity('user_123', 'nonexistent_opp')).rejects.toThrowError(
      new AppError('Opportunity not found: nonexistent_opp', 404)
    );
  });
});

