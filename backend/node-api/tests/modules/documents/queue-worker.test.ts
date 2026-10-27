import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueDocumentJob, getDocumentQueue } from '../../../src/queue/document-queue.js';
import { processDocumentJob } from '../../../src/queue/document-worker.js';
import { DocumentModel } from '../../../src/modules/documents/document.model.js';
import { DocumentService } from '../../../src/modules/documents/document.service.js';
import * as storageModule from '../../../src/storage/index.js';
import { Readable } from 'stream';

describe('Document Background Queue & Worker Pipeline Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Queue Enqueueing & Degradation', () => {
    it('Enqueues document processing job and updates document to QUEUED', async () => {
      vi.spyOn(DocumentModel, 'findByIdAndUpdate').mockResolvedValue({} as any);

      const queue = getDocumentQueue();
      const addSpy = vi.spyOn(queue, 'add').mockResolvedValue({ id: 'doc_doc123' } as any);

      const success = await enqueueDocumentJob('doc123', 'req_test_01');

      expect(success).toBe(true);
      expect(addSpy).toHaveBeenCalledWith(
        'extract-document',
        expect.objectContaining({
          documentId: 'doc123',
          processingVersion: 1,
          requestId: 'req_test_01',
        }),
        expect.objectContaining({
          jobId: 'doc_doc123',
        })
      );
      expect(DocumentModel.findByIdAndUpdate).toHaveBeenCalledWith('doc123', {
        status: 'QUEUED',
        progressPercent: 10,
        statusMessage: 'Job queued for background processing worker',
      });
    });

    it('Gracefully degrades if queue dispatcher fails, keeping document in UPLOADED', async () => {
      const queue = getDocumentQueue();
      vi.spyOn(queue, 'add').mockRejectedValueOnce(new Error('Redis connection timed out'));
      const updateSpy = vi.spyOn(DocumentModel, 'findByIdAndUpdate').mockResolvedValue({} as any);

      const success = await enqueueDocumentJob('doc_fail_123', 'req_test_fail');

      expect(success).toBe(false);
      expect(updateSpy).toHaveBeenCalledWith('doc_fail_123', {
        statusMessage: 'Uploaded to private storage. Awaiting background queue dispatcher.',
      });
    });
  });

  describe('Worker Processing & Failure Classification', () => {
    it('Skips processing if document is already in READY status (idempotency guard)', async () => {
      const mockDoc = {
        id: 'doc_already_ready',
        status: 'READY',
        save: vi.fn(),
      };
      vi.spyOn(DocumentModel, 'findById').mockResolvedValue(mockDoc as any);

      const result = await processDocumentJob({
        documentId: 'doc_already_ready',
        processingVersion: 1,
        requestId: 'req_1',
      });

      expect(result).toEqual({ skipped: true, reason: 'ALREADY_COMPLETED' });
      expect(mockDoc.save).not.toHaveBeenCalled();
    });

    it('Successfully processes valid document and marks READY with extracted attributes', async () => {
      const mockDoc = {
        id: 'doc_valid_income',
        status: 'QUEUED',
        fileName: 'income_cert.pdf',
        mimeType: 'application/pdf',
        documentType: 'INCOME_CERTIFICATE',
        storageKey: 'key_income_cert.pdf',
        extractedAttributes: [],
        pageCount: 1,
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(DocumentModel, 'findById').mockResolvedValue(mockDoc as any);

      const mockStorage = {
        getStream: vi.fn().mockResolvedValue(Readable.from(Buffer.from('%PDF-1.7 mock data'))),
        save: vi.fn(),
        delete: vi.fn(),
        exists: vi.fn(),
      };
      vi.spyOn(storageModule, 'getStorageProvider').mockReturnValue(mockStorage as any);

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          processing_status: 'SUCCESS',
          page_count: 2,
          extracted_fields: [
            {
              field: 'annual_income',
              value: 120000,
              confidence: 0.98,
              source_page: 1,
              evidence_snippet: 'Annual family income is Rs. 1,20,000',
              status: 'EXTRACTED',
            },
          ],
        }),
      } as any);

      const result = await processDocumentJob({
        documentId: 'doc_valid_income',
        processingVersion: 1,
        requestId: 'req_success',
      });

      expect(result.success).toBe(true);
      expect(result.extractedCount).toBe(1);
      expect(mockDoc.status).toBe('READY');
      expect(mockDoc.progressPercent).toBe(100);
      expect(mockDoc.extractedAttributes[0].field).toBe('annual_income');
      expect(mockDoc.extractedAttributes[0].value).toBe(120000);
    });

    it('Classifies permanent client/validation errors (415) as FAILED without throwing', async () => {
      const mockDoc = {
        id: 'doc_corrupt_file',
        status: 'QUEUED',
        fileName: 'corrupt.pdf',
        mimeType: 'application/pdf',
        documentType: 'INCOME_CERTIFICATE',
        storageKey: 'key_corrupt.pdf',
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(DocumentModel, 'findById').mockResolvedValue(mockDoc as any);

      const mockStorage = {
        getStream: vi.fn().mockResolvedValue(Readable.from(Buffer.from('corrupt content'))),
        save: vi.fn(),
        delete: vi.fn(),
        exists: vi.fn(),
      };
      vi.spyOn(storageModule, 'getStorageProvider').mockReturnValue(mockStorage as any);

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 415,
        json: async () => ({
          error_code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Uploaded file has invalid magic bytes',
        }),
      } as any);

      const result = await processDocumentJob({
        documentId: 'doc_corrupt_file',
        processingVersion: 1,
        requestId: 'req_2',
      });

      expect(result.failed).toBe(true);
      expect(result.permanent).toBe(true);
      expect(mockDoc.status).toBe('FAILED');
      expect(mockDoc.statusMessage).toContain('Uploaded file has invalid magic bytes');
    });

    it('Throws on transient server error (500) so BullMQ executes bounded retries', async () => {
      const mockDoc = {
        id: 'doc_transient_doc',
        status: 'QUEUED',
        fileName: 'income.pdf',
        mimeType: 'application/pdf',
        documentType: 'INCOME_CERTIFICATE',
        storageKey: 'key_income.pdf',
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(DocumentModel, 'findById').mockResolvedValue(mockDoc as any);

      const mockStorage = {
        getStream: vi.fn().mockResolvedValue(Readable.from(Buffer.from('%PDF-1.7 mock data'))),
        save: vi.fn(),
        delete: vi.fn(),
        exists: vi.fn(),
      };
      vi.spyOn(storageModule, 'getStorageProvider').mockReturnValue(mockStorage as any);

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'AI model service momentarily busy' }),
      } as any);

      await expect(
        processDocumentJob({
          documentId: 'doc_transient_doc',
          processingVersion: 1,
          requestId: 'req_3',
        })
      ).rejects.toThrow('FastAPI returned status 500');
    });
  });

  describe('Cross-User Authorization & Security Isolation', () => {
    it('DocumentService.getDocumentById strictly queries by ownerId', async () => {
      const findOneSpy = vi.spyOn(DocumentModel, 'findOne').mockResolvedValue(null);

      const result = await DocumentService.getDocumentById('user_attacker_999', 'doc_victim_123');

      expect(result).toBeNull();
      expect(findOneSpy).toHaveBeenCalledWith({
        _id: 'doc_victim_123',
        ownerId: 'user_attacker_999',
      });
    });

    it('DocumentService.getDocumentContent denies access if user is not the document owner', async () => {
      const mockChain = {
        select: vi.fn().mockResolvedValue(null),
      };
      vi.spyOn(DocumentModel, 'findOne').mockReturnValue(mockChain as any);

      await expect(
        DocumentService.getDocumentContent('user_attacker_999', 'doc_victim_123')
      ).rejects.toThrow('Document not found or access denied');
    });

    it('DocumentService.deleteDocument denies deletion if user is not the document owner', async () => {
      const mockChain = {
        select: vi.fn().mockResolvedValue(null),
      };
      vi.spyOn(DocumentModel, 'findOne').mockReturnValue(mockChain as any);

      await expect(
        DocumentService.deleteDocument('user_attacker_999', 'doc_victim_123')
      ).rejects.toThrow('Document not found or access denied');
    });
  });
});

