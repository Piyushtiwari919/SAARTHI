import { ApiService, USE_MOCKS, simulateLatency } from './api.ts';
import type { Opportunity } from '../types/opportunity.ts';
import { mockOpportunities } from '../mocks/data/opportunities.mock.ts';

class OpportunityService {
  private opportunities: Opportunity[] = [...mockOpportunities];

  public async getOpportunities(params?: {
    category?: string;
    search?: string;
  }): Promise<Opportunity[]> {
    if (USE_MOCKS) {
      await simulateLatency(200);
      let list = [...this.opportunities];
      if (params?.category) {
        list = list.filter((o) => o.category === params.category);
      }
      if (params?.search) {
        const query = params.search.toLowerCase();
        list = list.filter(
          (o) =>
            o.title.toLowerCase().includes(query) ||
            o.provider.toLowerCase().includes(query) ||
            o.tags.some((t) => t.toLowerCase().includes(query))
        );
      }
      return list;
    }

    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.set('category', params.category);
    if (params?.search) queryParams.set('search', params.search);

    return ApiService.request<Opportunity[]>(
      `/api/opportunities?${queryParams.toString()}`
    );
  }

  public async getOpportunityById(id: string): Promise<Opportunity | null> {
    if (USE_MOCKS) {
      await simulateLatency(150);
      return this.opportunities.find((o) => o.id === id) || null;
    }
    return ApiService.request<Opportunity>(`/api/opportunities/${id}`);
  }

  public async getFeaturedOpportunities(): Promise<Opportunity[]> {
    if (USE_MOCKS) {
      await simulateLatency(150);
      return this.opportunities.filter((o) => o.isFeatured);
    }
    return ApiService.request<Opportunity[]>('/api/opportunities/featured');
  }
}

export const opportunityService = new OpportunityService();
