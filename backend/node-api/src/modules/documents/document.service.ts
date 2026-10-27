import crypto from 'crypto';
import path from 'path';
import { Readable } from 'stream';
import { DocumentModel, IDocumentRecord, DocumentTypeEnum } from './document.model.js';
import { getStorageProvider } from '../../storage/index.js';
import { detectFileSignature } from '../../utils/file-signature.js';

export interface DocumentUploadOptions {
  ownerId: string;
  originalFileName: string;
  documentType: DocumentTypeEnum;
  customTitle?: string;
  isSensitive?: boolean;
  buffer: Buffer;
  clientMimeType: string;
}

export class DocumentService {
  public static async uploadDocument(options: DocumentUploadOptions): Promise<IDocumentRecord> {
    // 1. Validate file signature
    const signature = detectFileSignature(options.buffer);
    if (!signature.isValid || !signature.detectedMime) {
      const err = new Error('Unsupported file type. Only PDF, PNG, and JPEG files are accepted.');
      (err as unknown as { statusCode: number }).statusCode = 415;
      throw err;
    }

    // 2. Maximum file size check (10 MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (options.buffer.length > MAX_SIZE) {
      const err = new Error('File exceeds maximum allowed size of 10 MB.');
      (err as unknown as { statusCode: number }).statusCode = 413;
      throw err;
    }

    // 3. Generate server-side opaque storage key
    const extension = signature.extension || 'bin';
    const storageKey = `${crypto.randomUUID()}.${extension}`;

    // 4. Save into private object storage
    const storage = getStorageProvider();
    await storage.save(storageKey, options.buffer, signature.detectedMime);

    // 5. Clean / sanitize original filename
    const sanitizedFileName = path.basename(options.originalFileName).replace(/[^a-zA-Z0-9._-]/g, '_');

    // 6. Save metadata in MongoDB
    const doc = await DocumentModel.create({
      ownerId: options.ownerId,
      fileName: sanitizedFileName,
      customTitle: options.customTitle || sanitizedFileName.replace(/\.[^/.]+$/, ''),
      documentType: options.documentType,
      storageKey,
      mimeType: signature.detectedMime,
      fileSizeBytes: options.buffer.length,
      status: 'UPLOADED',
      progressPercent: 0,
      statusMessage: 'Stored in private vault',
      isSensitive: options.isSensitive ?? true,
      pageCount: 1,
      extractedAttributes: [],
    });

    return doc;
  }

  public static async listUserDocuments(
    ownerId: string,
    filterStatus?: string
  ): Promise<IDocumentRecord[]> {
    const query: Record<string, unknown> = { ownerId };
    if (filterStatus && filterStatus !== 'ALL') {
      query.status = filterStatus;
    }
    return DocumentModel.find(query).sort({ createdAt: -1 });
  }

  public static async getDocumentById(
    ownerId: string,
    documentId: string
  ): Promise<IDocumentRecord | null> {
    const doc = await DocumentModel.findOne({ _id: documentId, ownerId });
    return doc;
  }

  public static async getDocumentContent(
    ownerId: string,
    documentId: string
  ): Promise<{ stream: Readable; mimeType: string; fileName: string; size: number }> {
    const doc = await DocumentModel.findOne({ _id: documentId, ownerId }).select('+storageKey');
    if (!doc) {
      const err = new Error('Document not found or access denied');
      (err as unknown as { statusCode: number }).statusCode = 404;
      throw err;
    }

    const storage = getStorageProvider();
    const stream = await storage.getStream(doc.storageKey);

    return {
      stream,
      mimeType: doc.mimeType,
      fileName: doc.fileName,
      size: doc.fileSizeBytes,
    };
  }

  public static async deleteDocument(ownerId: string, documentId: string): Promise<void> {
    const doc = await DocumentModel.findOne({ _id: documentId, ownerId }).select('+storageKey');
    if (!doc) {
      const err = new Error('Document not found or access denied');
      (err as unknown as { statusCode: number }).statusCode = 404;
      throw err;
    }

    const storage = getStorageProvider();
    // 1. Delete binary from storage
    try {
      await storage.delete(doc.storageKey);
    } catch (err) {
      console.warn(`[DocumentService] Storage delete warning for key ${doc.storageKey}:`, err);
    }

    // 2. Delete metadata from MongoDB
    await DocumentModel.deleteOne({ _id: documentId });
  }
}

