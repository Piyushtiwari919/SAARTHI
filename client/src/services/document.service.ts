import { ApiService, USE_MOCKS, simulateLatency } from './api.ts';
import type {
  Document,
  DocumentStatus,
  DocumentUploadPayload,
  ExtractedAttribute,
} from '../types/document.ts';
import { mockDocuments } from '../mocks/data/documents.mock.ts';

type DocumentChangeListener = () => void;

class DocumentService {
  private documents: Document[] = USE_MOCKS ? [...mockDocuments] : [];
  private listeners: Set<DocumentChangeListener> = new Set();

  public subscribe(listener: DocumentChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('DocumentService listener error:', err);
      }
    }
  }

  public async listDocuments(
    filter: 'ALL' | 'PROCESSING' | 'READY' | 'FAILED' = 'ALL',
    search?: string
  ): Promise<Document[]> {
    if (USE_MOCKS) {
      await simulateLatency(150);
      let list = [...this.documents];

      if (filter === 'PROCESSING') {
        list = list.filter(
          (d) =>
            d.status === 'UPLOADED' ||
            d.status === 'QUEUED' ||
            d.status === 'PROCESSING' ||
            d.status === 'OCR_COMPLETE' ||
            d.status === 'ANALYZING' ||
            d.status === 'INDEXING'
        );
      } else if (filter === 'READY') {
        list = list.filter((d) => d.status === 'READY');
      } else if (filter === 'FAILED') {
        list = list.filter((d) => d.status === 'FAILED');
      }

      if (search && search.trim()) {
        const query = search.trim().toLowerCase();
        list = list.filter(
          (d) =>
            d.fileName.toLowerCase().includes(query) ||
            (d.customTitle && d.customTitle.toLowerCase().includes(query)) ||
            d.category.toLowerCase().includes(query)
        );
      }

      return list;
    }

    const params = new URLSearchParams();
    if (filter !== 'ALL') params.set('status', filter);
    if (search) params.set('search', search);

    return ApiService.request<Document[]>(`/api/documents?${params.toString()}`);
  }

  // Alias for backward compatibility
  public async getDocuments(): Promise<Document[]> {
    return this.listDocuments('ALL');
  }

  public async getDocument(id: string): Promise<Document | null> {
    if (USE_MOCKS) {
      await simulateLatency(120);
      const doc = this.documents.find((d) => d.id === id);
      return doc ? { ...doc } : null;
    }
    return ApiService.request<Document>(`/api/documents/${id}`);
  }

  // Alias for backward compatibility
  public async getDocumentById(id: string): Promise<Document | null> {
    return this.getDocument(id);
  }

  public async getDocumentStatus(
    id: string
  ): Promise<{ status: DocumentStatus; progressPercent: number; statusMessage?: string }> {
    if (USE_MOCKS) {
      await simulateLatency(80);
      const doc = this.documents.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found');
      return {
        status: doc.status,
        progressPercent: doc.progressPercent,
        statusMessage: doc.statusMessage,
      };
    }
    return ApiService.request<{ status: DocumentStatus; progressPercent: number; statusMessage?: string }>(
      `/api/documents/${id}/status`
    );
  }

  public async uploadDocument(payload: DocumentUploadPayload): Promise<Document> {
    if (USE_MOCKS) {
      await simulateLatency(400);

      const newDoc: Document = {
        id: `doc_${Date.now()}`,
        userId: 'usr_mock_01',
        fileName: payload.file.name,
        fileSizeBytes: payload.file.size,
        mimeType: payload.file.type || 'application/pdf',
        category: payload.category,
        customTitle: payload.customTitle,
        status: 'UPLOADED',
        progressPercent: 5,
        statusMessage: 'Uploaded to private storage. Dispatching to ingestion queue...',
        isSensitive: payload.isSensitive ?? true,
        extractedAttributes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        processingSteps: [
          {
            status: 'UPLOADED',
            label: 'Upload completed',
            timestamp: new Date().toISOString(),
            message: 'Securely uploaded to private storage',
          },
        ],
      };

      this.documents.unshift(newDoc);
      this.notifyListeners();

      // Trigger asynchronous background worker pipeline
      this.simulatePipelineProgression(newDoc.id);

      return newDoc;
    }

    const docCategory =
      payload.category === 'SCHOLARSHIP_DOCUMENT' ? 'SCHOLARSHIP_NOTICE' : payload.category;

    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('documentType', docCategory);
    formData.append('category', docCategory);
    if (payload.customTitle) {
      formData.append('customTitle', payload.customTitle);
    }
    if (payload.isSensitive !== undefined) {
      formData.append('isSensitive', String(payload.isSensitive));
    }

    const created = await ApiService.request<Document>('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });

    this.notifyListeners();
    return created;
  }

  public async retryDocument(id: string): Promise<Document> {
    if (USE_MOCKS) {
      await simulateLatency(250);
      const docIndex = this.documents.findIndex((d) => d.id === id);
      if (docIndex === -1) throw new Error('Document not found');

      const doc = this.documents[docIndex];
      const now = new Date().toISOString();

      doc.status = 'QUEUED';
      doc.progressPercent = 15;
      doc.statusMessage = 'Job re-submitted to BullMQ worker pool for processing';
      doc.error = undefined;
      doc.updatedAt = now;
      doc.processingSteps = [
        ...(doc.processingSteps || []),
        {
          status: 'QUEUED',
          label: 'Retry queued in BullMQ',
          timestamp: now,
          message: 'Retrying OCR text recognition pipeline',
        },
      ];

      this.notifyListeners();
      this.simulatePipelineProgression(id);

      return { ...doc };
    }

    return ApiService.request<Document>(`/api/documents/${id}/retry`, {
      method: 'POST',
    });
  }

  public async deleteDocument(id: string): Promise<boolean> {
    if (USE_MOCKS) {
      await simulateLatency(180);
      this.documents = this.documents.filter((d) => d.id !== id);
      this.notifyListeners();
      return true;
    }
    await ApiService.request<void>(`/api/documents/${id}`, { method: 'DELETE' });
    this.notifyListeners();
    return true;
  }

  /**
   * Simulates asynchronous background processing transitions
   * (UPLOADED -> QUEUED -> PROCESSING -> OCR_COMPLETE -> ANALYZING -> INDEXING -> READY)
   * without blocking the UI.
   */
  private simulatePipelineProgression(docId: string): void {
    const stages: Array<{
      status: DocumentStatus;
      percent: number;
      label: string;
      message: string;
      delayMs: number;
    }> = [
      {
        status: 'QUEUED',
        percent: 25,
        label: 'Ingest queue dispatch',
        message: 'Assigned to BullMQ document ingestion worker',
        delayMs: 1400,
      },
      {
        status: 'PROCESSING',
        percent: 45,
        label: 'Preprocessing & layout analysis',
        message: 'Normalizing image resolution and checking readability',
        delayMs: 1600,
      },
      {
        status: 'OCR_COMPLETE',
        percent: 65,
        label: 'OCR text recognition',
        message: 'FastAPI OCR worker extracted semantic text tokens',
        delayMs: 1800,
      },
      {
        status: 'ANALYZING',
        percent: 80,
        label: 'Rule & entity extraction',
        message: 'Parsing structured candidate criteria from document clauses',
        delayMs: 1600,
      },
      {
        status: 'INDEXING',
        percent: 90,
        label: 'RAG embeddings indexing',
        message: 'Indexed document chunks into vector database',
        delayMs: 1400,
      },
      {
        status: 'READY',
        percent: 100,
        label: 'Processed & Ready',
        message: 'Document extraction complete and ready for opportunity checks',
        delayMs: 1200,
      },
    ];

    let cumulativeDelay = 0;

    for (const stage of stages) {
      cumulativeDelay += stage.delayMs;
      setTimeout(() => {
        const doc = this.documents.find((d) => d.id === docId);
        if (!doc) return;

        doc.status = stage.status;
        doc.progressPercent = stage.percent;
        doc.statusMessage = stage.message;
        doc.updatedAt = new Date().toISOString();

        if (!doc.processingSteps) {
          doc.processingSteps = [];
        }

        doc.processingSteps.push({
          status: stage.status,
          label: stage.label,
          timestamp: new Date().toISOString(),
          message: stage.message,
        });

        // When reaching READY, generate realistic evidence attributes based on category
        if (stage.status === 'READY') {
          doc.extractedAttributes = this.generateMockAttributes(doc);
        }

        this.notifyListeners();
      }, cumulativeDelay);
    }
  }

  private generateMockAttributes(doc: Document): ExtractedAttribute[] {
    const docName = doc.customTitle || doc.fileName;

    switch (doc.category) {
      case 'MARKSHEET':
        return [
          {
            id: `attr_${Date.now()}_1`,
            field: 'percentage',
            label: 'Percentage',
            value: '78%',
            confidence: 0.96,
            sourceDocumentId: doc.id,
            sourceDocumentName: docName,
            sourcePage: 2,
            verifiedByUser: false,
          },
          {
            id: `attr_${Date.now()}_2`,
            field: 'course',
            label: 'Course',
            value: 'B.Tech (Computer Science)',
            confidence: 0.98,
            sourceDocumentId: doc.id,
            sourceDocumentName: docName,
            sourcePage: 1,
            verifiedByUser: false,
          },
          {
            id: `attr_${Date.now()}_3`,
            field: 'academicYear',
            label: 'Academic Year',
            value: '3rd Year',
            confidence: 0.95,
            sourceDocumentId: doc.id,
            sourceDocumentName: docName,
            sourcePage: 1,
            verifiedByUser: false,
          },
        ];
      case 'INCOME_CERTIFICATE':
        return [
          {
            id: `attr_${Date.now()}_4`,
            field: 'annualFamilyIncome',
            label: 'Annual Family Income',
            value: '₹2,40,000',
            confidence: 0.97,
            sourceDocumentId: doc.id,
            sourceDocumentName: docName,
            sourcePage: 1,
            verifiedByUser: false,
          },
          {
            id: `attr_${Date.now()}_5`,
            field: 'issuingAuthority',
            label: 'Issuing Authority',
            value: 'Tehsildar Office',
            confidence: 0.93,
            sourceDocumentId: doc.id,
            sourceDocumentName: docName,
            sourcePage: 1,
            verifiedByUser: false,
          },
        ];
      case 'BONAFIDE_CERTIFICATE':
        return [
          {
            id: `attr_${Date.now()}_6`,
            field: 'enrollmentStatus',
            label: 'Enrollment Status',
            value: 'Regular Full-time Student',
            confidence: 0.99,
            sourceDocumentId: doc.id,
            sourceDocumentName: docName,
            sourcePage: 1,
            verifiedByUser: false,
          },
          {
            id: `attr_${Date.now()}_7`,
            field: 'currentSemester',
            label: 'Current Semester',
            value: 'Semester 5',
            confidence: 0.96,
            sourceDocumentId: doc.id,
            sourceDocumentName: docName,
            sourcePage: 1,
            verifiedByUser: false,
          },
        ];
      default:
        return [
          {
            id: `attr_${Date.now()}_8`,
            field: 'extractedEntities',
            label: 'Extracted Content',
            value: 'Document clauses indexed for criteria matching',
            confidence: 0.91,
            sourceDocumentId: doc.id,
            sourceDocumentName: docName,
            sourcePage: 1,
            verifiedByUser: false,
          },
        ];
    }
  }
}

export const documentService = new DocumentService();
