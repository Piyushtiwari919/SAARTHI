import { ApiService, USE_MOCKS, simulateLatency } from './api.ts';
import type { OpportunityEligibility, ActionItem, EligibilityRequirement, EligibilityStatus } from '../types/eligibility.ts';
import { mockEligibilityResults } from '../mocks/data/eligibility.mock.ts';

function formatFieldLabel(field?: string): string {
  if (!field) return 'Requirement';
  return field
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeEligibilityStatus(status?: string): EligibilityStatus {
  if (!status) return 'UNKNOWN';
  const upper = status.toUpperCase();
  if (upper === 'PASS' || upper === 'ELIGIBLE') return 'PASS';
  if (upper === 'FAIL' || upper === 'INELIGIBLE') return 'FAIL';
  if (upper === 'NOT_VERIFIED') return 'NOT_VERIFIED';
  return 'UNKNOWN';
}

export function normalizeActionItem(raw: any, fallbackOppId?: string): ActionItem {
  return {
    id: String(raw.id || raw._id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
    title: raw.title || 'Action Required',
    description: raw.description || '',
    type: raw.type || 'UPLOAD_DOCUMENT',
    targetDocumentType: raw.targetDocumentType,
    targetOpportunityId: raw.targetOpportunityId || fallbackOppId,
    isCompleted: Boolean(raw.isCompleted),
    priority: raw.priority || 'MEDIUM',
    dueDate: raw.dueDate,
  };
}

export function normalizeEligibility(raw: any): OpportunityEligibility {
  if (!raw) {
    return {
      opportunityId: '',
      opportunityTitle: 'Scholarship Opportunity',
      overallStatus: 'UNKNOWN',
      confidenceScore: 0,
      evaluatedAt: new Date().toISOString(),
      summary: 'No evaluation data available.',
      requirements: [],
      missingDocuments: [],
      actionItems: [],
    };
  }

  const opportunityId = String(raw.opportunityId || raw.id || raw._id || '');
  const opportunityTitle = raw.opportunityTitle || raw.title || 'Scholarship Opportunity';
  const overallStatus = normalizeEligibilityStatus(raw.overallStatus || raw.status);
  const confidenceScore = typeof raw.confidenceScore === 'number' ? raw.confidenceScore : 0;
  const evaluatedAt = raw.evaluatedAt ? new Date(raw.evaluatedAt).toISOString() : new Date().toISOString();
  const summary = raw.summary || (overallStatus === 'PASS' ? 'All mandatory criteria verified.' : 'Evidence review needed.');

  const rawReqs = Array.isArray(raw.requirements) ? raw.requirements : [];
  const requirements: EligibilityRequirement[] = rawReqs.map((r: any, idx: number) => ({
    id: String(r.id || r.ruleId || `req_${opportunityId}_${idx}`),
    field: r.field || `field_${idx}`,
    fieldLabel: r.fieldLabel || formatFieldLabel(r.field),
    operator: r.operator || '==',
    expectedValue: r.expectedValue ?? '',
    actualValue: r.actualValue,
    unit: r.unit,
    status: normalizeEligibilityStatus(r.status),
    explanation: r.explanation || r.reason || '',
    sourceDocumentId: r.sourceDocumentId || r.evidence?.documentId || r.source?.documentId,
    sourceDocumentName: r.sourceDocumentName,
    sourcePage: r.sourcePage || r.evidence?.page || r.source?.page,
    isMandatory: r.isMandatory !== false && r.required !== false,
  }));

  const rawActions = Array.isArray(raw.actionItems) ? raw.actionItems : [];
  const actionItems: ActionItem[] = rawActions.map((a: any) => normalizeActionItem(a, opportunityId));

  return {
    opportunityId,
    opportunityTitle,
    overallStatus,
    confidenceScore,
    evaluatedAt,
    summary,
    requirements,
    missingDocuments: Array.isArray(raw.missingDocuments) ? raw.missingDocuments : [],
    actionItems,
  };
}

class EligibilityService {
  public async getEligibilityForOpportunity(
    opportunityId: string
  ): Promise<OpportunityEligibility | null> {
    if (USE_MOCKS) {
      await simulateLatency(200);
      const res = mockEligibilityResults[opportunityId];
      return res ? normalizeEligibility(res) : null;
    }
    try {
      const raw = await ApiService.request<any>(
        `/api/eligibility/opportunity/${opportunityId}`
      );
      return raw ? normalizeEligibility(raw) : null;
    } catch (err) {
      console.warn(`Eligibility check for opportunity ${opportunityId} returned error:`, err);
      return null;
    }
  }

  public async evaluateOpportunity(
    opportunityId: string
  ): Promise<OpportunityEligibility> {
    if (USE_MOCKS) {
      await simulateLatency(300);
      const res = mockEligibilityResults[opportunityId] || {
        opportunityId,
        opportunityTitle: 'Scholarship Opportunity',
        overallStatus: 'PASS',
        confidenceScore: 90,
        evaluatedAt: new Date().toISOString(),
        summary: 'Mock criteria evaluated successfully against verified profile.',
        requirements: [],
        missingDocuments: [],
        actionItems: [],
      };
      return normalizeEligibility(res);
    }
    const raw = await ApiService.request<any>('/api/eligibility/evaluate', {
      method: 'POST',
      body: JSON.stringify({ opportunityId }),
    });
    return normalizeEligibility(raw);
  }

  public async evaluateAllOpportunities(): Promise<OpportunityEligibility[]> {
    if (USE_MOCKS) {
      await simulateLatency(250);
      return Object.values(mockEligibilityResults).map(normalizeEligibility);
    }
    const rawList = await ApiService.request<any[]>('/api/eligibility/evaluate-all', {
      method: 'POST',
    });
    return Array.isArray(rawList) ? rawList.map(normalizeEligibility) : [];
  }

  public async getAllEligibilitySummaries(): Promise<OpportunityEligibility[]> {
    if (USE_MOCKS) {
      await simulateLatency(250);
      return Object.values(mockEligibilityResults).map(normalizeEligibility);
    }
    const rawList = await ApiService.request<any[]>('/api/eligibility/all');
    return Array.isArray(rawList) ? rawList.map(normalizeEligibility) : [];
  }

  public async getActionItems(): Promise<ActionItem[]> {
    if (USE_MOCKS) {
      await simulateLatency(150);
      const allActions: ActionItem[] = [];
      for (const res of Object.values(mockEligibilityResults)) {
        allActions.push(...res.actionItems);
      }
      return allActions.map((a) => normalizeActionItem(a));
    }
    const rawActions = await ApiService.request<any[]>('/api/eligibility/action-items');
    return Array.isArray(rawActions) ? rawActions.map((a) => normalizeActionItem(a)) : [];
  }
}

export const eligibilityService = new EligibilityService();
