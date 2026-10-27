import { z } from 'zod';

export const evaluateOpportunityParamsSchema = z.object({
  opportunityId: z.string().min(1, 'Opportunity ID is required'),
});

export const evaluateManualEvidenceSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  value: z.unknown(),
  unit: z.string().optional(),
  status: z.enum(['EXTRACTED', 'NOT_FOUND', 'NEEDS_REVIEW']).optional(),
  sourceDocumentId: z.string().optional(),
  sourcePage: z.number().int().positive().optional(),
  evidenceSnippet: z.string().optional(),
});

export const evaluateRequestSchema = z.object({
  opportunityId: z.string().optional(),
  additionalEvidence: z.array(evaluateManualEvidenceSchema).optional(),
});

