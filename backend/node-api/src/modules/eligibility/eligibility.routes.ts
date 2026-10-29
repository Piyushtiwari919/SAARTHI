import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { eligibilityController } from './eligibility.controller.js';

export const eligibilityRouter = Router();

eligibilityRouter.use(authenticate);

eligibilityRouter.post('/evaluate-all', (req, res, next) =>
  eligibilityController.evaluateAllOpportunities(req, res, next)
);

eligibilityRouter.post('/evaluate', (req, res, next) =>
  eligibilityController.evaluateOpportunity(req, res, next)
);

eligibilityRouter.post('/evaluate/:opportunityId', (req, res, next) =>
  eligibilityController.evaluateOpportunity(req, res, next)
);

eligibilityRouter.post('/opportunity/:opportunityId/evaluate', (req, res, next) =>
  eligibilityController.evaluateOpportunity(req, res, next)
);

eligibilityRouter.get('/all', (req, res, next) =>
  eligibilityController.getAllEligibilitySummaries(req, res, next)
);

eligibilityRouter.get('/action-items', (req, res, next) =>
  eligibilityController.getActionItems(req, res, next)
);

eligibilityRouter.get('/opportunity/:opportunityId', (req, res, next) =>
  eligibilityController.getOpportunityEligibility(req, res, next)
);

eligibilityRouter.get('/result/:resultId', (req, res, next) =>
  eligibilityController.getResultById(req, res, next)
);

eligibilityRouter.get('/:resultId', (req, res, next) =>
  eligibilityController.getResultById(req, res, next)
);
