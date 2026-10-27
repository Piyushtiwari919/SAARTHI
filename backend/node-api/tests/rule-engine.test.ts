import { describe, it, expect } from 'vitest';
import {
  evaluateRule,
  aggregateEvaluation,
  normalizeFieldName,
  normalizeOperator,
} from '../src/modules/eligibility/rule-engine.js';
import { OpportunityRule, UserEvidence } from '../src/modules/eligibility/eligibility.types.js';

describe('Eligibility Rule Engine - 22 Minimum Mandatory Test Cases (Section 12)', () => {
  // 1. Numeric comparison returns PASS
  it('1. Numeric comparison returns PASS when criterion is satisfied', () => {
    const rule: OpportunityRule = {
      ruleId: 'r1',
      field: 'percentage',
      operator: 'GTE',
      expectedValue: 60,
    };
    const evidence: UserEvidence = {
      field: 'percentage',
      value: 75.5,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
    expect(result.actualValue).toBe(75.5);
  });

  // 2. Numeric comparison returns FAIL
  it('2. Numeric comparison returns FAIL when criterion is not satisfied', () => {
    const rule: OpportunityRule = {
      ruleId: 'r2',
      field: 'annual_family_income',
      operator: 'LTE',
      expectedValue: 250000,
    };
    const evidence: UserEvidence = {
      field: 'annual_family_income',
      value: 300000,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('FAIL');
    expect(result.actualValue).toBe(300000);
  });

  // 3. Missing field returns UNKNOWN
  it('3. Missing field returns UNKNOWN with clear explanatory message', () => {
    const rule: OpportunityRule = {
      ruleId: 'r3',
      field: 'caste_category',
      operator: 'EQ',
      expectedValue: 'OBC',
    };
    const result = evaluateRule(rule, undefined);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('No usable evidence found for required field');
  });

  // 4. Null value returns UNKNOWN
  it('4. Null value in evidence returns UNKNOWN (never coerces null to zero)', () => {
    const rule: OpportunityRule = {
      ruleId: 'r4',
      field: 'annual_family_income',
      operator: 'LTE',
      expectedValue: 250000,
    };
    const evidence: UserEvidence = {
      field: 'annual_family_income',
      value: null,
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('UNKNOWN');
    expect(result.actualValue).toBeNull();
  });

  // 5. NOT_FOUND extraction status returns UNKNOWN
  it('5. NOT_FOUND extraction status returns UNKNOWN', () => {
    const rule: OpportunityRule = {
      ruleId: 'r5',
      field: 'gross_annual_income',
      operator: 'LTE',
      expectedValue: 200000,
    };
    const evidence: UserEvidence = {
      field: 'gross_annual_income',
      value: undefined,
      status: 'NOT_FOUND',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('UNKNOWN');
  });

  // 6. NEEDS_REVIEW extraction status returns UNKNOWN
  it('6. NEEDS_REVIEW extraction status returns UNKNOWN rather than guessing', () => {
    const rule: OpportunityRule = {
      ruleId: 'r6',
      field: 'certificate_issue_date',
      operator: 'GTE',
      expectedValue: '2024-04-01',
    };
    const evidence: UserEvidence = {
      field: 'certificate_issue_date',
      value: '2024-04-10',
      status: 'NEEDS_REVIEW',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('flagged for review');
  });

  // 7. Unsupported operator returns UNKNOWN or a documented validation error
  it('7. Unsupported operator returns UNKNOWN without crashing', () => {
    const rule: OpportunityRule = {
      ruleId: 'r7',
      field: 'percentage',
      operator: 'UNKNOWN_OP' as any,
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

  // 8. Numeric type mismatch is handled safely
  it('8. Numeric type mismatch is handled safely (non-numeric string returns UNKNOWN)', () => {
    const rule: OpportunityRule = {
      ruleId: 'r8',
      field: 'annual_family_income',
      operator: 'LTE',
      expectedValue: 300000,
    };
    const evidence: UserEvidence = {
      field: 'annual_family_income',
      value: 'three_lakhs_rupees',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('requires valid numbers');
  });

  // 9. Unit mismatch returns UNKNOWN
  it('9. Unit mismatch returns UNKNOWN (e.g. INR vs USD, or % vs CGPA)', () => {
    const rule: OpportunityRule = {
      ruleId: 'r9',
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

    // Also CGPA vs percentage conversion guard
    const cgpaRule: OpportunityRule = {
      ruleId: 'r9_cgpa',
      field: 'percentage',
      operator: 'GTE',
      expectedValue: 75,
      unit: '%',
    };
    const cgpaEvidence: UserEvidence = {
      field: 'percentage',
      value: 8.2,
      unit: 'CGPA',
      status: 'EXTRACTED',
    };
    const cgpaResult = evaluateRule(cgpaRule, cgpaEvidence);
    expect(cgpaResult.status).toBe('UNKNOWN');
    expect(cgpaResult.reason).toContain('Cannot convert between CGPA and percentage');
  });

  // 10. Date comparison handles normalized ISO dates
  it('10. Date comparison handles normalized ISO dates (YYYY-MM-DD)', () => {
    const rule: OpportunityRule = {
      ruleId: 'r10',
      field: 'issue_date',
      operator: 'GTE',
      expectedValue: '2024-01-01',
    };
    const evidencePass: UserEvidence = {
      field: 'issue_date',
      value: '2024-05-15',
      status: 'EXTRACTED',
    };
    const resPass = evaluateRule(rule, evidencePass);
    expect(resPass.status).toBe('PASS');

    const evidenceFail: UserEvidence = {
      field: 'issue_date',
      value: '2023-12-31',
      status: 'EXTRACTED',
    };
    const resFail = evaluateRule(rule, evidenceFail);
    expect(resFail.status).toBe('FAIL');
  });

  // 11. Ambiguous dates return UNKNOWN
  it('11. Ambiguous dates return UNKNOWN (e.g. 05/06/2025 with unclear day/month)', () => {
    const rule: OpportunityRule = {
      ruleId: 'r11',
      field: 'issue_date',
      operator: 'GTE',
      expectedValue: '2025-01-01',
    };
    const evidence: UserEvidence = {
      field: 'issue_date',
      value: '05/06/2025', // Slash formatted date is ambiguous
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('Ambiguous date format detected');
  });

  // 12. EQ string comparison follows documented normalization policy
  it('12. EQ string comparison follows documented normalization policy (case-insensitive & trimmed)', () => {
    const rule: OpportunityRule = {
      ruleId: 'r12',
      field: 'state',
      operator: 'EQ',
      expectedValue: 'Maharashtra',
    };
    const evidence: UserEvidence = {
      field: 'state',
      value: '  maharashtra  ',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');

    const evidenceMismatch: UserEvidence = {
      field: 'state',
      value: 'Gujarat',
      status: 'EXTRACTED',
    };
    expect(evaluateRule(rule, evidenceMismatch).status).toBe('FAIL');
  });

  // 13. IN works with a valid list operand
  it('13. IN works with a valid list operand', () => {
    const rule: OpportunityRule = {
      ruleId: 'r13',
      field: 'caste_category',
      operator: 'IN',
      expectedValue: ['SC', 'ST', 'OBC', 'EWS'],
    };
    const evidence: UserEvidence = {
      field: 'caste_category',
      value: 'OBC',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');
  });

  // 14. NOT_IN works with a valid list operand
  it('14. NOT_IN works with a valid list operand', () => {
    const rule: OpportunityRule = {
      ruleId: 'r14',
      field: 'state',
      operator: 'NOT_IN',
      expectedValue: ['Goa', 'Sikkim'],
    };
    const evidence: UserEvidence = {
      field: 'state',
      value: 'Karnataka',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('PASS');

    const failEvidence: UserEvidence = {
      field: 'state',
      value: 'Goa',
      status: 'EXTRACTED',
    };
    expect(evaluateRule(rule, failEvidence).status).toBe('FAIL');
  });

  // 15. Malformed rules cannot execute arbitrary expressions
  it('15. Malformed rules cannot execute arbitrary expressions (pure evaluation, no eval)', () => {
    const rule: OpportunityRule = {
      ruleId: 'r15',
      field: 'percentage',
      operator: 'EQ',
      expectedValue: "process.exit(1) || 90; require('fs')",
    };
    const evidence: UserEvidence = {
      field: 'percentage',
      value: 90,
      status: 'EXTRACTED',
    };
    // Evaluates safely as a literal string equality without invoking eval or code execution
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('FAIL');
  });

  // 16. Conflicting evidence returns UNKNOWN
  it('16. Conflicting evidence across documents returns UNKNOWN for human review', () => {
    const rule: OpportunityRule = {
      ruleId: 'r16',
      field: 'annual_family_income',
      operator: 'LTE',
      expectedValue: 250000,
    };
    const doc1Evidence: UserEvidence = {
      field: 'annual_family_income',
      value: 180000,
      sourceDocumentId: 'doc_1',
      status: 'EXTRACTED',
    };
    const doc2Evidence: UserEvidence = {
      field: 'annual_family_income',
      value: 350000,
      sourceDocumentId: 'doc_2',
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, [doc1Evidence, doc2Evidence]);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('Conflicting evidence detected across multiple documents');
  });

  // 17. Missing source evidence is handled according to the documented policy
  it('17. Missing source evidence is handled according to policy (returns UNKNOWN)', () => {
    const rule: OpportunityRule = {
      ruleId: 'r17',
      field: 'bonafide_status',
      operator: 'EQ',
      expectedValue: 'Active',
    };
    const result = evaluateRule(rule, []);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('No usable evidence found');
  });

  // 18. Overall aggregation returns PASS when all required rules pass
  it('18. Overall aggregation returns PASS when all required rules pass', () => {
    const rules: OpportunityRule[] = [
      { ruleId: 'r18_1', field: 'percentage', operator: 'GTE', expectedValue: 75, required: true },
      { ruleId: 'r18_2', field: 'annual_family_income', operator: 'LTE', expectedValue: 500000, required: true },
    ];
    const evidence: UserEvidence[] = [
      { field: 'percentage', value: 82, status: 'EXTRACTED' },
      { field: 'annual_family_income', value: 240000, status: 'EXTRACTED' },
    ];
    const result = aggregateEvaluation('opp_18', rules, evidence);
    expect(result.overallStatus).toBe('PASS');
    expect(result.summary).toContain('All evaluated eligibility criteria have been satisfied');
  });

  // 19. Overall aggregation returns FAIL when a required, usable rule fails
  it('19. Overall aggregation returns FAIL when a required, usable rule fails', () => {
    const rules: OpportunityRule[] = [
      { ruleId: 'r19_1', field: 'percentage', operator: 'GTE', expectedValue: 80, required: true },
      { ruleId: 'r19_2', field: 'annual_family_income', operator: 'LTE', expectedValue: 200000, required: true },
    ];
    const evidence: UserEvidence[] = [
      { field: 'percentage', value: 85, status: 'EXTRACTED' }, // PASS
      { field: 'annual_family_income', value: 250000, status: 'EXTRACTED' }, // FAIL
    ];
    const result = aggregateEvaluation('opp_19', rules, evidence);
    expect(result.overallStatus).toBe('FAIL');
    expect(result.summary).toContain('does not meet one or more mandatory eligibility requirements');
  });

  // 20. Overall aggregation returns UNKNOWN when required evidence is incomplete
  it('20. Overall aggregation returns UNKNOWN when required evidence is incomplete', () => {
    const rules: OpportunityRule[] = [
      { ruleId: 'r20_1', field: 'percentage', operator: 'GTE', expectedValue: 80, required: true },
      { ruleId: 'r20_2', field: 'state', operator: 'EQ', expectedValue: 'Maharashtra', required: true },
    ];
    const evidence: UserEvidence[] = [
      { field: 'percentage', value: 85, status: 'EXTRACTED' },
      // State is missing
    ];
    const result = aggregateEvaluation('opp_20', rules, evidence);
    expect(result.overallStatus).toBe('UNKNOWN');
    expect(result.summary).toContain('Eligibility could not be conclusively determined');
  });

  // 21. Overall aggregation returns UNKNOWN when no usable rules exist
  it('21. Overall aggregation returns UNKNOWN when no usable rules exist', () => {
    const result = aggregateEvaluation('opp_empty', [], []);
    expect(result.overallStatus).toBe('UNKNOWN');
    expect(result.summary).toContain('No eligibility criteria or requirements are defined');
  });

  // 22. An invalid or unapproved extracted requirement does not generate a false result
  it('22. An unapproved extracted requirement (NEEDS_REVIEW) does not generate a false result', () => {
    const rule: OpportunityRule = {
      ruleId: 'r22',
      field: 'annual_family_income',
      operator: 'LTE',
      expectedValue: 250000,
      extractionStatus: 'NEEDS_REVIEW', // Unverified rule extraction
    };
    const evidence: UserEvidence = {
      field: 'annual_family_income',
      value: 150000, // Would otherwise pass
      status: 'EXTRACTED',
    };
    const result = evaluateRule(rule, evidence);
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('requires manual review');
  });
});
