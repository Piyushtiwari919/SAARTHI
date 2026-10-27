export type OpportunityType = 'SCHOLARSHIP' | 'FELLOWSHIP' | 'GRANT' | 'TUITION_WAIVER' | 'EXCHANGE';

export interface OpportunityCriteria {
  id: string;
  field: string;
  label: string;
  ruleDescription: string;
  mandatory: boolean;
}

export interface Opportunity {
  id: string;
  title: string;
  slug: string;
  provider: string; // e.g. Ministry of Education, State Gov, Foundation
  providerType: 'GOVERNMENT' | 'CORPORATE_CSR' | 'UNIVERSITY' | 'PRIVATE_FOUNDATION';
  description: string;
  amount: number; // in INR
  amountDescription: string; // e.g. "₹50,000 / year"
  deadline: string; // ISO date
  applicationUrl: string;
  category: OpportunityType;
  academicLevel: 'UNDERGRADUATE' | 'POSTGRADUATE' | 'DOCTORAL' | 'ALL';
  criteriaSummary: OpportunityCriteria[];
  requiredDocumentTypes: string[];
  tags: string[];
  isFeatured?: boolean;
  createdAt: string;
  updatedAt: string;
}
