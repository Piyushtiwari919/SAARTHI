import { describe, it, expect } from 'vitest';
import {
  evaluateRule,
  aggregateEvaluation,
  normalizeFieldName,
  normalizeOperator,
} from '../src/modules/eligibility/rule-engine.js';
import { OpportunityRule, UserEvidence } from '../src/modules/eligibility/eligibility.types.js';

describe('Eligibility Rule Engine - 22 Comprehensive Test Cases', () => {
  // -------------------------------------------------------------
  // Section A: PASS Conditions (Cases 1-13)
  // -------------------------------------------------------------

  it('1. PASS: Numeric EQ comparison satisfies exact match', () => {
    const rule: OpportunityRule = {
      ruleId: 'r1',
      field: 'current_year',
      operator: 'EQ',
      expectedValue: 2,
    };
    const evidence: UserEvidence = {
      field: 'current_year',
      value: 2,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
    expect(result.actualValue).toBe(2);
  });

  it('2. PASS: String EQ comparison satisfies case-insensitive trimmed match', () => {
    const rule: OpportunityRule = {
      ruleId: 'r2',
      field: 'gender',
      operator: 'EQ',
      expectedValue: 'Female',
    };
    const evidence: UserEvidence = {
      field: 'gender',
      value: ' female ',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
  });

  it('3. PASS: NE comparison satisfies when values differ', () => {
    const rule: OpportunityRule = {
      ruleId: 'r3',
      field: 'caste_category',
      operator: 'NE',
      expectedValue: 'GENERAL',
    };
    const evidence: UserEvidence = {
      field: 'caste_category',
      value: 'OBC',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
  });

  it('4. PASS: GT comparison satisfies when actual is strictly greater', () => {
    const rule: OpportunityRule = {
      ruleId: 'r4',
      field: 'percentage',
      operator: 'GT',
      expectedValue: 75,
    };
    const evidence: UserEvidence = {
      field: 'percentage',
      value: 75.5,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
  });

  it('5. PASS: GTE comparison satisfies on exact boundary', () => {
    const rule: OpportunityRule = {
      ruleId: 'r5',
      field: 'percentage',
      operator: 'GTE',
      expectedValue: 60,
    };
    const evidence: UserEvidence = {
      field: 'percentage',
      value: 60,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
  });

  it('6. PASS: GTE comparison satisfies when strictly greater', () => {
    const rule: OpportunityRule = {
      ruleId: 'r6',
      field: 'percentage',
      operator: 'GTE',
      expectedValue: 60,
    };
    const evidence: UserEvidence = {
      field: 'percentage',
      value: 85,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
  });

  it('7. PASS: LT comparison satisfies when actual is strictly lower', () => {
    const rule: OpportunityRule = {
      ruleId: 'r7',
      field: 'annual_family_income',
      operator: 'LT',
      expectedValue: 500000,
    };
    const evidence: UserEvidence = {
      field: 'annual_family_income',
      value: 499999,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
  });

  it('8. PASS: LTE comparison satisfies on exact boundary', () => {
    const rule: OpportunityRule = {
      ruleId: 'r8',
      field: 'annual_family_income',
      operator: 'LTE',
      expectedValue: 250000,
      unit: 'INR',
    };
    const evidence: UserEvidence = {
      field: 'annual_family_income',
      value: 250000,
      unit: 'INR',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
  });

  it('9. PASS: LTE comparison satisfies when strictly lower', () => {
    const rule: OpportunityRule = {
      ruleId: 'r9',
      field: 'annual_family_income',
      operator: 'LTE',
      expectedValue: 250000,
    };
    const evidence: UserEvidence = {
      field: 'annual_family_income',
      value: 120000,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
  });

  it('10. PASS: IN comparison satisfies when actual exists in array', () => {
    const rule: OpportunityRule = {
      ruleId: 'r10',
      field: 'state',
      operator: 'IN',
      expectedValue: ['Maharashtra', 'Gujarat', 'Karnataka'],
    };
    const evidence: UserEvidence = {
      field: 'state',
      value: 'maharashtra',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
  });

  it('11. PASS: NOT_IN comparison satisfies when actual is not in array', () => {
    const rule: OpportunityRule = {
      ruleId: 'r11',
      field: 'state',
      operator: 'NOT_IN',
      expectedValue: ['Delhi', 'Punjab'],
    };
    const evidence: UserEvidence = {
      field: 'state',
      value: 'Maharashtra',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
  });

  it('12. PASS: Standard operator aliases (==, !=, >=, <=) resolve correctly', () => {
    expect(normalizeOperator('==')).toBe('EQ');
    expect(normalizeOperator('!=')).toBe('NE');
    expect(normalizeOperator('>=')).toBe('GTE');
    expect(normalizeOperator('<=')).toBe('LTE');

    const rule: OpportunityRule = {
      ruleId: 'r12',
      field: 'percentage',
      operator: '>=',
      expectedValue: 70,
    };
    const evidence: UserEvidence = {
      field: 'percentage',
      value: 75,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
    expect(result.operator).toBe('GTE');
  });

  it('13. PASS: Canonical field name aliases are mapped properly', () => {
    expect(normalizeFieldName('annual_income')).toBe('annual_family_income');
    expect(normalizeFieldName('family-income')).toBe('annual_family_income');
    expect(normalizeFieldName('minimum_marks')).toBe('percentage');
    expect(normalizeFieldName('domicile_state')).toBe('state');

    const rule: OpportunityRule = {
      ruleId: 'r13',
      field: 'annual_income',
      operator: 'LTE',
      expectedValue: 300000,
    };
    const result = aggregateEvaluation(
      'opp1',
      [rule],
      [{ field: 'annual_family_income', value: 200000, status: 'EXTRACTED' }]
    );
    expect(result.overallStatus).toBe('PASS');
  });

  // -------------------------------------------------------------
  // Section B: FAIL Conditions (Cases 14-17)
  // -------------------------------------------------------------

  it('14. FAIL: GTE comparison fails when actual is below threshold', () => {
    const rule: OpportunityRule = {
      ruleId: 'r14',
      field: 'percentage',
      operator: 'GTE',
      expectedValue: 80,
    };
    const evidence: UserEvidence = {
      field: 'percentage',
      value: 78.4,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('FAIL');
  });

  it('15. FAIL: LTE comparison fails when actual exceeds ceiling', () => {
    const rule: OpportunityRule = {
      ruleId: 'r15',
      field: 'annual_family_income',
      operator: 'LTE',
      expectedValue: 200000,
    };
    const evidence: UserEvidence = {
      field: 'annual_family_income',
      value: 200001,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('FAIL');
  });

  it('16. FAIL: EQ fails on string mismatch', () => {
    const rule: OpportunityRule = {
      ruleId: 'r16',
      field: 'gender',
      operator: 'EQ',
      expectedValue: 'Female',
    };
    const evidence: UserEvidence = {
      field: 'gender',
      value: 'Male',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('FAIL');
  });

  it('17. FAIL: NOT_IN fails when value is present in disallowed list', () => {
    const rule: OpportunityRule = {
      ruleId: 'r17',
      field: 'state',
      operator: 'NOT_IN',
      expectedValue: ['Goa', 'Sikkim'],
    };
    const evidence: UserEvidence = {
      field: 'state',
      value: 'Goa',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('FAIL');
  });

  // -------------------------------------------------------------
  // Section C: UNKNOWN Conditions (Cases 18-22)
  // -------------------------------------------------------------

  it('18. UNKNOWN: Missing evidence returns UNKNOWN status with clear explanation', () => {
    const rule: OpportunityRule = {
      ruleId: 'r18',
      field: 'family_income',
      operator: 'LTE',
      expectedValue: 250000,
    };
    const result = evaluateRule(rule, undefined);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('No usable evidence found');
  });

  it('19. UNKNOWN: Evidence flagged as NEEDS_REVIEW (ambiguous date / uncertain OCR)', () => {
    const rule: OpportunityRule = {
      ruleId: 'r19',
      field: 'issue_date',
      operator: 'GTE',
      expectedValue: '2025-01-01',
    };
    const evidence: UserEvidence = {
      field: 'issue_date',
      value: '05/06/2025',
      status: 'NEEDS_REVIEW',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('flagged for review');
  });

  it('20. UNKNOWN: Unit mismatch flags review instead of false PASS/FAIL', () => {
    const rule: OpportunityRule = {
      ruleId: 'r20',
      field: 'annual_family_income',
      operator: 'LTE',
      expectedValue: 5000,
      unit: 'USD',
    };
    const evidence: UserEvidence = {
      field: 'annual_family_income',
      value: 400000,
      unit: 'INR',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('Unit mismatch');
  });

  it('21. UNKNOWN: Conflicting evidence across documents flags UNKNOWN for human review', () => {
    const rule: OpportunityRule = {
      ruleId: 'r21',
      field: 'annual_family_income',
      operator: 'LTE',
      expectedValue: 250000,
    };
    const evidence1: UserEvidence = {
      field: 'annual_family_income',
      value: 180000,
      sourceDocumentId: 'doc1',
      status: 'EXTRACTED',
    };
    const evidence2: UserEvidence = {
      field: 'annual_family_income',
      value: 320000,
      sourceDocumentId: 'doc2',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, [evidence1, evidence2]);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('Conflicting evidence detected');
  });

  it('22. UNKNOWN: Invalid operator or non-numeric comparison handles gracefully', () => {
    const rule: OpportunityRule = {
      ruleId: 'r22',
      field: 'percentage',
      operator: 'INVALID_OP' as any,
      expectedValue: 80,
    };
    const evidence: UserEvidence = {
      field: 'percentage',
      value: 85,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('Unsupported rule operator');
  });

  // -------------------------------------------------------------
  // Section D: Multi-Rule Aggregation Logic
  // -------------------------------------------------------------

  it('Aggregates to FAIL if any required rule fails, even if others pass', () => {
    const rules: OpportunityRule[] = [
      { ruleId: 'r1', field: 'percentage', operator: 'GTE', expectedValue: 80, required: true },
      { ruleId: 'r2', field: 'annual_family_income', operator: 'LTE', expectedValue: 200000, required: true },
    ];
    const evidence: UserEvidence[] = [
      { field: 'percentage', value: 85, status: 'EXTRACTED' }, // PASS
      { field: 'annual_family_income', value: 300000, status: 'EXTRACTED' }, // FAIL
    ];
    const result = aggregateEvaluation('opp1', rules, evidence);
    expect(result.overallStatus).toBe('FAIL');
    expect(result.summary).toContain('does not meet one or more mandatory eligibility requirements');
  });

  it('Aggregates to UNKNOWN if no rules fail, but at least one required rule is missing/unknown', () => {
    const rules: OpportunityRule[] = [
      { ruleId: 'r1', field: 'percentage', operator: 'GTE', expectedValue: 80, required: true },
      { ruleId: 'r2', field: 'state', operator: 'EQ', expectedValue: 'Maharashtra', required: true },
    ];
    const evidence: UserEvidence[] = [
      { field: 'percentage', value: 85, status: 'EXTRACTED' }, // PASS
      // state evidence is missing
    ];
    const result = aggregateEvaluation('opp1', rules, evidence);
    expect(result.overallStatus).toBe('UNKNOWN');
    expect(result.summary).toContain('Missing or unverified evidence');
  });

  it('Aggregates to PASS when all required rules pass', () => {
    const rules: OpportunityRule[] = [
      { ruleId: 'r1', field: 'percentage', operator: 'GTE', expectedValue: 80, required: true },
      { ruleId: 'r2', field: 'annual_family_income', operator: 'LTE', expectedValue: 400000, required: true },
      { ruleId: 'r3', field: 'state', operator: 'EQ', expectedValue: 'Maharashtra', required: true },
    ];
    const evidence: UserEvidence[] = [
      { field: 'percentage', value: 92, status: 'EXTRACTED' },
      { field: 'annual_family_income', value: 180000, status: 'EXTRACTED' },
      { field: 'state', value: 'Maharashtra', status: 'EXTRACTED' },
    ];
    const result = aggregateEvaluation('opp1', rules, evidence);
    expect(result.overallStatus).toBe('PASS');
    expect(result.summary).toContain('All evaluated eligibility criteria have been satisfied');
  });
});

