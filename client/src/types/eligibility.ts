export type EligibilityStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_VERIFIED';

export type ComparisonOperator =
  | '>='
  | '<='
  | '=='
  | '!='
  | 'IN'
  | 'NOT_IN'
  | 'CONTAINS'
  | 'EQ'
  | 'NE'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE';

export interface EligibilityRequirement {
  id: string;
  field: string;
  fieldLabel: string;
  operator: ComparisonOperator;
  expectedValue: string | number | boolean | string[] | unknown;
  actualValue?: string | number | boolean | string[] | null | unknown;
  unit?: string;
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
