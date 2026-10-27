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
  documentId?: string;
}

export interface AssistantQueryResponse {
  answer: string;
  sources: SourceCitation[];
  suggestedFollowUps?: string[];
  conversationId: string;
}
