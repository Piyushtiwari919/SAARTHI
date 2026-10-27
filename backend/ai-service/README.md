# Saarthi AI Document Extraction Service

FastAPI-based document processing and structured information extraction service for **Saarthi — AI-Powered Document Navigator**.

---

## 1. Service Responsibilities

The AI service forms the Python boundary for document intelligence:
- **PDF & Image Loading**: Parses multi-page PDF documents, preserves page boundaries and 1-based page numbers.
- **OCR Fallback**: Detects scanned pages lacking selectable text, routing them to Tesseract OCR when available.
- **Structured Extraction**: Extracts validated attributes from unstructured source text for supported categories:
  - `INCOME_CERTIFICATE` (annual family income, currency, issue date, issuer, certificate number).
  - `SCHOLARSHIP_NOTICE` (title, issuer, application deadline, required documents, structured eligibility rules).
- **Date Ambiguity & Missing Field Normalization**: Normalizes dates only when unambiguous; marks ambiguous dates (`NEEDS_REVIEW`) and missing values (`NOT_FOUND`) without fabricating information.
- **Service-to-Service Security**: Internal endpoint protected by shared secret token (`X-Internal-Service-Token`) using constant-time comparison.
- **Strict Privacy Defaults**: Does not transmit personal documents externally by default; keeps extracted text in-memory only.

---

## 2. Architecture & Service Boundary

```
React Frontend
      │
      ▼
Node.js + Express API
      │
      ▼
Private Object Storage + MongoDB
      │
      ▼ (Future: BullMQ Worker)
Node.js Background Worker
      │
      │ Internal HTTP POST (multipart/form-data)
      │ Header: X-Internal-Service-Token: <secret>
      ▼
FastAPI AI Service (backend/ai-service)
      │
      ├─► Step 1: File signature & bounded size validation (PDF/JPEG/PNG, max 10MB)
      ├─► Step 2: Page extraction via PyMuPDF (max 10 pages) / OCR via Tesseract
      ├─► Step 3: Local deterministic extraction or Google Gemini 2.5 Flash
      ├─► Step 4: Strict Pydantic output validation
      └─► Return ExtractionResponse JSON
```

> **Separation of Concerns**:
> - Node.js owns public user APIs, authentication, MongoDB persistence, private object storage, and job queueing.
> - FastAPI is internal, stateless, and owns document extraction and AI models.
> - Frontend does **not** call FastAPI directly.

---

## 3. Folder Structure

```
backend/ai-service/
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI application factory & error handlers
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py               # Pydantic Settings with masked credentials
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── health.py           # GET /health
│   │       └── extraction.py       # POST /internal/v1/documents/extract
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── extraction.py           # Pydantic models (Enums, ExtractedField, Rule, Response)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── document_loader.py      # PyMuPDF PDF parser and image dispatcher
│   │   ├── ocr_service.py          # Tesseract OCR wrapper with availability detection
│   │   └── extraction_service.py   # Pipeline orchestration service
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py                 # Abstract BaseExtractionProvider interface
│   │   ├── local_extractor.py      # Deterministic regex and rule-based extractor
│   │   └── gemini_extractor.py     # Official google-genai LLM extractor with timeouts
│   └── utils/
│       ├── __init__.py
│       └── file_validation.py      # Bounded reads, magic bytes, PDF integrity, safe tempfile
├── tests/
│   ├── __init__.py
│   ├── conftest.py                 # Fixtures, in-memory synthetic PDF/image generators
│   ├── test_health.py              # Health route verification
│   ├── test_file_validation.py     # Magic bytes, size limits, empty files, temp cleanup
│   ├── test_document_loader.py     # Page extraction, OCR routing, missing OCR handling
│   ├── test_extraction.py          # Field extraction, date ambiguity, scholarship rules
│   ├── test_extraction_api.py      # Auth, HTTP status codes, mocked LLM failure & timeout
│   └── verify_live_service.py      # End-to-end live server subprocess integration test
├── .env.example                    # Template environment variables
├── pyproject.toml                  # Python package configuration and dependencies
└── README.md                       # Service documentation
```

---

## 4. Python Version & Environment Setup

- **Recommended Python**: **Python 3.12** (`>=3.12`)
- **Package Manager**: `uv` or `pip`

### Step 1: Create Virtual Environment with Python 3.12

In Windows PowerShell:
```powershell
cd backend/ai-service
uv venv --python 3.12
.\.venv\Scripts\activate
```

Alternatively using standard Python:
```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\activate
```

### Step 2: Install Dependencies

Using `uv`:
```powershell
uv pip install -e ".[dev]"
```

Or using standard `pip`:
```powershell
pip install -e ".[dev]"
```

---

## 5. Environment Variables

Create `.env` inside `backend/ai-service/`:

```ini
# Environment
ENVIRONMENT=development

# Service-to-service auth token between Node.js worker and FastAPI
INTERNAL_SERVICE_TOKEN=your_secure_random_internal_token_here

# AI Provider: "local" (default) or "gemini"
AI_PROVIDER=local

# Google Gemini Configuration (required only if AI_PROVIDER=gemini)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
PROVIDER_TIMEOUT_SECONDS=30.0

# Document Upload Limits
MAX_UPLOAD_BYTES=10485760    # 10 MB limit
MAX_PDF_PAGES=10            # Page count ceiling

# OCR Configuration
OCR_ENABLED=true
# Optional custom Tesseract path on Windows:
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

---

## 6. How to Install and Configure OCR on Windows

Optical Character Recognition is handled by `pytesseract` communicating with the Tesseract binary:

1. Download the Windows installer from UB-Mannheim:
   https://github.com/UB-Mannheim/tesseract/wiki
2. Run the installer (default path: `C:\Program Files\Tesseract-OCR\tesseract.exe`).
3. Add `C:\Program Files\Tesseract-OCR` to your Windows System `PATH`, or set `TESSERACT_CMD` in `.env`:
   ```ini
   TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
   ```
4. If Tesseract is not installed, the service explicitly distinguishes text-based documents from scanned ones and returns `503 OCR_ENGINE_UNAVAILABLE` rather than silently failing.

---

## 7. Running the Service Locally

Start Uvicorn in Windows PowerShell:

```powershell
cd backend/ai-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 8. Testing

### Run Pytest Suite

```powershell
cd backend/ai-service
.\.venv\Scripts\pytest.exe -v
```

All 27 tests run deterministically against in-memory synthetic fixtures without requiring live Gemini API keys or external network calls.

### Run Live Server Verification

```powershell
cd backend/ai-service
.\.venv\Scripts\python.exe tests/verify_live_service.py
```

---

## 9. API Specification

### Health Check

- **URL**: `GET /health`
- **Authentication**: None
- **Response** (`200 OK`):
```json
{
  "status": "ok",
  "service": "saarthi-ai-service",
  "version": "1.0.0"
}
```

### Document Extraction

- **URL**: `POST /internal/v1/documents/extract`
- **Authentication**: Header `X-Internal-Service-Token: <token>`
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `file`: Uploaded file (`.pdf`, `.jpg`, `.jpeg`, `.png`, max 10 MB)
  - `document_type`: `INCOME_CERTIFICATE` or `SCHOLARSHIP_NOTICE`

#### Example cURL Request (PowerShell)

```powershell
curl.exe -X POST "http://127.0.0.1:8000/internal/v1/documents/extract" `
  -H "X-Internal-Service-Token: your_secure_random_internal_token_here" `
  -F "document_type=INCOME_CERTIFICATE" `
  -F "file=@sample_income_certificate.pdf;type=application/pdf"
```

#### Example Response (Income Certificate)

```json
{
  "request_id": "8d3e9114-1e0f-4886-905c-dfa053c847e2",
  "document_type": "INCOME_CERTIFICATE",
  "processing_status": "COMPLETED",
  "page_count": 1,
  "extracted_fields": [
    {
      "field": "annual_family_income",
      "value": 180000,
      "currency": "INR",
      "status": "EXTRACTED",
      "source_page": 1,
      "evidence_snippet": "Annual Family Income: Rs. 1,80,000/- per annum",
      "confidence": 0.92
    },
    {
      "field": "currency",
      "value": "INR",
      "currency": null,
      "status": "EXTRACTED",
      "source_page": 1,
      "evidence_snippet": "Annual Family Income: Rs. 1,80,000/- per annum",
      "confidence": 0.95
    },
    {
      "field": "issue_date",
      "value": "2024-08-25",
      "currency": null,
      "status": "EXTRACTED",
      "source_page": 1,
      "evidence_snippet": "Date of Issue: 25/08/2024",
      "confidence": 0.90
    },
    {
      "field": "issuer",
      "value": "Office of the Tahsildar, Haveli",
      "currency": null,
      "status": "EXTRACTED",
      "source_page": 1,
      "evidence_snippet": "Office of the Tahsildar, Haveli",
      "confidence": 0.90
    },
    {
      "field": "certificate_number",
      "value": "INC/2024/78219",
      "currency": null,
      "status": "EXTRACTED",
      "source_page": 1,
      "evidence_snippet": "Certificate No: INC/2024/78219",
      "confidence": 0.94
    }
  ],
  "eligibility_rules": null,
  "warnings": [],
  "provider_used": "local",
  "schema_version": "1.0.0"
}
```

#### Example Response (Scholarship Notice)

```json
{
  "request_id": "b9fc857e-72bc-442c-aef6-928efad73a1b",
  "document_type": "SCHOLARSHIP_NOTICE",
  "processing_status": "COMPLETED",
  "page_count": 2,
  "extracted_fields": [
    {
      "field": "opportunity_title",
      "value": "NATIONAL MERIT SCHOLARSHIP SCHEME 2024-25",
      "currency": null,
      "status": "EXTRACTED",
      "source_page": 1,
      "evidence_snippet": "NATIONAL MERIT SCHOLARSHIP SCHEME 2024-25",
      "confidence": 0.92
    },
    {
      "field": "issuer",
      "value": "MINISTRY OF EDUCATION",
      "currency": null,
      "status": "EXTRACTED",
      "source_page": 1,
      "evidence_snippet": "MINISTRY OF EDUCATION",
      "confidence": 0.88
    },
    {
      "field": "application_deadline",
      "value": "2024-10-31",
      "currency": null,
      "status": "EXTRACTED",
      "source_page": 1,
      "evidence_snippet": "Application Deadline: 31/10/2024",
      "confidence": 0.92
    },
    {
      "field": "required_documents",
      "value": [
        "Income Certificate",
        "Marksheet",
        "Domicile Certificate"
      ],
      "currency": null,
      "status": "EXTRACTED",
      "source_page": 1,
      "evidence_snippet": "Required Documents: Income Certificate, Marksheet",
      "confidence": 0.90
    }
  ],
  "eligibility_rules": [
    {
      "field": "annual_income",
      "operator": "LTE",
      "expected_value": 250000,
      "unit": "INR",
      "source_page": 2,
      "evidence_snippet": "Annual family income must not exceed Rs. 2,50,000/-",
      "status": "EXTRACTED"
    },
    {
      "field": "minimum_percentage",
      "operator": "GTE",
      "expected_value": 60.0,
      "unit": "%",
      "source_page": 2,
      "evidence_snippet": "Candidate must secure minimum 60% marks",
      "status": "EXTRACTED"
    }
  ],
  "warnings": [],
  "provider_used": "local",
  "schema_version": "1.0.0"
}
```

---

## 10. Standard Error Codes

All errors return uniform JSON matching `ErrorResponse`:

```json
{
  "error_code": "UNAUTHORIZED_INTERNAL_CALL",
  "message": "Missing or invalid internal service token",
  "details": null
}
```

| HTTP Status | Error Code | Description |
|---|---|---|
| `401 Unauthorized` | `UNAUTHORIZED_INTERNAL_CALL` | Missing or invalid `X-Internal-Service-Token` header. |
| `400 Bad Request` | `EMPTY_FILE` | Uploaded document contains 0 bytes. |
| `413 Payload Too Large` | `FILE_TOO_LARGE` | Document exceeds `MAX_UPLOAD_BYTES` (10 MB). |
| `415 Unsupported Media Type` | `UNSUPPORTED_FILE_TYPE` | Signature is not valid PDF (`%PDF-`), JPEG, or PNG. |
| `422 Unprocessable Entity` | `UNSUPPORTED_DOCUMENT_TYPE` | Category is not `INCOME_CERTIFICATE` or `SCHOLARSHIP_NOTICE`. |
| `422 Unprocessable Entity` | `INVALID_DOCUMENT` | Corrupted PDF, password-protected, exceeds max pages, or no usable text. |
| `422 Unprocessable Entity` | `EXTRACTION_FAILED` | Extraction failed or OCR execution crashed. |
| `502 Bad Gateway` | `INVALID_EXTRACTION_OUTPUT` | Provider returned malformed JSON or failed schema validation. |
| `503 Service Unavailable` | `OCR_ENGINE_UNAVAILABLE` | Scanned page or image requires OCR, but Tesseract is not installed. |
| `504 Gateway Timeout` | `PROVIDER_TIMEOUT` | Provider exceeded `PROVIDER_TIMEOUT_SECONDS`. |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Unexpected server error. |

---

## 11. Privacy & Security Defaults

1. **Local by Default**: The default provider is `AI_PROVIDER=local`. Documents are processed on-premise using deterministic algorithms.
2. **Consent & Minimization**: External LLM processing (`AI_PROVIDER=gemini`) requires explicit environment configuration and API key setup.
3. **No Credential Logging**: Secret tokens and API keys are masked in `Settings.__repr__` and never printed to logs.
4. **No Document Logging**: Uploaded file contents, applicant names, and raw document text are never logged in application logs.
5. **Ephemerality**: Files are read in bounded in-memory chunks. Temporary files are managed via context managers and removed on both success and failure. No persistent disk writes occur.

---

## 12. Integration Guide for Node.js Developer

In the next phase, the Node.js background worker (BullMQ) will call this endpoint:

```typescript
import axios from 'axios';
import FormData from 'form-data';

async function callExtractionService(fileBuffer: Buffer, fileName: string, documentType: string) {
  const form = new FormData();
  form.append('document_type', documentType);
  form.append('file', fileBuffer, { filename: fileName });

  const response = await axios.post('http://127.0.0.1:8000/internal/v1/documents/extract', form, {
    headers: {
      ...form.getHeaders(),
      'X-Internal-Service-Token': process.env.AI_SERVICE_TOKEN,
    },
    timeout: 35000,
  });

  return response.data; // Matches ExtractionResponse schema
}
```

The Node.js worker persists the resulting extracted fields and updates the MongoDB document status (`READY`, `NEEDS_REVIEW`, or `FAILED`).

---

## 13. Features Out of Scope (Next Phases)

The following capabilities are deliberately deferred to future development phases:
- BullMQ worker implementation & Redis job queue management.
- MongoDB document persistence from FastAPI.
- Vector embeddings and vector database indexing (Pinecone / Chroma).
- RAG question-answering over uploaded document collections.
- Dynamic eligibility evaluation engine.
- Government certificate digital signature / cryptographic validation.

