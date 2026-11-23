# Saarthi — AI-Powered Document Navigator, Eligibility Analyzer & Grounded Q&A

Saarthi is an AI-powered document navigator, eligibility analyzer, and source-grounded Q&A assistant designed for students and applicants. It lets users upload scholarship notices, income certificates, marksheets, forms, and resumes, extract structured attributes with OCR + PDF parsing, evaluate eligibility using deterministic `PASS` / `FAIL` / `UNKNOWN` logic, and ask questions answered strictly from retrieved document passages with page citations.

---

## Architecture Overview

```text
SAARTHI/
  client/                  # Frontend (React + TypeScript + Vite)
  backend/
    node-api/              # Application API & Worker (Node.js + Express + TypeScript + Mongoose + BullMQ)
    ai-service/            # Document Extraction, OCR & RAG Service (Python 3.11+ + FastAPI + PyMuPDF + RapidOCR + ChromaDB)
  infra/
    docker-compose.yml     # Full stack & local infra (MongoDB 7.0, Redis 7.0, ai-service, api, worker)
  docs/
    architecture.md        # System design, data flow, separation of concerns
    api-contracts.md       # Full REST API specifications and schemas
    privacy-and-storage.md # Security, magic byte verification, private storage
```

---

## Quick Start (Local Development)

### 1. Start Infrastructure (MongoDB & Redis)
Ensure Docker Desktop is running, then start MongoDB and Redis:
```bash
docker compose -f infra/docker-compose.yml up -d mongodb redis
```
- Docker MongoDB is exposed at `127.0.0.1:27018` and Redis at `127.0.0.1:6379`.
- *(If you use a local MongoDB instance on `27017` without Docker, set `MONGODB_URI=mongodb://127.0.0.1:27017/saarthi` before starting the Node API. When Redis is offline and `ENABLE_BACKGROUND_WORKER=true`, the Node API automatically falls back to in-process document processing.)*

---

### 2. Run the FastAPI AI Service (`backend/ai-service`)
Requires Python 3.11 or higher:
```bash
cd backend/ai-service
cp .env.example .env
python -m venv .venv
# Activate venv, then install:
pip install -e .
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
- The AI service runs at `http://127.0.0.1:8000` (OpenAPI docs at `http://127.0.0.1:8000/docs`).
- **Testing AI Service (`pytest`):**
  ```bash
  pytest tests -v
  ```
  Runs **43 tests** covering PDF/image validation, RapidOCR/Tesseract fallback, income certificate & scholarship notice extraction, page-preserving chunking, document-isolated ChromaDB retrieval, precision field Q&A, resume Q&A, and strict `INSUFFICIENT_EVIDENCE` rejection.

---

### 3. Run the Node.js Application Backend (`backend/node-api`)
```bash
cd backend/node-api
cp .env.example .env
npm install
npm run dev
```
- The API server runs at `http://localhost:5000`.
- **Testing Node API (`vitest`):**
  ```bash
  npm test
  ```
  Runs **70 tests** across 8 test files covering the 22-case eligibility rule engine, magic byte detection, storage traversal protection, authentication, BullMQ queue/worker degradation, assistant routes, and HTTP APIs.

---

### 4. Run the React Frontend (`client`)
```bash
cd client
npm install
npm run dev
```
- The web application runs at `http://localhost:5173`.
- **Production Type-Check & Build:**
  ```bash
  npm run build
  ```

---

### Optional: Run Full Backend Stack in Docker
To run MongoDB, Redis, FastAPI, Node API, and the background worker together in Docker:
```bash
docker compose -f infra/docker-compose.yml up --build -d
```
Then start the frontend locally with `cd client && npm run dev`.

---

## Core Capabilities

- **OCR + PDF Extraction Pipeline**: Extracts text from native PDFs via PyMuPDF and scanned PDFs/images via RapidOCR (with Tesseract fallback and CamelCase/spacing normalization).
- **Source-Grounded RAG Document Assistant**: Indexes documents into ChromaDB with strict `document_id` isolation, preserves page numbers for citations, answers exact field/section questions (forms, certificates, marksheets, notices, and resumes), and returns `INSUFFICIENT_EVIDENCE` when a topic is absent from the selected document.
- **Three-Valued Eligibility Logic**: Deterministically evaluates scholarship rules to `PASS`, `FAIL`, or `UNKNOWN` (for missing, ambiguous, or conflicting evidence).
- **Strict Multi-Tenant Document Privacy & Validation**: Magic-byte verification (`%PDF-`, `\x89PNG`, `\xFF\xD8\xFF`), opaque UUID storage keys, and owner-scoped authenticated streaming.

