import type { AssistantConversation } from '../../types/assistant.ts';

export const mockConversations: AssistantConversation[] = [
  {
    id: 'conv_1',
    title: 'Central Sector Scheme Renewal & Income Rules',
    opportunityId: 'opp_css_01',
    createdAt: '2026-09-22T14:00:00Z',
    updatedAt: '2026-09-22T14:05:00Z',
    messages: [
      {
        id: 'msg_1',
        role: 'user',
        content: 'Is this scholarship renewable for all 4 years of my engineering degree?',
        timestamp: '2026-09-22T14:01:00Z',
      },
      {
        id: 'msg_2',
        role: 'assistant',
        content: 'Yes, the Central Sector Scheme is renewable annually for up to 5 years (which covers your 4-year B.Tech program). To maintain eligibility for renewal each academic year, you must maintain at least 50% marks in the annual examination and satisfy the minimum 75% attendance criteria specified by your institution.',
        timestamp: '2026-09-22T14:01:20Z',
        citations: [
          {
            id: 'cit_1',
            sourceDocument: 'Central_Sector_Scheme_Guidelines_2026.pdf',
            documentId: 'doc_guidelines_css',
            page: 4,
            snippet: 'Clause 6.1 (Renewal of Scholarships): A scholarship under the Scheme is renewable from year-to-year up to postgraduate level... provided the scholar secures at least 50% marks in annual examination and maintains 75% attendance.',
            relevanceScore: 0.96,
          },
          {
            id: 'cit_2',
            sourceDocument: 'Central_Sector_Scheme_Guidelines_2026.pdf',
            documentId: 'doc_guidelines_css',
            page: 7,
            snippet: 'Clause 11.3: For engineering / technical professional degrees of 4 years duration, renewal covers all four academic years.',
            relevanceScore: 0.92,
          },
        ],
      },
    ],
  },
];
