export type CanonicalOperator =
  | 'EQ'
  | 'NE'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'IN'
  | 'NOT_IN';

export type ComparisonOperator = CanonicalOperator | '==' | '!=' | '>' | '>=' | '<' | '<=';

export type RuleEvaluationStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

export type OverallEligibilityStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

export type ExtractionStatus = 'EXTRACTED' | 'NOT_FOUND' | 'NEEDS_REVIEW';

export interface RuleProvenance {
  documentId?: string;
  page?: number;
  evidenceSnippet?: string;
}

export interface OpportunityRule {
  ruleId: string;
  field: string;
  operator: ComparisonOperator;
  expectedValue: unknown;
  unit?: string;
  required?: boolean;
  source?: RuleProvenance;
  extractionStatus?: ExtractionStatus;
}

export interface UserEvidence {
  field: string;
  value: unknown;
  unit?: string;
  status?: ExtractionStatus;
  sourceDocumentId?: string;
  sourcePage?: number;
  confidence?: number;
  verifiedByUser?: boolean;
  evidenceSnippet?: string;
}

export interface RequirementResult {
  ruleId: string;
  field: string;
  operator: CanonicalOperator;
  expectedValue: unknown;
  actualValue: unknown | null;
  unit?: string;
  status: RuleEvaluationStatus;
  reason: string;
  source?: {
    documentId?: string;
    page?: number;
    evidenceSnippet?: string;
  };
  evidence?: {
    documentId?: string;
    page?: number;
    evidenceSnippet?: string;
  };
}

export interface EvaluationResult {
  opportunityId: string;
  opportunityTitle?: string;
  overallStatus: OverallEligibilityStatus;
  summary: string;
  requirements: RequirementResult[];
  missingDocuments?: string[];
  evaluatedAt: string;
}

