import { OpportunityRule, UserEvidence, ExtractionStatus, CanonicalOperator } from './eligibility.types.js';
import { normalizeOperator } from './rule-engine.js';

export interface FastApiExtractedField {
  field: string;
  value?: unknown;
  currency?: string;
  status: 'EXTRACTED' | 'NOT_FOUND' | 'NEEDS_REVIEW';
  source_page?: number;
  evidence_snippet?: string;
  confidence?: number;
}

export interface FastApiEligibilityRule {
  field: string;
  operator: string;
  expected_value: unknown;
  unit?: string;
  source_page?: number;
  evidence_snippet?: string;
  status?: 'EXTRACTED' | 'NOT_FOUND' | 'NEEDS_REVIEW';
}

export interface FastApiExtractionResponse {
  request_id: string;
  document_type: string;
  processing_status: 'COMPLETED' | 'NEEDS_REVIEW' | 'FAILED';
  page_count: number;
  extracted_fields: FastApiExtractedField[];
  eligibility_rules?: FastApiEligibilityRule[];
  warnings?: string[];
  provider_used?: string;
  schema_version?: string;
}

/**
 * Adapter converting FastAPI Python extraction responses to Node.js UserEvidence objects.
 * Preserves source page attribution, evidence text quotes, and extraction reliability statuses.
 */
export function mapFastApiExtractionToEvidence(
  response: FastApiExtractionResponse,
  documentId: string
): UserEvidence[] {
  if (!response || !Array.isArray(response.extracted_fields)) {
    return [];
  }

  return response.extracted_fields.map((field) => ({
    field: field.field,
    value: field.value,
    unit: field.currency || undefined,
    status: (field.status as ExtractionStatus) || 'EXTRACTED',
    sourceDocumentId: documentId,
    sourcePage: field.source_page,
    evidenceSnippet: field.evidence_snippet,
    confidence: field.confidence,
  }));
}

/**
 * Adapter converting FastAPI extracted eligibility criteria from scholarship notices
 * into executable OpportunityRule objects evaluated by the deterministic rule engine.
 */
export function mapFastApiRulesToOpportunityRules(
  rules: FastApiEligibilityRule[],
  documentId: string
): OpportunityRule[] {
  if (!rules || !Array.isArray(rules)) {
    return [];
  }

  return rules.map((r, index) => {
    const canonicalOp = (normalizeOperator(r.operator as any) || 'EQ') as CanonicalOperator;
    return {
      ruleId: `rule_${r.field.toLowerCase()}_${index + 1}`,
      field: r.field,
      operator: canonicalOp,
      expectedValue: r.expected_value,
      unit: r.unit,
      required: true,
      source: {
        documentId,
        page: r.source_page,
        evidenceSnippet: r.evidence_snippet,
      },
      extractionStatus: (r.status as ExtractionStatus) || 'EXTRACTED',
    };
  });
}

