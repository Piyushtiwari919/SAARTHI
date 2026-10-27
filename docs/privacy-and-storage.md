# Saarthi — Privacy, Storage Architecture & Security Controls

## 1. Principles of Student Data Privacy

Saarthi processes sensitive educational, financial, and governmental identity documents (e.g. Income Certificates, Caste Certificates, Marksheets). We follow strict data-minimization, privacy-by-design, and least-privilege principles:

1. **User Ownership**: Documents uploaded by an applicant belong exclusively to that applicant.
2. **Strict Multi-Tenant Isolation**: Every database query and storage lookup requires explicit ownership verification (`ownerId: req.user.id`). Users can never enumerate, inspect, or delete other users' documents.
3. **No Direct Public URLs**: Uploaded documents are never saved to public web directories (`public/` or publicly readable S3 buckets). Binaries are streamed only through authenticated, access-controlled endpoints (`/api/v1/documents/:id/content`).
4. **Consent & Retention Controls**: Users provide explicit privacy consent at signup. Retention periods default to 365 days unless renewed or explicitly deleted.

---

## 2. Upload Validation & Defense-in-Depth

Untrusted client uploads present critical attack vectors (MIME-spoofing, embedded exploits, denial of service). Saarthi employs multi-layered defenses:

### A. Size Enforcement
- Maximum upload size is strictly capped at **10 MB** via Multer memory limits. Requests exceeding 10 MB are rejected immediately with HTTP 413.

### B. Magic Byte (File Signature) Verification
File extensions (`.pdf`, `.png`, `.jpg`) and client-sent `Content-Type` headers are easily spoofed. The backend inspects the actual leading header bytes before storing the file:
- **PDF**: `%PDF-` (`0x25 0x50 0x44 0x46`)
- **PNG**: `\x89PNG\r\n\x1a\n` (`0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`)
- **JPEG**: `\xFF\xD8\xFF` (`0xFF 0xD8 0xFF`)

Disguised files (e.g. an executable `.exe` or shell script renamed with a `.pdf` extension) fail file signature inspection and are rejected with HTTP 400.

---

## 3. Storage Abstraction Architecture

Document storage is implemented via a clean `StorageProvider` interface:

```typescript
export interface StorageProvider {
  save(key: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

### A. Local Filesystem Provider (`LocalPrivateStorageProvider`)
- Used for local development and private on-premise deployments.
- **Path Traversal Protection**: Keys containing `..`, absolute paths, or path separators are strictly rejected. Keys are generated as opaque UUIDs (e.g. `doc_<uuid>.pdf`).
- Directory: `./storage/documents`, outside the web root.

### B. S3 Provider (`S3StorageProvider`)
- Used in production with AWS S3 or compatible object stores (Cloudflare R2, MinIO).
- Enforces private ACLs, server-side encryption (SSE-S3 or SSE-KMS), and TLS in transit.

---

## 4. Synchronized Lifecycle & Permanent Deletion

When a user deletes a document via `DELETE /api/v1/documents/:id`:
1. Ownership is verified against the authenticated user.
2. The physical object is deleted from private storage (local disk or S3 bucket).
3. The corresponding document record, extracted attributes, and metadata are permanently removed from MongoDB.
4. Any associated cached evaluation results are invalidated or flagged for re-computation.

