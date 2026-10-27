export type EligibilityStatus = 'PASS' | 'FAIL' | 'NOT_VERIFIED';

export type ComparisonOperator = '>=' | '<=' | '==' | '!=' | 'IN' | 'NOT_IN' | 'CONTAINS';

export interface EligibilityRequirement {
  id: string;
  field: string;
  fieldLabel: string;
  operator: ComparisonOperator;
  expectedValue: string | number | boolean | string[];
  actualValue?: string | number | boolean | string[] | null;
  status: EligibilityStatus;
  explanation: string;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  sourcePage?: number;
  isMandatory: boolean;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  type: 'UPLOAD_DOCUMENT' | 'VERIFY_ATTRIBUTE' | 'APPLY_NOW';
  targetDocumentType?: string;
  targetOpportunityId?: string;
  isCompleted: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
}

export interface OpportunityEligibility {
  opportunityId: string;
  opportunityTitle: string;
  overallStatus: EligibilityStatus;
  confidenceScore: number; // 0 to 100
  evaluatedAt: string;
  summary: string;
  requirements: EligibilityRequirement[];
  missingDocuments: string[];
  actionItems: ActionItem[];
}
