import mongoose, { Schema, Document } from 'mongoose';
import { OpportunityRule } from './eligibility.types.js';

export interface IOpportunity extends Document {
  opportunityId: string;
  title: string;
  slug?: string;
  provider: string;
  providerType?: string;
  description: string;
  amount?: number | string;
  amountDescription?: string;
  deadline?: Date;
  applicationUrl?: string;
  category?: string;
  academicLevel?: string;
  rules: OpportunityRule[];
  requiredDocumentTypes: string[];
  tags?: string[];
  isFeatured?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OpportunityRuleSchema = new Schema(
  {
    ruleId: { type: String, required: true },
    field: { type: String, required: true },
    operator: {
      type: String,
      required: true,
      enum: ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'NOT_IN', '==', '!=', '>', '>=', '<', '<='],
    },
    expectedValue: { type: Schema.Types.Mixed, required: true },
    unit: { type: String },
    required: { type: Boolean, default: true },
    source: {
      documentId: { type: String },
      page: { type: Number },
      evidenceSnippet: { type: String },
    },
    extractionStatus: {
      type: String,
      enum: ['EXTRACTED', 'NOT_FOUND', 'NEEDS_REVIEW'],
      default: 'EXTRACTED',
    },
  },
  { _id: false }
);

const OpportunitySchema = new Schema<IOpportunity>(
  {
    opportunityId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    slug: { type: String },
    provider: { type: String, required: true },
    providerType: { type: String, default: 'GOVERNMENT' },
    description: { type: String, required: true },
    amount: { type: Schema.Types.Mixed },
    amountDescription: { type: String },
    deadline: { type: Date },
    applicationUrl: { type: String },
    category: { type: String, default: 'SCHOLARSHIP' },
    academicLevel: { type: String, default: 'UNDERGRADUATE' },
    rules: { type: [OpportunityRuleSchema], default: [] },
    requiredDocumentTypes: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret.opportunityId || (ret._id as mongoose.Types.ObjectId)?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const OpportunityModel = mongoose.model<IOpportunity>('Opportunity', OpportunitySchema);

