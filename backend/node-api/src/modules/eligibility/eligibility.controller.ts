import { Request, Response, NextFunction } from 'express';
import { eligibilityService } from './eligibility.service.js';

export class EligibilityController {
  public async getOpportunityEligibility(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const oppId = Array.isArray(req.params.opportunityId)
        ? req.params.opportunityId[0]
        : req.params.opportunityId;

      const result = await eligibilityService.getEligibilityForOpportunity(userId, oppId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public async evaluateOpportunity(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const oppId = Array.isArray(req.params.opportunityId)
        ? req.params.opportunityId[0]
        : req.params.opportunityId;
      const { additionalEvidence } = req.body;

      const result = await eligibilityService.evaluateOpportunity(
        userId,
        oppId,
        additionalEvidence
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public async getAllEligibilitySummaries(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const summaries = await eligibilityService.getAllEligibilitySummaries(userId);
      res.status(200).json(summaries);
    } catch (err) {
      next(err);
    }
  }

  public async getActionItems(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const actionItems = await eligibilityService.getActionItems(userId);
      res.status(200).json(actionItems);
    } catch (err) {
      next(err);
    }
  }
}

export const eligibilityController = new EligibilityController();
