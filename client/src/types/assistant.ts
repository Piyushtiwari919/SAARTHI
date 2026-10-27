export type RAGResponseStatus = 'ANSWERED' | 'INSUFFICIENT_EVIDENCE' | 'NOT_INDEXED';

export interface SourceCitation {
  id: string;
  sourceDocument: string;
  documentId?: string;
  page: number;
  snippet: string;
  relevanceScore?: number;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  status?: RAGResponseStatus;
  citations?: SourceCitation[];
  opportunityContextId?: string;
  documentContextId?: string;
}

export interface AssistantConversation {
  id: string;
  title: string;
  opportunityId?: string;
  createdAt: string;
  updatedAt: string;
  messages: AssistantMessage[];
}

export interface AssistantQueryRequest {
  conversationId?: string;
  question: string;
  opportunityId?: string;
  documentId: string;
  topK?: number;
}

export interface AssistantQueryResponse {
  status: RAGResponseStatus;
  answer: string;
  sources: SourceCitation[];
  suggestedFollowUps?: string[];
  conversationId: string;
  documentId?: string;
  documentTitle?: string;
  warnings?: string[];
}

export interface ScholarshipNoticeItem {
  id: string;
  fileName: string;
  customTitle?: string;
  documentType: string;
  status: string;
  indexingStatus: 'NOT_INDEXED' | 'INDEXING' | 'INDEXED' | 'INDEX_FAILED';
  pageCount: number;
  createdAt: string;
}
