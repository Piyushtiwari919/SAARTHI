import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { AssistantService } from './assistant.service.js';

export const assistantRouter = Router();

// All assistant routes require authentication
assistantRouter.use(authenticate);

/**
 * POST /api/v1/assistant/query
 * Source-grounded question answering over an authorized scholarship notice.
 */
assistantRouter.post('/query', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { documentId, question, topK } = req.body;

    const result = await AssistantService.query(userId, documentId, question, topK);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/assistant/index/:documentId
 * Trigger indexing of a scholarship notice for RAG retrieval.
 */
assistantRouter.post('/index/:documentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const documentId = Array.isArray(req.params.documentId) ? req.params.documentId[0] : req.params.documentId;

    const result = await AssistantService.indexDocument(userId, documentId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/assistant/documents
 * List available scholarship notices belonging to the student with indexing status.
 */
assistantRouter.get('/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const list = await AssistantService.getAvailableNotices(userId);
    res.status(200).json(list);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/assistant/conversations
 * Retrieve conversation sessions for user.
 */
assistantRouter.get('/conversations', async (req: Request, res: Response) => {
  // Returns clean session format
  res.status(200).json([]);
});

