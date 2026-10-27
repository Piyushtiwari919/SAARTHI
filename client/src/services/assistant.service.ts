import { ApiService, USE_MOCKS, simulateLatency } from './api.ts';
import type {
  AssistantConversation,
  AssistantQueryRequest,
  AssistantQueryResponse,
} from '../types/assistant.ts';
import { mockConversations } from '../mocks/data/assistant.mock.ts';

class AssistantService {
  private conversations: AssistantConversation[] = [...mockConversations];

  public async getConversations(): Promise<AssistantConversation[]> {
    if (USE_MOCKS) {
      await simulateLatency(150);
      return [...this.conversations];
    }
    return ApiService.request<AssistantConversation[]>('/api/assistant/conversations');
  }

  public async sendQuery(request: AssistantQueryRequest): Promise<AssistantQueryResponse> {
    if (USE_MOCKS) {
      await simulateLatency(500); // Simulate RAG retrieval + LLM synthesis
      return {
        conversationId: request.conversationId || 'conv_new_mock',
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

    return ApiService.request<AssistantQueryResponse>('/api/assistant/query', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

export const assistantService = new AssistantService();
