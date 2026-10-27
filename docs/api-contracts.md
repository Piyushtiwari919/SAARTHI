# Saarthi — API Contracts & Integration Guide

The Node.js application backend provides RESTful JSON endpoints.
All endpoints are available under both `/api/v1/` (versioned) and `/api/` (frontend compatible aliases).

---

## 1. Health Checks

### `GET /health` / `GET /api/v1/health`
Checks application backend status.
- **Access**: Public
- **Response 200 OK**:
```json
{
  "status": "UP",
  "service": "saarthi-node-api",
  "environment": "development",
  "timestamp": "2026-10-27T16:00:00.000Z",
  "uptime": 124.5
}
```

---

## 2. Authentication

### `POST /api/v1/auth/signup`
Registers a new applicant account.
- **Access**: Public
- **Rate Limit**: 10 requests / 15 minutes per IP
- **Request Body**:
```json
{
  "fullName": "Piyush Sharma",
  "email": "piyush@example.com",
  "password": "SecurePassword123!",
  "institution": "VNIT Nagpur",
  "course": "B.Tech Computer Science",
  "agreeToPrivacy": true
}
```
- **Response 201 Created**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOi...",
  "user": {
    "id": "673f8a...",
    "fullName": "Piyush Sharma",
    "email": "piyush@example.com",
    "academicDetails": {
      "institution": "VNIT Nagpur",
      "course": "B.Tech Computer Science"
    }
  }
}
```

### `POST /api/v1/auth/login`
Authenticates user and returns JWT token + sets HttpOnly cookie.
- **Access**: Public
- **Request Body**:
```json
{
  "email": "piyush@example.com",
  "password": "SecurePassword123!"
}
```
- **Response 200 OK**: Same shape as signup response.

### `GET /api/v1/auth/me`
Fetches authenticated user profile.
- **Access**: Authenticated (`Authorization: Bearer <token>` or HttpOnly cookie)
- **Response 200 OK**: Returns `UserProfile` object.

### `POST /api/v1/auth/logout`
Clears authentication cookie.
- **Access**: Public
- **Response 200 OK**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 3. Documents

### `POST /api/v1/documents` or `/api/v1/documents/upload`
Uploads a document for storage and AI analysis.
- **Access**: Authenticated
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `file`: Binary file (PDF, PNG, JPG; max 10MB)
  - `documentType`: One of `INCOME_CERTIFICATE`, `SCHOLARSHIP_NOTICE`, `MARKSHEET`, `BONAFIDE_CERTIFICATE`, `DOMICILE_CERTIFICATE`, `CASTE_CERTIFICATE`, `IDENTITY_PROOF`, `BANK_DOCUMENT`, `ADMISSION_LETTER`, `FEE_RECEIPT`, `OTHER`
  - `customTitle`: Optional string
  - `isSensitive`: Optional boolean (default true)
- **Response 201 Created**:
```json
{
  "id": "673f91...",
  "ownerId": "673f8a...",
  "fileName": "Income_Cert_2025.pdf",
  "documentType": "INCOME_CERTIFICATE",
  "fileSizeBytes": 154200,
  "mimeType": "application/pdf",
  "status": "UPLOADED",
  "progressPercent": 0,
  "statusMessage": "Uploaded to secure private storage",
  "createdAt": "2026-10-27T16:15:00.000Z"
}
```

### `GET /api/v1/documents`
Lists all documents belonging to the authenticated user.
- **Access**: Authenticated
- **Response 200 OK**: Array of document objects.

### `GET /api/v1/documents/:id`
Retrieves document metadata and extracted attributes.
- **Access**: Authenticated (Owner only)

### `GET /api/v1/documents/:id/status`
Lightweight polling endpoint for document processing status.
- **Access**: Authenticated (Owner only)
- **Response 200 OK**:
```json
{
  "status": "READY",
  "progressPercent": 100,
  "statusMessage": "Analysis complete"
}
```

### `GET /api/v1/documents/:id/content`
Streams the raw document binary from private storage.
- **Access**: Authenticated (Owner only)
- **Response Headers**: `Content-Type`, `Content-Disposition: inline; filename="..."`

### `DELETE /api/v1/documents/:id`
Permanently deletes document binary from storage and record from MongoDB.
- **Access**: Authenticated (Owner only)

---

## 4. Eligibility

### `GET /api/v1/eligibility/opportunity/:opportunityId`
Evaluates or retrieves eligibility for a given opportunity.
- **Access**: Authenticated
- **Response 200 OK**:
```json
{
  "opportunityId": "opp_css_01",
  "opportunityTitle": "Central Sector Scheme of Scholarship",
  "overallStatus": "PASS",
  "confidenceScore": 95,
  "evaluatedAt": "2026-10-27T16:20:00.000Z",
  "summary": "All evaluated eligibility criteria have been satisfied.",
  "requirements": [
    {
      "id": "crit_1",
      "field": "percentage",
      "fieldLabel": "Percentage",
      "operator": "GTE",
      "expectedValue": 80,
      "actualValue": 84.5,
      "unit": "%",
      "status": "PASS",
      "explanation": "Value 84.5 satisfies condition: GTE 80 %.",
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

### `POST /api/v1/eligibility/evaluate/:opportunityId`
Runs on-demand evaluation with optional additional evidence payload.

### `GET /api/v1/eligibility/all`
Returns eligibility summaries across all active opportunities.

### `GET /api/v1/eligibility/action-items`
Aggregates prioritized action items across all opportunities.

