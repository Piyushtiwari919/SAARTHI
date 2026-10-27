# Saarthi — Data-Driven Eligibility Rule Engine Specification

## 1. Architectural Placement: Why the Rule Engine Belongs in Node.js

A core architectural tenet of Saarthi is the strict separation between **document information extraction** and **application business decisions**:

- **FastAPI AI Service**: Specializes in OCR, PDF parsing, table extraction, and text understanding. It returns extracted text and candidate criteria with confidence scores and page citations. It is stateless and does not own user accounts or business rules.
- **Node.js Express Backend**: Owns user identity, document access control, database persistence, and **eligibility decisions**.
- **Deterministic vs. Generative**: Eligibility decisions are **never** delegated to an LLM or prompt. Natural language models can hallucinate, produce non-deterministic answers, or overlook strict numeric and date boundaries. Saarthi enforces a generic, data-driven, deterministic rule engine executing pure mathematical and logical comparisons in the Node.js application tier.

---

## 2. Consuming FastAPI Extraction Data (FastAPI Adapter)

The FastAPI service exposes structured Pydantic models for `INCOME_CERTIFICATE` and `SCHOLARSHIP_NOTICE`. The Node.js backend converts these outputs into canonical formats via `fastapi-adapter.ts`:

### A. Extracted Personal Evidence
FastAPI returns `extracted_fields` containing:
- `field`: string (e.g. `annual_income`, `category`, `certificate_date`)
- `value`: number | string
- `currency`: string (e.g. `INR`)
- `status`: `EXTRACTED` | `NOT_FOUND` | `NEEDS_REVIEW`
- `source_page`: number
- `evidence_snippet`: string
- `confidence`: float (0.0 to 1.0)

**Node.js Adapter (`mapFastApiExtractionToEvidence`)** maps this to `UserEvidence`, attaching `sourceDocumentId` to maintain end-to-end evidence provenance.

### B. Extracted Scholarship Rules
FastAPI returns `eligibility_rules` containing:
- `field`: string
- `operator`: `EQ` | `NE` | `GT` | `GTE` | `LT` | `LTE` | `IN` | `NOT_IN`
- `expected_value`: number | string | list
- `unit`: string (e.g. `INR`, `%`)
- `source_page`: number
- `evidence_snippet`: string
- `status`: `EXTRACTED` | `NEEDS_REVIEW`

**Node.js Adapter (`mapFastApiRulesToOpportunityRules`)** maps this to `OpportunityRule`, generating unique rule IDs and tracking extraction reliability.

---

## 3. Canonical Rule & Evidence Schemas

### A. Opportunity Rule (`OpportunityRule`)
```typescript
export interface OpportunityRule {
  ruleId: string;
  field: string;
  operator: CanonicalOperator; // 'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'NOT_IN'
  expectedValue: unknown;
  unit?: string;
  required?: boolean;
  source?: {
    documentId?: string;
    page?: number;
    evidenceSnippet?: string;
  };
  extractionStatus?: 'EXTRACTED' | 'NOT_FOUND' | 'NEEDS_REVIEW';
}
```

### B. User Evidence (`UserEvidence`)
```typescript
export interface UserEvidence {
  field: string;
  value: unknown;
  unit?: string;
  status?: 'EXTRACTED' | 'NOT_FOUND' | 'NEEDS_REVIEW';
  sourceDocumentId?: string;
  sourcePage?: number;
  confidence?: number;
  verifiedByUser?: boolean;
  evidenceSnippet?: string;
}
```

---

## 4. Supported Operators & Normalization

The rule engine strictly enforces an explicit operator allowlist:
- `EQ`: Equal (case-insensitive and trimmed for strings; numeric equality for numbers)
- `NE`: Not equal
- `GT`: Strictly greater than
- `GTE`: Greater than or equal to
- `LT`: Strictly less than
- `LTE`: Less than or equal to
- `IN`: Value is a member of the expected array
- `NOT_IN`: Value is not a member of the expected array

### Operator Aliases
- `==` maps to `EQ`
- `!=` maps to `NE`
- `>=` maps to `GTE`
- `<=` maps to `LTE`

### Field Name Aliases
- `annual_income`, `family_income`, `gross_annual_income` $\rightarrow$ `annual_family_income`
- `minimum_marks`, `qualifying_marks`, `marks` $\rightarrow$ `percentage`
- `domicile`, `domicile_state` $\rightarrow$ `state`

---

## 5. PASS, FAIL, and UNKNOWN Semantics

Three-valued logic prevents false positives and false negatives:

### `PASS`
- All inputs are present and valid.
- Units match (or are compatible).
- The deterministic comparison succeeds.

### `FAIL`
- The rule and user evidence are present and valid.
- The condition conclusively fails (e.g. income ₹3,00,000 exceeds ceiling of ₹2,50,000).

### `UNKNOWN`
- User attribute is missing.
- Extraction status is `NOT_FOUND` or flagged as `NEEDS_REVIEW`.
- Ambiguous date format detected (e.g. `05/06/2025` with slash separators where day vs month is ambiguous).
- Unit mismatch (e.g. `INR` vs `USD`, or attempting to compare `%` against `CGPA` without an official conversion formula).
- Conflicting evidence across multiple documents.
- Unsupported operator or non-numeric operands for numeric comparisons.
- **Safety Guarantee**: `null`, `undefined`, `false`, or empty strings are **never** coerced to `0`.

---

## 6. Overall Result Aggregation

Aggregation evaluates all criteria according to the following deterministic precedence:
1. **`FAIL`**: If **any** required criterion fails, overall status is **`FAIL`**.
2. **`UNKNOWN`**: If no rules fail, but at least one required criterion is `UNKNOWN`, overall status is **`UNKNOWN`**.
3. **`PASS`**: Overall status is **`PASS`** **only** when all required criteria evaluate to `PASS`.

*Disclaimer*: Every evaluation response explicitly includes a note stating that this is a preliminary automated assessment based on available evidence, not an official government eligibility decision.

---

## 7. Evidence Provenance & Conflict Handling

- **Audit Trail**: Every evaluated requirement retains links to `source` (scholarship notice document and page) and `evidence` (applicant document and page) with verbatim snippet text quotes.
- **Conflicting Evidence**: If an applicant has two uploaded documents reporting differing values for the same attribute (e.g. Income Certificate A says ₹1,80,000, while Income Certificate B says ₹3,20,000), the engine does not arbitrarily guess or average the numbers. It flags the requirement as **`UNKNOWN`** with a reason explaining the conflict for human review.

---

## 8. Authenticated API Endpoints

All endpoints require standard user authentication (`Authorization: Bearer <token>` or HttpOnly cookie). Multi-tenant isolation guarantees that users can only evaluate or retrieve their own records.

### `POST /api/v1/eligibility/evaluate`
Evaluates an opportunity for the authenticated applicant.
- **Request Body**:
```json
{
  "opportunityId": "opp_css_01",
  "additionalEvidence": []
}
```
- **Response 200 OK**:
```json
{
  "opportunityId": "opp_css_01",
  "opportunityTitle": "Central Sector Scheme of Scholarship",
  "overallStatus": "PASS",
  "confidenceScore": 95,
  "evaluatedAt": "2026-10-27T16:50:00.000Z",
  "summary": "All evaluated eligibility criteria have been satisfied.",
  "requirements": [
    {
      "id": "crit_1",
      "field": "percentage",
      "fieldLabel": "Percentage",
      "operator": "GTE",
      "expectedValue": 80,
      "actualValue": 82.5,
      "unit": "%",
      "status": "PASS",
      "explanation": "Value 82.5 satisfies condition: GTE 80 %.",
      "sourceDocumentId": "doc_notice_01",
      "sourcePage": 2,
      "isMandatory": true
    }
  ],
  "missingDocuments": [],
  "actionItems": [
    {
      "id": "act_apply_opp_css_01",
      "title": "Submit application for Central Sector Scheme",
      "description": "All criteria verified. Complete your application on scholarships.gov.in.",
      "type": "APPLY_NOW",
      "targetOpportunityId": "opp_css_01",
      "isCompleted": false,
      "priority": "HIGH"
    }
  ]
}
```

### `GET /api/v1/eligibility/:resultId`
Retrieves a previously persisted evaluation result by its result ID. Enforces strict ownership authorization (returns 403 if accessed by another user).

### `GET /api/v1/eligibility/opportunity/:opportunityId`
Evaluates or retrieves the cached evaluation result for a specific opportunity.

### `GET /api/v1/eligibility/all`
Returns all opportunity evaluation summaries for the authenticated applicant.

### `GET /api/v1/eligibility/action-items`
Aggregates prioritized action items (`UPLOAD_DOCUMENT`, `VERIFY_ATTRIBUTE`, `APPLY_NOW`) across all evaluated opportunities.

---

## 9. Test Execution

Run the backend test suite:
```bash
cd backend/node-api
npm test
```
This runs the full Vitest suite covering:
- **`tests/rule-engine.test.ts`**: All 22 mandatory edge cases (numeric comparisons, safe null handling, ambiguous dates, unit mismatches, conflicting evidence, operator validation, and aggregations).
- **`tests/modules/eligibility/eligibility.service.test.ts`**: Service orchestration, missing document computation, action item creation, and 403 cross-tenant isolation.
- **`tests/modules/eligibility/eligibility.routes.test.ts`**: HTTP endpoints, token authentication, parameter validation, and JSON responses.

---

## 10. Implemented vs. Planned Work

### Implemented (Days 5–6 Milestone)
- Pure deterministic rule evaluator (`rule-engine.ts`) with three-valued logic.
- Safe date comparison (ISO 8601 vs ambiguous slash dates).
- Safe numeric checks preventing null/empty/boolean coercion to 0.
- Unit mismatch and CGPA conversion guards.
- Multi-document conflicting evidence detection.
- Mongoose persistence models (`OpportunityModel`, `EligibilityResultModel`).
- Authenticated REST APIs (`/api/v1/eligibility/evaluate`, `/:resultId`, `/all`, `/action-items`).
- Action-item generation and missing-document detection.
- FastAPI response-to-evidence adapter (`fastapi-adapter.ts`).
- Full Vitest test suites.

### Planned (Future Milestones)
- Asynchronous BullMQ background worker to automatically trigger FastAPI extraction upon document upload.
- Automated extraction result writing from FastAPI worker to MongoDB `extractedAttributes`.
- RAG question-answering over document source chunks.

