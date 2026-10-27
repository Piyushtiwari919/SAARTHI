import {
  CanonicalOperator,
  ComparisonOperator,
  EvaluationResult,
  OpportunityRule,
  OverallEligibilityStatus,
  RequirementResult,
  RuleEvaluationStatus,
  UserEvidence,
} from './eligibility.types.js';

const ALLOWED_OPERATORS: Set<CanonicalOperator> = new Set([
  'EQ',
  'NE',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'IN',
  'NOT_IN',
]);

const OPERATOR_MAP: Record<string, CanonicalOperator> = {
  EQ: 'EQ',
  NE: 'NE',
  GT: 'GT',
  GTE: 'GTE',
  LT: 'LT',
  LTE: 'LTE',
  IN: 'IN',
  NOT_IN: 'NOT_IN',
  '==': 'EQ',
  '!=': 'NE',
  '>': 'GT',
  '>=': 'GTE',
  '<': 'LT',
  '<=': 'LTE',
};

const CANONICAL_FIELD_ALIASES: Record<string, string> = {
  annual_income: 'annual_family_income',
  family_income: 'annual_family_income',
  gross_annual_income: 'annual_family_income',
  marks: 'percentage',
  minimum_percentage: 'percentage',
  minimum_marks: 'percentage',
  qualifying_marks: 'percentage',
  domicile: 'state',
  domicile_state: 'state',
  state_of_domicile: 'state',
};

export function normalizeFieldName(field: string): string {
  const clean = field.toLowerCase().trim().replace(/[\s-]+/g, '_');
  return CANONICAL_FIELD_ALIASES[clean] || clean;
}

export function normalizeOperator(op: ComparisonOperator): CanonicalOperator | null {
  const upper = op?.toString().trim().toUpperCase();
  const canonical = OPERATOR_MAP[upper] || OPERATOR_MAP[op];
  return canonical && ALLOWED_OPERATORS.has(canonical) ? canonical : null;
}

/**
 * Pure evaluation function checking one rule against user evidence.
 * Does not make DB queries, external API calls, or invoke an LLM.
 */
export function evaluateRule(
  rule: OpportunityRule,
  evidenceInput?: UserEvidence | UserEvidence[]
): RequirementResult {
  const canonicalOp = normalizeOperator(rule.operator);

  // Default base result
  const baseResult: RequirementResult = {
    ruleId: rule.ruleId,
    field: rule.field,
    operator: canonicalOp || 'EQ',
    expectedValue: rule.expectedValue,
    actualValue: null,
    unit: rule.unit,
    status: 'UNKNOWN',
    reason: '',
    source: rule.source
      ? {
          documentId: rule.source.documentId,
          page: rule.source.page,
          evidenceSnippet: rule.source.evidenceSnippet,
        }
      : undefined,
  };

  // 1. Validate operator
  if (!canonicalOp) {
    return {
      ...baseResult,
      status: 'UNKNOWN',
      reason: `Unsupported rule operator: '${rule.operator}'. Must be one of: EQ, NE, GT, GTE, LT, LTE, IN, NOT_IN.`,
    };
  }

  // 2. Validate rule extraction reliability & completeness
  if (rule.expectedValue === undefined || rule.expectedValue === null) {
    return {
      ...baseResult,
      status: 'UNKNOWN',
      reason: `Rule expectation is null or undefined for field '${rule.field}'.`,
    };
  }

  if (rule.extractionStatus === 'NEEDS_REVIEW' || rule.extractionStatus === 'NOT_FOUND') {
    return {
      ...baseResult,
      status: 'UNKNOWN',
      reason: `Rule requirement from source document requires manual review (status: ${rule.extractionStatus}).`,
    };
  }

  // 3. Resolve evidence items
  const evidenceList: UserEvidence[] = Array.isArray(evidenceInput)
    ? evidenceInput
    : evidenceInput
    ? [evidenceInput]
    : [];

  const usableEvidence = evidenceList.filter(
    (e) => e.value !== undefined && e.value !== null && e.status !== 'NOT_FOUND'
  );

  if (usableEvidence.length === 0) {
    return {
      ...baseResult,
      status: 'UNKNOWN',
      reason: `No usable evidence found for required field '${rule.field}'.`,
    };
  }

  // 4. Check for conflicting evidence
  if (usableEvidence.length > 1) {
    const distinctValues = new Set(
      usableEvidence.map((e) =>
        typeof e.value === 'string' ? e.value.trim().toLowerCase() : JSON.stringify(e.value)
      )
    );
    if (distinctValues.size > 1) {
      return {
        ...baseResult,
        status: 'UNKNOWN',
        reason: `Conflicting evidence detected across multiple documents for '${rule.field}'. Manual review required.`,
      };
    }
  }

  const primaryEvidence = usableEvidence[0];
  const actualValue = primaryEvidence.value;

  baseResult.actualValue = actualValue;
  if (primaryEvidence.sourceDocumentId || primaryEvidence.sourcePage) {
    baseResult.evidence = {
      documentId: primaryEvidence.sourceDocumentId,
      page: primaryEvidence.sourcePage,
      evidenceSnippet: primaryEvidence.evidenceSnippet,
    };
  }

  // 5. Check evidence extraction status
  if (primaryEvidence.status === 'NEEDS_REVIEW') {
    return {
      ...baseResult,
      status: 'UNKNOWN',
      reason: `Evidence for '${rule.field}' is flagged for review (e.g. ambiguous date or uncertain extraction).`,
    };
  }

  // 6. Unit & Currency compatibility check
  if (rule.unit && primaryEvidence.unit) {
    const normRuleUnit = rule.unit.trim().toUpperCase();
    const normEvUnit = primaryEvidence.unit.trim().toUpperCase();

    if (
      (normRuleUnit === '%' && normEvUnit === 'CGPA') ||
      (normRuleUnit === 'CGPA' && normEvUnit === '%')
    ) {
      return {
        ...baseResult,
        status: 'UNKNOWN',
        reason: `Cannot convert between CGPA and percentage without a specified institution conversion formula.`,
      };
    }

    if (normRuleUnit !== normEvUnit) {
      return {
        ...baseResult,
        status: 'UNKNOWN',
        reason: `Unit mismatch for '${rule.field}': expected '${rule.unit}', got '${primaryEvidence.unit}'.`,
      };
    }
  }

  // 7. Deterministic evaluation by operator
  return executeOperatorComparison(canonicalOp, rule.expectedValue, actualValue, baseResult);
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const AMBIGUOUS_DATE_PATTERN = /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\d{4}[/]\d{1,2}[/]\d{1,2})$/;

function executeOperatorComparison(
  op: CanonicalOperator,
  expected: unknown,
  actual: unknown,
  context: RequirementResult
): RequirementResult {
  // Date comparisons check
  if (typeof expected === 'string' && typeof actual === 'string') {
    const expTrim = expected.trim();
    const actTrim = actual.trim();

    const isActualAmbiguous = AMBIGUOUS_DATE_PATTERN.test(actTrim) && !ISO_DATE_PATTERN.test(actTrim);
    const isExpectedAmbiguous = AMBIGUOUS_DATE_PATTERN.test(expTrim) && !ISO_DATE_PATTERN.test(expTrim);

    if (isActualAmbiguous || isExpectedAmbiguous) {
      return {
        ...context,
        status: 'UNKNOWN',
        reason: `Ambiguous date format detected ('${isActualAmbiguous ? actual : expected}'). Date comparisons require unambiguous ISO 8601 dates (YYYY-MM-DD).`,
      };
    }

    const isActualIso = ISO_DATE_PATTERN.test(actTrim);
    const isExpectedIso = ISO_DATE_PATTERN.test(expTrim);

    if (isActualIso && isExpectedIso) {
      const timeActual = Date.parse(actTrim);
      const timeExpected = Date.parse(expTrim);

      if (isNaN(timeActual) || isNaN(timeExpected)) {
        return {
          ...context,
          status: 'UNKNOWN',
          reason: `Invalid calendar date in ISO date string. Got expected='${expected}', actual='${actual}'.`,
        };
      }

      let pass = false;
      switch (op) {
        case 'GT':
          pass = timeActual > timeExpected;
          break;
        case 'GTE':
          pass = timeActual >= timeExpected;
          break;
        case 'LT':
          pass = timeActual < timeExpected;
          break;
        case 'LTE':
          pass = timeActual <= timeExpected;
          break;
        case 'EQ':
          pass = timeActual === timeExpected;
          break;
        case 'NE':
          pass = timeActual !== timeExpected;
          break;
        default:
          return {
            ...context,
            status: 'UNKNOWN',
            reason: `Operator '${op}' is not supported for date comparisons.`,
          };
      }

      return {
        ...context,
        status: pass ? 'PASS' : 'FAIL',
        reason: pass
          ? `Date '${actual}' satisfies condition: ${op} '${expected}'.`
          : `Date '${actual}' does not satisfy condition: ${op} '${expected}'.`,
      };
    }
  }

  // Numeric comparisons: GT, GTE, LT, LTE
  if (op === 'GT' || op === 'GTE' || op === 'LT' || op === 'LTE') {
    // Explicitly prevent null, boolean, or empty string from coercing to 0
    if (
      expected === null ||
      actual === null ||
      expected === '' ||
      actual === '' ||
      typeof expected === 'boolean' ||
      typeof actual === 'boolean'
    ) {
      return {
        ...context,
        status: 'UNKNOWN',
        reason: `Numeric comparison operator '${op}' cannot compare null, boolean, or empty values.`,
      };
    }

    const numExpected = Number(expected);
    const numActual = Number(actual);

    if (isNaN(numExpected) || isNaN(numActual)) {
      return {
        ...context,
        status: 'UNKNOWN',
        reason: `Numeric comparison operator '${op}' requires valid numbers. Got expected=${expected}, actual=${actual}.`,
      };
    }

    let pass = false;
    switch (op) {
      case 'GT':
        pass = numActual > numExpected;
        break;
      case 'GTE':
        pass = numActual >= numExpected;
        break;
      case 'LT':
        pass = numActual < numExpected;
        break;
      case 'LTE':
        pass = numActual <= numExpected;
        break;
    }

    return {
      ...context,
      status: pass ? 'PASS' : 'FAIL',
      reason: pass
        ? `Value ${numActual} satisfies condition: ${op} ${numExpected}${context.unit ? ` ${context.unit}` : ''}.`
        : `Value ${numActual} does not satisfy condition: ${op} ${numExpected}${context.unit ? ` ${context.unit}` : ''}.`,
    };
  }

  // List membership operators: IN, NOT_IN
  if (op === 'IN' || op === 'NOT_IN') {
    if (!Array.isArray(expected)) {
      return {
        ...context,
        status: 'UNKNOWN',
        reason: `List operator '${op}' requires expectedValue to be an Array. Got ${typeof expected}.`,
      };
    }

    const normActual = String(actual).trim().toLowerCase();
    const normList = expected.map((item) => String(item).trim().toLowerCase());
    const contains = normList.includes(normActual);

    const pass = op === 'IN' ? contains : !contains;
    return {
      ...context,
      status: pass ? 'PASS' : 'FAIL',
      reason: pass
        ? `Value '${actual}' satisfies list condition ${op} [${expected.join(', ')}].`
        : `Value '${actual}' fails list condition ${op} [${expected.join(', ')}].`,
    };
  }

  // Equality / Inequality operators: EQ, NE
  if (op === 'EQ' || op === 'NE') {
    let equal = false;

    if (
      expected !== null &&
      actual !== null &&
      expected !== '' &&
      actual !== '' &&
      typeof expected !== 'boolean' &&
      typeof actual !== 'boolean'
    ) {
      const numExp = Number(expected);
      const numAct = Number(actual);
      if (!isNaN(numExp) && !isNaN(numAct)) {
        equal = numExp === numAct;
      } else {
        // Conservative string normalization: trim and lowercase
        equal = String(expected).trim().toLowerCase() === String(actual).trim().toLowerCase();
      }
    } else if (typeof expected === 'boolean' || typeof actual === 'boolean') {
      equal = Boolean(expected) === Boolean(actual);
    } else {
      equal = expected === actual;
    }

    const pass = op === 'EQ' ? equal : !equal;
    return {
      ...context,
      status: pass ? 'PASS' : 'FAIL',
      reason: pass
        ? `Value '${actual}' matches requirement ${op} '${expected}'.`
        : `Value '${actual}' does not match requirement ${op} '${expected}'.`,
    };
  }

  return {
    ...context,
    status: 'UNKNOWN',
    reason: `Unhandled operator logic: ${op}.`,
  };
}

/**
 * Aggregates individual requirement evaluations according to mandatory MVP rules:
 * - FAIL if any required rule fails.
 * - UNKNOWN if no rules fail, but at least one required rule is unknown, or no usable rules exist.
 * - PASS if all required rules pass.
 */
export function aggregateEvaluation(
  opportunityId: string,
  rules: OpportunityRule[],
  evidenceList: UserEvidence[],
  opportunityTitle?: string
): EvaluationResult {
  if (!rules || rules.length === 0) {
    return {
      opportunityId,
      opportunityTitle,
      overallStatus: 'UNKNOWN',
      summary: 'No eligibility criteria or requirements are defined for this opportunity.',
      requirements: [],
      evaluatedAt: new Date().toISOString(),
    };
  }

  // Group evidence by normalized field name
  const evidenceByField = new Map<string, UserEvidence[]>();
  for (const ev of evidenceList) {
    const norm = normalizeFieldName(ev.field);
    const current = evidenceByField.get(norm) || [];
    current.push(ev);
    evidenceByField.set(norm, current);
  }

  const requirementResults: RequirementResult[] = [];

  for (const rule of rules) {
    const normField = normalizeFieldName(rule.field);
    const matchedEvidence = evidenceByField.get(normField);
    const res = evaluateRule(rule, matchedEvidence);
    requirementResults.push(res);
  }

  // Determine overall status
  let overallStatus: OverallEligibilityStatus = 'PASS';
  let summary = 'All evaluated eligibility criteria have been satisfied.';

  const requiredResults = requirementResults.filter((_, idx) => {
    const r = rules[idx];
    return r.required !== false; // Default is required
  });

  const hasFail = requiredResults.some((r) => r.status === 'FAIL');
  const hasUnknown = requiredResults.some((r) => r.status === 'UNKNOWN');

  if (hasFail) {
    overallStatus = 'FAIL';
    const failedFields = requiredResults
      .filter((r) => r.status === 'FAIL')
      .map((r) => r.field)
      .join(', ');
    summary = `Applicant does not meet one or more mandatory eligibility requirements: ${failedFields}.`;
  } else if (hasUnknown) {
    overallStatus = 'UNKNOWN';
    const unknownFields = requiredResults
      .filter((r) => r.status === 'UNKNOWN')
      .map((r) => r.field)
      .join(', ');
    summary = `Eligibility could not be conclusively determined. Missing or unverified evidence for: ${unknownFields}.`;
  }

  return {
    opportunityId,
    opportunityTitle,
    overallStatus,
    summary: `${summary} (Note: This is a preliminary automated assessment based on available evidence, not an official government decision).`,
    requirements: requirementResults,
    evaluatedAt: new Date().toISOString(),
  };
}

