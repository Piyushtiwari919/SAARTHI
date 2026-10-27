export type DocumentStatus =
  | 'UPLOADED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'OCR_COMPLETE'
  | 'ANALYZING'
  | 'INDEXING'
  | 'READY'
  | 'FAILED';

export type DocumentType =
  | 'SCHOLARSHIP_DOCUMENT'
  | 'MARKSHEET'
  | 'INCOME_CERTIFICATE'
  | 'BONAFIDE_CERTIFICATE'
  | 'DOMICILE_CERTIFICATE'
  | 'CASTE_CERTIFICATE'
  | 'IDENTITY_PROOF'
  | 'BANK_DOCUMENT'
  | 'ADMISSION_LETTER'
  | 'FEE_RECEIPT'
  | 'OTHER';

export type DocumentCategory = DocumentType;

export interface ExtractedAttribute {
  id: string;
  field: string;
  label: string;
  value: string | number | boolean;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  sourcePage?: number;
  confidence?: number; // 0 to 1
  boundingBox?: [number, number, number, number];
  verifiedByUser?: boolean;
}

export interface ProcessingStep {
  status: DocumentStatus;
  label: string;
  timestamp?: string;
  message?: string;
}

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  category: DocumentType;
  customTitle?: string;
  status: DocumentStatus;
  progressPercent: number;
  statusMessage?: string;
  isSensitive: boolean;
  pageCount?: number;
  extractedAttributes: ExtractedAttribute[];
  processingSteps?: ProcessingStep[];
  ocrCompletedAt?: string;
  analysisCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
  fileUrl?: string;
  error?: string;
}

export interface DocumentUploadPayload {
  file: File;
  category: DocumentType;
  customTitle?: string;
  isSensitive?: boolean;
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SCHOLARSHIP_DOCUMENT: 'Scholarship / Opportunity Document',
  MARKSHEET: 'Marksheet',
  INCOME_CERTIFICATE: 'Income Certificate',
  BONAFIDE_CERTIFICATE: 'Bonafide Certificate',
  DOMICILE_CERTIFICATE: 'Domicile Certificate',
  CASTE_CERTIFICATE: 'Caste Certificate',
  IDENTITY_PROOF: 'Identity Document',
  BANK_DOCUMENT: 'Bank Document',
  ADMISSION_LETTER: 'Admission Letter',
  FEE_RECEIPT: 'Fee Receipt',
  OTHER: 'Other',
};
