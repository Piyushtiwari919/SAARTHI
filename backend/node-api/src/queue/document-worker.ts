import { Worker, Job } from 'bullmq';
import { DOCUMENT_QUEUE_NAME, DocumentJobPayload } from './document-queue.js';
import { getRedisConnectionOptions } from '../config/redis.js';
import { DocumentModel, IExtractedAttribute } from '../modules/documents/document.model.js';
import { getStorageProvider } from '../storage/index.js';
import { env } from '../config/env.js';
import { Readable } from 'stream';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Core processor for document extraction and indexing jobs.
 * Extracted as a pure function for clean testability and bounded retry handling.
 */
export async function processDocumentJob(data: DocumentJobPayload): Promise<any> {
  const { documentId } = data;

  // 1. Fetch document from database
  const doc = await DocumentModel.findById(documentId);
  if (!doc) {
    console.warn(`[Worker] Document ${documentId} no longer exists. Skipping job.`);
    return { skipped: true, reason: 'DOCUMENT_NOT_FOUND' };
  }

  // 2. Idempotency guard: skip if already processed
  if (doc.status === 'READY') {
    return { skipped: true, reason: 'ALREADY_COMPLETED' };
  }

  // 3. Mark document as PROCESSING
  doc.status = 'PROCESSING';
  doc.progressPercent = 25;
  doc.statusMessage = 'Analyzing document structure with AI service...';
  await doc.save();

  // 4. Retrieve file from private object storage
  const storage = getStorageProvider();
  const stream = await storage.getStream(doc.storageKey);
  const buffer = await streamToBuffer(stream);

  // 5. Prepare multipart upload for FastAPI extraction service
  const formData = new FormData();
  const blob = new Blob([buffer], { type: doc.mimeType });
  formData.append('file', blob, doc.fileName);

  // Map category to FastAPI expected document type
  const docType =
    doc.documentType === 'SCHOLARSHIP_NOTICE' ? 'SCHOLARSHIP_NOTICE' : 'INCOME_CERTIFICATE';
  formData.append('document_type', docType);

  // 6. Call protected internal FastAPI endpoint
  const extractUrl = `${env.AI_SERVICE_URL}/internal/v1/documents/extract`;
  let extractResponse: Response;

  try {
    extractResponse = await fetch(extractUrl, {
      method: 'POST',
      headers: {
        'X-Internal-Service-Token': env.INTERNAL_SERVICE_TOKEN,
      },
      body: formData,
    });
  } catch (err: any) {
    // Transient network failure: throw error to trigger BullMQ exponential retry
    console.error(`[Worker] FastAPI unreachable for document ${documentId}:`, err.message);
    doc.statusMessage = 'AI service temporarily unavailable. Job will be retried.';
    await doc.save();
    throw err;
  }

  // 7. Handle non-2xx responses from FastAPI
  if (!extractResponse.ok) {
    let errMessage = 'Document extraction failed';
    try {
      const errData = (await extractResponse.json()) as { message?: string; error_code?: string };
      errMessage = errData.message || errMessage;
    } catch {
      // fallback
    }

    // Permanent validation failure (400, 415, 422): mark document FAILED, do not retry
    if ([400, 415, 422].includes(extractResponse.status)) {
      doc.status = 'FAILED';
      doc.progressPercent = 100;
      doc.statusMessage = `Processing rejected: ${errMessage}`;
      await doc.save();
      return { failed: true, permanent: true, message: errMessage };
    }

    // Transient server errors (500, 502, 503, 504): throw to trigger BullMQ backoff retry
    throw new Error(`FastAPI returned status ${extractResponse.status}: ${errMessage}`);
  }

  // 8. Parse successful extraction response
  const extractionResult = (await extractResponse.json()) as {
    processing_status: string;
    page_count: number;
    extracted_fields: Array<{
      field: string;
      value: unknown;
      confidence?: number;
      source_page?: number;
      evidence_snippet?: string;
      status: string;
    }>;
  };

  // 9. Map extracted fields to document schema
  const mappedAttributes: IExtractedAttribute[] = (extractionResult.extracted_fields || []).map(
    (f) => ({
      field: f.field,
      value: (f.value as any) ?? '',
      confidence: f.confidence,
      sourcePage: f.source_page,
      evidenceSnippet: f.evidence_snippet,
      status: f.status,
      verifiedByUser: false,
    })
  );

  doc.extractedAttributes = mappedAttributes;
  doc.pageCount = extractionResult.page_count || 1;

  // 10. If SCHOLARSHIP_NOTICE, auto-index for RAG Q&A
  if (doc.documentType === 'SCHOLARSHIP_NOTICE') {
    try {
      doc.progressPercent = 75;
      doc.statusMessage = 'Indexing document passages for Q&A assistant...';
      await doc.save();

      const ragFormData = new FormData();
      const ragBlob = new Blob([buffer], { type: doc.mimeType });
      ragFormData.append('file', ragBlob, doc.fileName);
      ragFormData.append('document_id', doc.id);
      ragFormData.append('document_title', doc.customTitle || doc.fileName);
      ragFormData.append('category', 'SCHOLARSHIP_NOTICE');

      const ragUrl = `${env.AI_SERVICE_URL}/internal/v1/rag/index`;
      const ragRes = await fetch(ragUrl, {
        method: 'POST',
        headers: {
          'X-Internal-Service-Token': env.INTERNAL_SERVICE_TOKEN,
        },
        body: ragFormData,
      });

      if (ragRes.ok) {
        doc.indexingStatus = 'INDEXED';
      }
    } catch (ragErr) {
      console.warn(`[Worker] RAG indexing error for notice ${documentId}:`, ragErr);
      // Non-fatal for extraction completion
    }
  }

  // 11. Mark document READY
  doc.status = 'READY';
  doc.progressPercent = 100;
  doc.statusMessage = 'Information extraction completed successfully';
  await doc.save();

  return {
    success: true,
    documentId: doc.id,
    extractedCount: mappedAttributes.length,
  };
}

export function createDocumentWorker(
  concurrency: number = 2,
  connection = getRedisConnectionOptions()
): Worker<DocumentJobPayload> {
  const worker = new Worker<DocumentJobPayload>(
    DOCUMENT_QUEUE_NAME,
    async (job: Job<DocumentJobPayload>) => {
      return processDocumentJob(job.data);
    },
    {
      connection,
      concurrency,
    }
  );

  worker.on('completed', (job) => {
    console.info(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', async (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      // Retries exhausted: mark document as FAILED in MongoDB
      try {
        await DocumentModel.findByIdAndUpdate(job.data.documentId, {
          status: 'FAILED',
          statusMessage: `Processing failed after ${job.attemptsMade} attempts: ${err.message}`,
        });
      } catch {
        // ignore
      }
    }
  });

  return worker;
}

