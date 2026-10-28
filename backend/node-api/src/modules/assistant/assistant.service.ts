import { DocumentModel } from '../documents/document.model.js';
import { getStorageProvider } from '../../storage/index.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error-handler.js';
import { Readable } from 'stream';

export interface SourceCitation {
  id: string;
  sourceDocument: string;
  documentId?: string;
  page: number;
  snippet: string;
  relevanceScore?: number;
}

export interface AssistantQueryResponse {
  status: 'ANSWERED' | 'INSUFFICIENT_EVIDENCE' | 'NOT_INDEXED';
  question: string;
  answer: string;
  sources: SourceCitation[];
  documentId: string;
  documentTitle?: string;
  conversationId: string;
  warnings?: string[];
}

export interface IndexingResult {
  status: 'INDEXED';
  documentId: string;
  documentTitle: string;
  chunkCount: number;
  pageCount: number;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class AssistantService {
  /**
   * Execute source-grounded RAG query against an authorized scholarship notice.
   */
  public static async query(
    userId: string,
    documentId: string,
    question: string,
    topK?: number
  ): Promise<AssistantQueryResponse> {
    if (!documentId || !documentId.trim()) {
      throw new AppError('Document ID is required to query an opportunity notice', 400);
    }

    if (!question || !question.trim()) {
      throw new AppError('Question text cannot be empty', 400);
    }

    if (question.length > 1000) {
      throw new AppError('Question exceeds maximum length of 1000 characters', 400);
    }

    // 1. Authorize user access to document
    const doc = await DocumentModel.findById(documentId);
    if (!doc) {
      throw new AppError(`Document not found: ${documentId}`, 404);
    }

    // Strict access control: verify user owns this document or document is public
    if (doc.ownerId.toString() !== userId) {
      throw new AppError('You do not have permission to query this document', 403);
    }

    // 2. Strict category verification: only SCHOLARSHIP_NOTICE is supported for RAG
    if (doc.documentType !== 'SCHOLARSHIP_NOTICE') {
      throw new AppError(
        `Category '${doc.documentType}' is not supported for Q&A. Only official SCHOLARSHIP_NOTICE documents can be queried.`,
        400
      );
    }

    // 3. Call internal FastAPI RAG query endpoint with service-to-service token
    const url = `${env.AI_SERVICE_URL}/internal/v1/rag/query`;
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Service-Token': env.INTERNAL_SERVICE_TOKEN,
        },
        body: JSON.stringify({
          document_id: documentId,
          question: question.trim(),
          top_k: topK || 5,
        }),
      });
    } catch (networkErr: unknown) {
      console.error('Failed to connect to FastAPI AI service:', networkErr);
      throw new AppError('AI Service is currently unreachable. Please try again shortly.', 503);
    }

    if (!response.ok) {
      let errMsg = 'Failed to process RAG query';
      try {
        const errJson = (await response.json()) as { message?: string };
        errMsg = errJson.message || errMsg;
      } catch {
        // fallback
      }
      throw new AppError(errMsg, response.status >= 500 ? 502 : response.status);
    }

    const data = (await response.json()) as {
      status: 'ANSWERED' | 'INSUFFICIENT_EVIDENCE' | 'NOT_INDEXED';
      question: string;
      answer: string;
      sources?: Array<{
        chunk_id?: string;
        document_title?: string;
        document_id?: string;
        page_number: number;
        snippet: string;
        relevance_score?: number;
      }>;
      warnings?: string[];
    };

    // Map internal FastAPI source shape to frontend Citation shape
    const citations: SourceCitation[] = (data.sources || []).map((s, idx: number) => ({
      id: s.chunk_id || `cit_${idx + 1}`,
      sourceDocument: s.document_title || doc.customTitle || doc.fileName,
      documentId: s.document_id || documentId,
      page: s.page_number,
      snippet: s.snippet,
      relevanceScore: s.relevance_score,
    }));

    return {
      status: data.status,
      question: data.question,
      answer: data.answer,
      sources: citations,
      documentId: doc.id,
      documentTitle: doc.customTitle || doc.fileName,
      conversationId: `conv_${doc.id}`,
      warnings: data.warnings || [],
    };
  }

  /**
   * Index a scholarship notice into the vector store.
   * Reads the file from private object storage and sends it to FastAPI internal indexing endpoint.
   */
  public static async indexDocument(userId: string, documentId: string): Promise<IndexingResult> {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) {
      throw new AppError(`Document not found: ${documentId}`, 404);
    }

    if (doc.ownerId.toString() !== userId) {
      throw new AppError('You do not have permission to index this document', 403);
    }

    if (doc.documentType !== 'SCHOLARSHIP_NOTICE') {
      throw new AppError('Only SCHOLARSHIP_NOTICE documents can be indexed for question answering', 400);
    }

    // Set indexing status to INDEXING
    doc.indexingStatus = 'INDEXING';
    await doc.save();

    try {
      // 1. Retrieve file from private storage
      const storage = getStorageProvider();
      const stream = await storage.getStream(doc.storageKey);
      const buffer = await streamToBuffer(stream);

      // 2. Prepare multipart form data for FastAPI
      const formData = new FormData();
      const fileBlob = new Blob([buffer], { type: doc.mimeType });
      formData.append('file', fileBlob, doc.fileName);
      formData.append('document_id', doc.id);
      formData.append('document_title', doc.customTitle || doc.fileName);
      formData.append('category', 'SCHOLARSHIP_NOTICE');

      // 3. Post to FastAPI internal indexing endpoint
      const url = `${env.AI_SERVICE_URL}/internal/v1/rag/index`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Internal-Service-Token': env.INTERNAL_SERVICE_TOKEN,
        },
        body: formData,
      });

      if (!response.ok) {
        let errMsg = 'FastAPI RAG indexing failed';
        try {
          const errJson = (await response.json()) as { message?: string };
          errMsg = errJson.message || errMsg;
        } catch {
          // ignore
        }
        doc.indexingStatus = 'INDEX_FAILED';
        await doc.save();
        throw new AppError(errMsg, response.status >= 500 ? 502 : response.status);
      }

      const resData = (await response.json()) as {
        chunk_count: number;
        page_count: number;
      };

      // 4. Mark document as INDEXED
      doc.indexingStatus = 'INDEXED';
      await doc.save();

      return {
        status: 'INDEXED',
        documentId: doc.id,
        documentTitle: doc.customTitle || doc.fileName,
        chunkCount: resData.chunk_count,
        pageCount: resData.page_count,
      };
    } catch (err: unknown) {
      doc.indexingStatus = 'INDEX_FAILED';
      await doc.save().catch(() => {});
      throw err;
    }
  }

  /**
   * Retrieve available scholarship notices belonging to the user for selection in the Assistant UI.
   */
  public static async getAvailableNotices(userId: string) {
    const notices = await DocumentModel.find({
      ownerId: userId,
      documentType: 'SCHOLARSHIP_NOTICE',
    }).sort({ createdAt: -1 });

    return notices.map((n) => ({
      id: n.id,
      fileName: n.fileName,
      customTitle: n.customTitle || n.fileName,
      documentType: n.documentType,
      status: n.status,
      indexingStatus: n.indexingStatus || 'NOT_INDEXED',
      pageCount: n.pageCount || 1,
      createdAt: n.createdAt,
    }));
  }
}

