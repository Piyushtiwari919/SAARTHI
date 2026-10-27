import { AppError } from '../../middleware/error-handler.js';
import { eligibilityRepository, EligibilityRepository } from './eligibility.repository.js';
import { aggregateEvaluation } from './rule-engine.js';
import { UserEvidence } from './eligibility.types.js';
import { IActionItem } from './eligibility-result.model.js';

export interface FormattedEligibilityResponse {
  opportunityId: string;
  opportunityTitle: string;
  overallStatus: 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_VERIFIED';
  confidenceScore: number;
  evaluatedAt: string;
  summary: string;
  requirements: Array<{
    id: string;
    field: string;
    fieldLabel: string;
    operator: string;
    expectedValue: unknown;
    actualValue: unknown;
    unit?: string;
    status: 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_VERIFIED';
    explanation: string;
    sourceDocumentId?: string;
    sourcePage?: number;
    evidenceSnippet?: string;
    isMandatory: boolean;
  }>;
  missingDocuments: string[];
  actionItems: IActionItem[];
}

export class EligibilityService {
  constructor(private readonly repo: EligibilityRepository = eligibilityRepository) {}

  public async evaluateOpportunity(
    userId: string,
    opportunityId: string,
    additionalEvidence?: UserEvidence[]
  ): Promise<FormattedEligibilityResponse> {
    const opp = await this.repo.getOpportunityById(opportunityId);
    if (!opp) {
      throw new AppError(`Opportunity not found: ${opportunityId}`, 404);
    }

    // 1. Gather all user evidence
    const { evidence, uploadedDocTypes } = await this.repo.collectUserEvidence(userId);
    const combinedEvidence = additionalEvidence ? [...evidence, ...additionalEvidence] : evidence;

    // 2. Run generic deterministic rule engine
    const evaluation = aggregateEvaluation(opp.opportunityId, opp.rules, combinedEvidence, opp.title);

    // 3. Compute missing documents
    const missingDocs = (opp.requiredDocumentTypes || []).filter(
      (docType) => !uploadedDocTypes.includes(docType)
    );

    // 4. Calculate confidence score
    let confidenceScore = 0;
    if (evaluation.overallStatus === 'PASS') {
      confidenceScore = 95;
    } else if (evaluation.overallStatus === 'FAIL') {
      confidenceScore = 90;
    } else {
      confidenceScore = 40;
    }

    // 5. Generate action items
    const actionItems: IActionItem[] = [];

    // Missing documents action items
    for (const missingType of missingDocs) {
      actionItems.push({
        id: `act_doc_${missingType.toLowerCase()}_${opp.opportunityId}`,
        title: `Upload ${missingType.replace(/_/g, ' ')}`,
        description: `This opportunity requires a verified ${missingType.replace(/_/g, ' ')} for submission.`,
        type: 'UPLOAD_DOCUMENT',
        targetDocumentType: missingType,
        targetOpportunityId: opp.opportunityId,
        isCompleted: false,
        priority: 'HIGH',
      });
    }

    // Review / verification action items for unknown requirements
    for (const req of evaluation.requirements) {
      if (req.status === 'UNKNOWN') {
        actionItems.push({
          id: `act_verify_${req.ruleId}_${opp.opportunityId}`,
          title: `Verify ${req.field.replace(/_/g, ' ')}`,
          description: req.reason,
          type: 'VERIFY_ATTRIBUTE',
          targetOpportunityId: opp.opportunityId,
          isCompleted: false,
          priority: 'MEDIUM',
        });
      }
    }

    // Pass -> Apply now
    if (evaluation.overallStatus === 'PASS' && missingDocs.length === 0) {
      actionItems.push({
        id: `act_apply_${opp.opportunityId}`,
        title: `Submit application for ${opp.title}`,
        description: `All criteria verified. Complete your application on ${opp.applicationUrl || 'the scholarship portal'}.`,
        type: 'APPLY_NOW',
        targetOpportunityId: opp.opportunityId,
        isCompleted: false,
        priority: 'HIGH',
      });
    }

    // 6. Persist to MongoDB
    await this.repo.saveEvaluationResult(userId, {
      opportunityId: opp.opportunityId,
      opportunityTitle: opp.title,
      overallStatus: evaluation.overallStatus,
      confidenceScore,
      summary: evaluation.summary,
      requirements: evaluation.requirements,
      missingDocuments: missingDocs,
      actionItems,
    });

    // 7. Format response
    return {
      opportunityId: opp.opportunityId,
      opportunityTitle: opp.title,
      overallStatus: evaluation.overallStatus,
      confidenceScore,
      evaluatedAt: evaluation.evaluatedAt,
      summary: evaluation.summary,
      requirements: evaluation.requirements.map((r, i) => {
        const originalRule = opp.rules[i];
        return {
          id: r.ruleId,
          field: r.field,
          fieldLabel: r.field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          operator: r.operator,
          expectedValue: r.expectedValue,
          actualValue: r.actualValue,
          unit: r.unit,
          status: r.status,
          explanation: r.reason,
          sourceDocumentId: r.evidence?.documentId || r.source?.documentId,
          sourcePage: r.evidence?.page || r.source?.page,
          evidenceSnippet: r.evidence?.evidenceSnippet || r.source?.evidenceSnippet,
          isMandatory: originalRule?.required !== false,
        };
      }),
      missingDocuments: missingDocs,
      actionItems,
    };
  }

  public async getEligibilityForOpportunity(
    userId: string,
    opportunityId: string
  ): Promise<FormattedEligibilityResponse> {
    // If not previously evaluated, run evaluation automatically
    const existing = await this.repo.getResultByUserAndOpportunity(userId, opportunityId);
    if (existing) {
      return {
        opportunityId: existing.opportunityId,
        opportunityTitle: existing.opportunityTitle,
        overallStatus: existing.overallStatus,
        confidenceScore: existing.confidenceScore,
        evaluatedAt: existing.evaluatedAt.toISOString(),
        summary: existing.summary,
        requirements: existing.requirements.map((r) => ({
          id: r.ruleId,
          field: r.field,
          fieldLabel: r.field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          operator: r.operator,
          expectedValue: r.expectedValue,
          actualValue: r.actualValue,
          unit: r.unit,
          status: r.status,
          explanation: r.reason,
          sourceDocumentId: r.evidence?.documentId || r.source?.documentId,
          sourcePage: r.evidence?.page || r.source?.page,
          evidenceSnippet: r.evidence?.evidenceSnippet || r.source?.evidenceSnippet,
          isMandatory: true,
        })),
        missingDocuments: existing.missingDocuments,
        actionItems: existing.actionItems,
      };
    }

    return this.evaluateOpportunity(userId, opportunityId);
  }

  public async getResultById(userId: string, resultId: string): Promise<FormattedEligibilityResponse> {
    const result = await this.repo.getResultById(resultId);
    if (!result) {
      throw new AppError(`Eligibility evaluation result not found: ${resultId}`, 404);
    }

    // Strict multi-tenant isolation: prevent user B from seeing user A's result
    if (result.userId.toString() !== userId) {
      throw new AppError('Forbidden: Access denied to this evaluation result', 403);
    }

    return {
      opportunityId: result.opportunityId,
      opportunityTitle: result.opportunityTitle,
      overallStatus: result.overallStatus,
      confidenceScore: result.confidenceScore,
      evaluatedAt: result.evaluatedAt.toISOString(),
      summary: result.summary,
      requirements: result.requirements.map((r) => ({
        id: r.ruleId,
        field: r.field,
        fieldLabel: r.field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        operator: r.operator,
        expectedValue: r.expectedValue,
        actualValue: r.actualValue,
        unit: r.unit,
        status: r.status,
        explanation: r.reason,
        sourceDocumentId: r.evidence?.documentId || r.source?.documentId,
        sourcePage: r.evidence?.page || r.source?.page,
        evidenceSnippet: r.evidence?.evidenceSnippet || r.source?.evidenceSnippet,
        isMandatory: true,
      })),
      missingDocuments: result.missingDocuments,
      actionItems: result.actionItems,
    };
  }

  public async getAllEligibilitySummaries(userId: string): Promise<FormattedEligibilityResponse[]> {
    const opportunities = await this.repo.getAllActiveOpportunities();
    const results: FormattedEligibilityResponse[] = [];

    for (const opp of opportunities) {
      const res = await this.getEligibilityForOpportunity(userId, opp.opportunityId);
      results.push(res);
    }

    return results;
  }

  public async getActionItems(userId: string): Promise<IActionItem[]> {
    const allSummaries = await this.getAllEligibilitySummaries(userId);
    const actions: IActionItem[] = [];
    const seenIds = new Set<string>();

    for (const sum of allSummaries) {
      for (const act of sum.actionItems) {
        if (!seenIds.has(act.id)) {
          seenIds.add(act.id);
          actions.push(act);
        }
      }
    }

    return actions;
  }
}

export const eligibilityService = new EligibilityService();

