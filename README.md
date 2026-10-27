# Saarthi — AI-Powered Document Navigator & Eligibility Analyzer

Saarthi is an AI-powered document navigator and opportunity eligibility analyzer designed for students and applicants. It helps users organize personal and government documents, automatically extract structured attributes, verify eligibility requirements using a deterministic rule engine, and uncover missing or ambiguous documentation.

---

## Architecture Overview

```
Saarthi/
  client/                  # Frontend (React + TypeScript + Vite + Tailwind CSS)
  backend/
    node-api/              # Main Application Backend (Node.js + Express + TypeScript + Mongoose)
    ai-service/            # Document Extraction Service (Python 3.11+ + FastAPI + PyMuPDF)
  infra/
    docker-compose.yml     # Local Infrastructure (MongoDB 7.0 + Redis 7.0)
  docs/
    architecture.md        # System design, data flow, separation of concerns
    api-contracts.md       # Full REST API specifications and schemas
    privacy-and-storage.md # Security, magic byte verification, private storage
```

---

## Quick Start (Local Development)

### 1. Start Infrastructure (MongoDB & Redis)
Ensure Docker is installed and running:
```bash
docker compose -f infra/docker-compose.yml up -d
```
MongoDB will be available at `127.0.0.1:27017` and Redis at `127.0.0.1:6379`.

---

### 2. Run the Node.js Application Backend (`backend/node-api`)
```bash
cd backend/node-api
cp .env.example .env
npm install
npm run build
npm run dev
```
The API server will be available at `http://localhost:5000`.

**Testing Node API:**
```bash
npm test
```
Runs 45 unit and integration tests covering the 22-case eligibility rule engine, magic byte detection, storage traversal protection, authentication, and HTTP routes.

---

### 3. Run the FastAPI AI Document Extraction Service (`backend/ai-service`)
Requires Python 3.11 or higher:
```bash
cd backend/ai-service
cp .env.example .env
pip install -e .
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The AI service will be available at `http://127.0.0.1:8000`. OpenAPI docs are accessible at `http://127.0.0.1:8000/docs`.

**Testing AI Service:**
```bash
pytest
```
Runs 27 test cases covering PDF extraction, OCR fallback, income certificate processing, and scholarship notice parsing.

---

### 4. Run the React Frontend (`client`)
```bash
cd client
npm install
npm run dev
```
The frontend web application will be available at `http://localhost:5173`.
By default, mock mode is enabled (`VITE_USE_MOCKS=true`) in development. Set `VITE_USE_MOCKS=false` and `VITE_API_BASE_URL=http://localhost:5000` to connect directly to the live Node API.

---

## Core Capabilities

- **Strict Multi-Tenant Document Privacy**: Private local/S3 storage abstraction; files are referenced by opaque UUIDs and streamed only via authenticated owner endpoints.
- **Magic Byte Validation**: Verifies binary headers (`%PDF-`, `\x89PNG`, `\xFF\xD8\xFF`) before processing, stopping spoofed or disguised files.
- **Three-Valued Eligibility Logic**: Deterministically evaluates rules to `PASS`, `FAIL`, or `UNKNOWN` (for ambiguous dates, unit mismatches, or conflicting evidence).
- **Auditability & Traceability**: Links every extracted attribute and rule result to its source document ID, page number, and evidence text snippet.

