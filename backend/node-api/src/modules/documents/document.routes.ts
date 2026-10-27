import { Router } from 'express';
import { DocumentController, upload } from './document.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { uploadLimiter } from '../../middleware/rate-limit.js';

const router = Router();

// All document routes require authenticated user session
router.use(authenticate);

router.post('/', uploadLimiter, upload.single('file'), DocumentController.uploadDocument);
router.post('/upload', uploadLimiter, upload.single('file'), DocumentController.uploadDocument);
router.get('/', DocumentController.listDocuments);
router.get('/:id', DocumentController.getDocument);
router.get('/:id/status', DocumentController.getDocumentStatus);
router.get('/:id/content', DocumentController.getDocumentContent);
router.delete('/:id', DocumentController.deleteDocument);

export { router as documentRoutes };
