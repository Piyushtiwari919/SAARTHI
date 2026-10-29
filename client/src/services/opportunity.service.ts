import { ApiService, USE_MOCKS, simulateLatency } from './api.ts';
import type { Opportunity, OpportunityCriteria } from '../types/opportunity.ts';
import { mockOpportunities } from '../mocks/data/opportunities.mock.ts';

function formatFieldLabel(field?: string): string {
  if (!field) return 'Criteria';
  return field
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeOpportunity(raw: any): Opportunity {
  if (!raw) return raw;

  const id = String(raw.id || raw.opportunityId || raw._id || '');
  const title = raw.title || 'Untitled Opportunity';
  const slug = raw.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const provider = raw.provider || 'Government of India';
  const providerType = raw.providerType || 'GOVERNMENT';
  const description = raw.description || '';

  let numAmount = 0;
  if (typeof raw.amount === 'number') {
    numAmount = raw.amount;
  } else if (typeof raw.amount === 'string') {
    const parsed = parseFloat(raw.amount.replace(/[^0-9.]/g, ''));
    numAmount = isNaN(parsed) ? 0 : parsed;
  }

  const amountDescription =
    raw.amountDescription || (numAmount > 0 ? `₹${numAmount.toLocaleString('en-IN')}` : 'Financial Assistance');

  const deadline = raw.deadline
    ? new Date(raw.deadline).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const rules = Array.isArray(raw.rules) ? raw.rules : [];
  const criteriaSummary: OpportunityCriteria[] =
    Array.isArray(raw.criteriaSummary) && raw.criteriaSummary.length > 0
      ? raw.criteriaSummary
      : rules.map((r: any, idx: number) => ({
          id: String(r.ruleId || `rule_${idx}`),
          field: r.field || `field_${idx}`,
          label: formatFieldLabel(r.field),
          ruleDescription: `${formatFieldLabel(r.field)} must be ${r.operator || '=='} ${r.expectedValue}${r.unit ? ` ${r.unit}` : ''}`,
          mandatory: r.required !== false,
        }));

  return {
    id,
    title,
    slug,
    provider,
    providerType,
    description,
    amount: numAmount,
    amountDescription,
    deadline,
    applicationUrl: raw.applicationUrl || 'https://scholarships.gov.in',
    category: raw.category || 'SCHOLARSHIP',
    academicLevel: raw.academicLevel || 'UNDERGRADUATE',
    criteriaSummary,
    requiredDocumentTypes: Array.isArray(raw.requiredDocumentTypes) ? raw.requiredDocumentTypes : [],
    tags: Array.isArray(raw.tags) ? raw.tags : ['Scholarship', 'Education Support'],
    isFeatured: Boolean(raw.isFeatured),
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date().toISOString(),
  };
}

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
      return list.map(normalizeOpportunity);
    }

    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.set('category', params.category);
    if (params?.search) queryParams.set('search', params.search);

    const rawList = await ApiService.request<any[]>(
      `/api/opportunities?${queryParams.toString()}`
    );
    return Array.isArray(rawList) ? rawList.map(normalizeOpportunity) : [];
  }

  public async getOpportunityById(id: string): Promise<Opportunity | null> {
    if (USE_MOCKS) {
      await simulateLatency(150);
      const found = this.opportunities.find((o) => o.id === id);
      return found ? normalizeOpportunity(found) : null;
    }
    const raw = await ApiService.request<any>(`/api/opportunities/${id}`);
    return raw ? normalizeOpportunity(raw) : null;
  }

  public async getFeaturedOpportunities(): Promise<Opportunity[]> {
    if (USE_MOCKS) {
      await simulateLatency(150);
      return this.opportunities.filter((o) => o.isFeatured).map(normalizeOpportunity);
    }
    const rawList = await ApiService.request<any[]>('/api/opportunities/featured');
    return Array.isArray(rawList) ? rawList.map(normalizeOpportunity) : [];
  }
}

export const opportunityService = new OpportunityService();
