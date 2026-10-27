import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { DocumentService } from './document.service.js';
import { uploadDocumentBodySchema } from './document.validation.js';
import { DocumentTypeEnum } from './document.model.js';

// Multer memory storage with 10 MB strict limit
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

export class DocumentController {
  public static async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ success: false, message: 'No file uploaded. "file" field is required.' });
        return;
      }

      const parsedBody = uploadDocumentBodySchema.parse(req.body);
      const documentType = (parsedBody.documentType || parsedBody.category || 'OTHER') as DocumentTypeEnum;

      const doc = await DocumentService.uploadDocument({
        ownerId: req.user.id,
        originalFileName: req.file.originalname,
        documentType,
        customTitle: parsedBody.customTitle,
        isSensitive: parsedBody.isSensitive,
        buffer: req.file.buffer,
        clientMimeType: req.file.mimetype,
      });

      res.status(201).json(doc);
    } catch (error) {
      next(error);
    }
  }

  public static async listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const status = req.query.status as string | undefined;
      const docs = await DocumentService.listUserDocuments(req.user.id, status);
      res.status(200).json(docs);
    } catch (error) {
      next(error);
    }
  }

  public static async getDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const doc = await DocumentService.getDocumentById(req.user.id, documentId);
      if (!doc) {
        res.status(404).json({ success: false, message: 'Document not found or access denied' });
        return;
      }

      res.status(200).json(doc);
    } catch (error) {
      next(error);
    }
  }

  public static async getDocumentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const doc = await DocumentService.getDocumentById(req.user.id, documentId);
      if (!doc) {
        res.status(404).json({ success: false, message: 'Document not found or access denied' });
        return;
      }

      res.status(200).json({
        status: doc.status,
        progressPercent: doc.progressPercent,
        statusMessage: doc.statusMessage,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getDocumentContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const content = await DocumentService.getDocumentContent(req.user.id, documentId);
      res.setHeader('Content-Type', content.mimeType);
      res.setHeader('Content-Length', content.size);
      res.setHeader('Content-Disposition', `inline; filename="${content.fileName}"`);

      content.stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await DocumentService.deleteDocument(req.user.id, documentId);
      res.status(200).json({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
