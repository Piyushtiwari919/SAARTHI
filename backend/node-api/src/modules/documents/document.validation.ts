import { z } from 'zod';

export const documentTypeSchema = z.enum([
  'INCOME_CERTIFICATE',
  'SCHOLARSHIP_NOTICE',
  'MARKSHEET',
  'BONAFIDE_CERTIFICATE',
  'DOMICILE_CERTIFICATE',
  'CASTE_CERTIFICATE',
  'IDENTITY_PROOF',
  'BANK_DOCUMENT',
  'ADMISSION_LETTER',
  'FEE_RECEIPT',
  'OTHER',
]);

export const uploadDocumentBodySchema = z.object({
  documentType: z
    .string()
    .optional()
    .transform((val) => (val === 'SCHOLARSHIP_DOCUMENT' ? 'SCHOLARSHIP_NOTICE' : val)),
  category: z
    .string()
    .optional()
    .transform((val) => (val === 'SCHOLARSHIP_DOCUMENT' ? 'SCHOLARSHIP_NOTICE' : val)),
  customTitle: z.string().optional(),
  isSensitive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => val === 'true' || val === true || val === undefined),
});

