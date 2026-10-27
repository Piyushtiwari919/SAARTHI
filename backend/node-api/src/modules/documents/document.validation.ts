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
  documentType: documentTypeSchema.or(
    z.string().transform((val) => {
      // Allow 'category' fallback from frontend payload
      return val as z.infer<typeof documentTypeSchema>;
    })
  ),
  category: documentTypeSchema.optional(),
  customTitle: z.string().optional(),
  isSensitive: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === undefined),
});

