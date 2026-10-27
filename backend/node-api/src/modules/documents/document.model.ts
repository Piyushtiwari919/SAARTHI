import mongoose, { Schema, Document, Types } from 'mongoose';

export type DocumentProcessingStatus =
  | 'UPLOADED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'OCR_COMPLETE'
  | 'ANALYZING'
  | 'INDEXING'
  | 'READY'
  | 'FAILED';

export type DocumentTypeEnum =
  | 'INCOME_CERTIFICATE'
  | 'SCHOLARSHIP_NOTICE'
  | 'MARKSHEET'
  | 'BONAFIDE_CERTIFICATE'
  | 'DOMICILE_CERTIFICATE'
  | 'CASTE_CERTIFICATE'
  | 'IDENTITY_PROOF'
  | 'BANK_DOCUMENT'
  | 'ADMISSION_LETTER'
  | 'FEE_RECEIPT'
  | 'OTHER';

export interface IExtractedAttribute {
  id?: string;
  field: string;
  value: string | number | boolean | unknown[];
  confidence?: number;
  sourcePage?: number;
  evidenceSnippet?: string;
  status?: string;
  verifiedByUser?: boolean;
}

export interface IDocumentRecord extends Document {
  id: string;
  ownerId: Types.ObjectId;
  fileName: string;
  customTitle?: string;
  documentType: DocumentTypeEnum;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  status: DocumentProcessingStatus;
  progressPercent: number;
  statusMessage?: string;
  isSensitive: boolean;
  pageCount?: number;
  extractedAttributes: IExtractedAttribute[];
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocumentRecord>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fileName: { type: String, required: true },
    customTitle: { type: String },
    documentType: {
      type: String,
      required: true,
      enum: [
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
      ],
    },
    storageKey: { type: String, required: true, select: false },
    mimeType: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        'UPLOADED',
        'QUEUED',
        'PROCESSING',
        'OCR_COMPLETE',
        'ANALYZING',
        'INDEXING',
        'READY',
        'FAILED',
      ],
      default: 'UPLOADED',
      index: true,
    },
    progressPercent: { type: Number, default: 0 },
    statusMessage: { type: String, default: 'Uploaded to secure private storage' },
    isSensitive: { type: Boolean, default: true },
    pageCount: { type: Number, default: 1 },
    extractedAttributes: [
      {
        field: { type: String, required: true },
        value: { type: Schema.Types.Mixed },
        confidence: { type: Number },
        sourcePage: { type: Number },
        evidenceSnippet: { type: String },
        status: { type: String },
        verifiedByUser: { type: Boolean, default: false },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as Types.ObjectId)?.toString();
        ret.userId = (ret.ownerId as Types.ObjectId)?.toString();
        ret.category = ret.documentType;
        delete ret._id;
        delete ret.__v;
        delete ret.storageKey; // Never leak internal storage keys to the client
        return ret;
      },
    },
  }
);

// Compound index for fast user document listings ordered by creation date
DocumentSchema.index({ ownerId: 1, createdAt: -1 });

export const DocumentModel = mongoose.model<IDocumentRecord>('Document', DocumentSchema);

