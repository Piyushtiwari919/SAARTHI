import { ApiService, USE_MOCKS, simulateLatency } from './api.ts';
import type { OpportunityEligibility, ActionItem } from '../types/eligibility.ts';
import { mockEligibilityResults } from '../mocks/data/eligibility.mock.ts';

class EligibilityService {
  public async getEligibilityForOpportunity(
    opportunityId: string
  ): Promise<OpportunityEligibility | null> {
    if (USE_MOCKS) {
      await simulateLatency(200);
      return mockEligibilityResults[opportunityId] || null;
    }
    return ApiService.request<OpportunityEligibility>(
      `/api/eligibility/opportunity/${opportunityId}`
    );
  }

  public async getAllEligibilitySummaries(): Promise<OpportunityEligibility[]> {
    if (USE_MOCKS) {
      await simulateLatency(250);
      return Object.values(mockEligibilityResults);
    }
    return ApiService.request<OpportunityEligibility[]>('/api/eligibility/all');
  }

  public async getActionItems(): Promise<ActionItem[]> {
    if (USE_MOCKS) {
      await simulateLatency(150);
      const allActions: ActionItem[] = [];
      for (const res of Object.values(mockEligibilityResults)) {
        allActions.push(...res.actionItems);
      }
      return allActions;
    }
    return ApiService.request<ActionItem[]>('/api/eligibility/action-items');
  }
}

export const eligibilityService = new EligibilityService();
