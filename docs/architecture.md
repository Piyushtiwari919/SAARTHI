# Saarthi — Architecture & System Design

## 1. High-Level Architecture

Saarthi is an AI-powered document navigator and analyzer designed to assist students and applicants in verifying opportunity eligibility, organizing confidential documents, and identifying actionable requirements.

```
+-------------------------------------------------------------+
|                      React + TypeScript                     |
|                   Frontend Web Application                  |
+-------------------------------------------------------------+
                              |
                     HTTPS / REST / JSON
                              v
+-------------------------------------------------------------+
|                Node.js + Express API Backend                |
|                    (backend/node-api)                       |
|                                                             |
|  * Authentication & Session (JWT + HttpOnly Cookies)        |
|  * Document Upload Validation & Magic Byte Security         |
|  * Data-Driven Deterministic Eligibility Rule Engine        |
|  * User Management & Application Workflows                  |
+-------------------------------------------------------------+
         |                                 |
         | Mongoose                        | Storage Provider
         v                                 v
+------------------+             +-------------------+
|  MongoDB 7.0     |             |  Private Storage  |
|  Persistent Data |             | (Local FS / S3)   |
|  & Metadata      |             +-------------------+
+------------------+
         |
         | Internal HTTP Request
         v
+-------------------------------------------------------------+
|                  Python + FastAPI AI Service                |
|                     (backend/ai-service)                    |
|                                                             |
|  * PDF Text Extraction (PyMuPDF)                            |
|  * OCR for Scanned Documents / Images (Tesseract / EasyOCR) |
|  * Structured Attribute Extraction                          |
|  * Source Evidence & Page Attribution                       |
+-------------------------------------------------------------+
                              |
                     Future Pipeline
                              v
                +----------------------------+
                | Redis 7.0 + BullMQ Worker  |
                | Background Task Processor  |
                +----------------------------+
```

---

## 2. Separation of Responsibilities

### A. Node.js Application Backend (`backend/node-api`)
- **Public Gateway**: Exposes all public API contracts (`/api/v1/...` and `/api/...`).
- **Identity & Authorization**: Owns user registration, bcrypt password hashing, JWT creation/verification, and resource-level authorization checks.
- **Document Management**: Handles upload streaming (up to 10 MB), magic byte verification, storage abstraction (local disk or S3), and deletion synchronization.
- **Eligibility Decision Engine**: Owns the evaluation of opportunity criteria against applicant evidence. Operates deterministically without calling LLMs or hardcoding scholarship-specific rules.

### B. Python FastAPI AI Service (`backend/ai-service`)
- **Document Ingestion**: Extracts text, tables, and visual cues from PDFs and images.
- **OCR Engine**: Performs optical character recognition on scanned documents.
- **Structured Extraction**: Extracts key attributes (annual family income, certificate number, validity dates, scholarship criteria) with confidence ratings and source page citations.
- **Stateless Boundary**: Does not persist user sessions, passwords, or make eligibility decisions.

### C. Persistent Storage Layer
- **MongoDB**: The authoritative source of truth for users, document metadata, extracted attributes, opportunities, and historical eligibility evaluation results.
- **Private Object Storage**: Raw PDF and image binaries are stored under opaque UUID keys with restricted filesystem permissions or private S3 buckets. Files are never publicly exposed.

---

## 3. Data-Driven Eligibility Rule Engine

### A. Three-Valued Logic
Eligibility decisions cannot always be reduced to binary boolean logic due to real-world ambiguity in government documents. Saarthi enforces strict three-valued logic:

1. **`PASS`**: All mandatory criteria are conclusively satisfied by verified evidence with matching units and compatible dates.
2. **`FAIL`**: At least one mandatory criterion explicitly contradicts the user's evidence (e.g. income exceeds ceiling, required reservation category does not match).
3. **`UNKNOWN`**: Missing evidence, ambiguous date formats (e.g. `05/06/2025` without clear DD/MM vs MM/DD), unit mismatches (e.g. INR vs USD), or conflicting attributes across multiple uploaded documents.

### B. Canonical Operators & Normalization
The engine normalizes operators and fields to standard canonical forms:
- Comparison operators: `EQ`, `NE`, `GT`, `GTE`, `LT`, `LTE`, `IN`, `NOT_IN`.
- Aliases: `==` -> `EQ`, `!=` -> `NE`, `>=` -> `GTE`, `<=` -> `LTE`.
- Field aliasing: `annual_income` / `family_income` -> `annual_family_income`; `minimum_marks` -> `percentage`; `domicile_state` -> `state`.

### C. Aggregation Rules
- If **any** mandatory rule evaluates to `FAIL`, overall eligibility is **`FAIL`**.
- If no rules fail, but at least one mandatory rule evaluates to **`UNKNOWN`**, overall eligibility is **`UNKNOWN`**.
- Overall eligibility is **`PASS`** **only** when all mandatory rules evaluate to `PASS`.

