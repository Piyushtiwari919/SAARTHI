import { Router } from 'express';
import { OpportunityModel } from './opportunity.model.js';
import { eligibilityRepository } from './eligibility.repository.js';

export const opportunityRouter = Router();

// GET /api/opportunities/featured
opportunityRouter.get('/featured', async (_req, res, next) => {
  try {
    await eligibilityRepository.getAllActiveOpportunities(); // Ensure seeds exist
    const featured = await OpportunityModel.find({ isActive: true, isFeatured: true });
    // If none marked featured, return all active
    if (featured.length === 0) {
      const allActive = await OpportunityModel.find({ isActive: true });
      res.status(200).json(allActive);
      return;
    }
    res.status(200).json(featured);
  } catch (err) {
    next(err);
  }
});

// GET /api/opportunities
opportunityRouter.get('/', async (req, res, next) => {
  try {
    await eligibilityRepository.getAllActiveOpportunities(); // Ensure seeds exist
    const filter: Record<string, unknown> = { isActive: true };

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.search) {
      const q = String(req.query.search).trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { provider: { $regex: q, $options: 'i' } },
      ];
    }

    const list = await OpportunityModel.find(filter);
    res.status(200).json(list);
  } catch (err) {
    next(err);
  }
});

// GET /api/opportunities/:id
opportunityRouter.get('/:id', async (req, res, next) => {
  try {
    const oppId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const opp = await eligibilityRepository.getOpportunityById(oppId);
    if (!opp) {
      res.status(404).json({ success: false, message: `Opportunity not found: ${oppId}` });
      return;
    }
    res.status(200).json(opp);
  } catch (err) {
    next(err);
  }
});

