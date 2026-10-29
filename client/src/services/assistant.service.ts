import { ApiService, USE_MOCKS, simulateLatency } from './api.ts';
import type {
  AssistantConversation,
  AssistantQueryRequest,
  AssistantQueryResponse,
  ScholarshipNoticeItem,
  Citation,
} from '../types/assistant.ts';
import { mockConversations } from '../mocks/data/assistant.mock.ts';

function normalizeNotice(raw: any): ScholarshipNoticeItem {
  return {
    id: String(raw.id || raw._id || ''),
    fileName: raw.fileName || raw.name || 'Notice.pdf',
    customTitle: raw.customTitle || raw.title || raw.fileName || 'Scholarship Notice',
    issuer: raw.issuer || undefined,
    documentType: raw.documentType || 'SCHOLARSHIP_NOTICE',
    status: raw.status || 'READY',
    indexingStatus: raw.indexingStatus || 'NOT_INDEXED',
    pageCount: Number(raw.pageCount || 1),
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
  };
}

function normalizeCitation(raw: any, idx: number): Citation {
  const score =
    typeof raw.relevanceScore === 'number'
      ? raw.relevanceScore
      : typeof raw.relevance_score === 'number'
        ? raw.relevance_score
        : undefined;

  return {
    id: String(raw.id || raw.chunk_id || `cit_${idx + 1}`),
    sourceDocument: raw.sourceDocument || raw.document_title || 'Scholarship Notice',
    documentId: raw.documentId || raw.document_id,
    page: typeof raw.page === 'number' ? raw.page : (raw.page_number || 1),
    snippet: raw.snippet || '',
    relevanceScore: score,
  };
}

class AssistantService {
  private conversations: AssistantConversation[] = USE_MOCKS ? [...mockConversations] : [];

  public async getAvailableNotices(): Promise<ScholarshipNoticeItem[]> {
    if (USE_MOCKS) {
      await simulateLatency(150);
      return [
        {
          id: 'doc_css_notice_mock',
          fileName: 'Central_Sector_Scheme_Notice_2026.pdf',
          customTitle: 'Central Sector Scheme Official Guidelines',
          issuer: 'Department of Higher Education, Govt. of India',
          documentType: 'SCHOLARSHIP_NOTICE',
          status: 'READY',
          indexingStatus: 'INDEXED',
          pageCount: 6,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const rawList = await ApiService.request<any[]>('/api/assistant/documents');
    return Array.isArray(rawList) ? rawList.map(normalizeNotice) : [];
  }

  public async indexNotice(documentId: string): Promise<{ status: string; chunkCount: number }> {
    if (USE_MOCKS) {
      await simulateLatency(400);
      return { status: 'INDEXED', chunkCount: 12 };
    }
    return ApiService.request<{ status: string; chunkCount: number }>(`/api/assistant/index/${documentId}`, {
      method: 'POST',
    });
  }

  public async getConversations(): Promise<AssistantConversation[]> {
    if (USE_MOCKS) {
      await simulateLatency(150);
      return [...this.conversations];
    }
    try {
      const raw = await ApiService.request<AssistantConversation[]>('/api/assistant/conversations');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  public async sendQuery(request: AssistantQueryRequest): Promise<AssistantQueryResponse> {
    if (USE_MOCKS) {
      await simulateLatency(500);
      return {
        status: 'ANSWERED',
        conversationId: request.conversationId || 'conv_new_mock',
        question: request.question,
        documentId: request.documentId,
        answer: `According to Section 4 of the guidelines, eligibility is strictly verified based on the submitted official marksheets and income certificate. For "${request.question}", the policy requires full documentation prior to the scholarship verification deadline.`,
        sources: [
          {
            id: `cit_${Date.now()}`,
            sourceDocument: 'Official_Guidelines_Clause_4.pdf',
            documentId: request.documentId || 'doc_gen_01',
            page: 2,
            snippet: 'Clause 4.2: Candidates must ensure that income certificates issued by an authority not below the rank of Tehsildar are uploaded.',
            relevanceScore: 0.94,
          },
        ],
        suggestedFollowUps: [
          'What is the income threshold for renewal in Year 2?',
          'How do I update my bank account details on NSP?',
        ],
      };
    }

    const raw = await ApiService.request<any>('/api/assistant/query', {
      method: 'POST',
      body: JSON.stringify({
        documentId: request.documentId,
        question: request.question,
        topK: request.topK,
      }),
    });

    const sources: Citation[] = Array.isArray(raw?.sources)
      ? raw.sources.map(normalizeCitation)
      : [];

    const warnings: string[] = Array.isArray(raw?.warnings)
      ? raw.warnings.filter((w: any) => typeof w === 'string' && w.trim().length > 0)
      : [];

    return {
      status: raw?.status || 'ANSWERED',
      conversationId: raw?.conversationId || `conv_${request.documentId}`,
      question: raw?.question || request.question,
      documentId: raw?.documentId || request.documentId,
      documentTitle: raw?.documentTitle,
      answer: raw?.answer || 'No response returned from assistant.',
      sources,
      warnings: warnings.length > 0 ? warnings : undefined,
      suggestedFollowUps: raw?.suggestedFollowUps,
    };
  }
}

export const assistantService = new AssistantService();
