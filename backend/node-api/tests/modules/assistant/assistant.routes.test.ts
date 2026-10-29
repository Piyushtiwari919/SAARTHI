import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../src/app.js';
import { env } from '../../../src/config/env.js';
import { AssistantService } from '../../../src/modules/assistant/assistant.service.js';

describe('Assistant RAG API Routes Integration Tests', () => {
  const validUserToken = jwt.sign(
    { userId: 'user_authenticated_123', email: 'applicant@test.ac.in' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  it('POST /api/v1/assistant/query returns 401 when token is missing', async () => {
    const res = await request(app)
      .post('/api/v1/assistant/query')
      .send({ documentId: 'doc_123', question: 'What is the deadline?' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/assistant/query rejects empty documentId with 400', async () => {
    const res = await request(app)
      .post('/api/v1/assistant/query')
      .set('Authorization', `Bearer ${validUserToken}`)
      .send({ documentId: '', question: 'What is the deadline?' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Document ID is required');
  });

  it('POST /api/v1/assistant/query rejects empty question with 400', async () => {
    const res = await request(app)
      .post('/api/v1/assistant/query')
      .set('Authorization', `Bearer ${validUserToken}`)
      .send({ documentId: 'doc_123', question: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Question text cannot be empty');
  });

  it('POST /api/v1/assistant/query returns 200 with answer and citations when query succeeds', async () => {
    vi.spyOn(AssistantService, 'query').mockResolvedValueOnce({
      status: 'ANSWERED',
      question: 'What is the minimum percentage?',
      answer: 'The minimum required score is 80% marks in Class 12 board examinations.',
      sources: [
        {
          id: 'cit_p1_c1',
          sourceDocument: 'CSSS_Scholarship_Circular.pdf',
          documentId: 'doc_123',
          page: 2,
          snippet: 'Eligibility: Candidates must score above 80th percentile in the relevant board examination.',
          relevanceScore: 0.92,
        },
      ],
      documentId: 'doc_123',
      documentTitle: 'CSSS_Scholarship_Circular.pdf',
      conversationId: 'conv_doc_123',
      warnings: [],
    });

    const res = await request(app)
      .post('/api/v1/assistant/query')
      .set('Authorization', `Bearer ${validUserToken}`)
      .send({ documentId: 'doc_123', question: 'What is the minimum percentage?' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ANSWERED');
    expect(res.body.answer).toContain('80%');
    expect(res.body.sources).toHaveLength(1);
    expect(res.body.sources[0].page).toBe(2);
  });

  it('GET /api/v1/assistant/documents returns list of user documents (Mode A & Mode B) with indexing status', async () => {
    vi.spyOn(AssistantService, 'getAvailableNotices').mockResolvedValueOnce([
      {
        id: 'doc_notice_01',
        fileName: 'National_Scholarship_Notice.pdf',
        customTitle: 'National Scholarship Notice 2026',
        documentType: 'SCHOLARSHIP_NOTICE',
        status: 'READY',
        indexingStatus: 'INDEXED',
        pageCount: 4,
        createdAt: new Date(),
      },
      {
        id: 'doc_aktu_02',
        fileName: 'AKTU_EXAM_FORM.pdf',
        customTitle: 'AKTU EXAM FORM',
        documentType: 'OTHER',
        status: 'READY',
        indexingStatus: 'INDEXED',
        pageCount: 1,
        createdAt: new Date(),
      },
    ]);

    const res = await request(app)
      .get('/api/v1/assistant/documents')
      .set('Authorization', `Bearer ${validUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].indexingStatus).toBe('INDEXED');
    expect(res.body[1].documentType).toBe('OTHER');
  });

  it('POST /api/v1/assistant/query returns 403 when user queries another users document', async () => {
    const { DocumentModel } = await import('../../../src/modules/documents/document.model.js');
    vi.spyOn(DocumentModel, 'findById').mockResolvedValueOnce({
      id: 'doc_foreign_999',
      ownerId: { toString: () => 'other_owner_user_999' },
      fileName: 'Other_User_Form.pdf',
      documentType: 'OTHER',
      status: 'READY',
    } as any);

    const res = await request(app)
      .post('/api/v1/assistant/query')
      .set('Authorization', `Bearer ${validUserToken}`)
      .send({ documentId: 'doc_foreign_999', question: 'What is the candidate name?' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('You do not have permission to query this document');
  });
});
