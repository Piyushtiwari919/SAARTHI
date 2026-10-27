import mongoose, { Schema, Document, Types } from 'mongoose';
import { OverallEligibilityStatus, RequirementResult } from './eligibility.types.js';

export interface IActionItem {
  id: string;
  title: string;
  description: string;
  type: 'UPLOAD_DOCUMENT' | 'VERIFY_ATTRIBUTE' | 'APPLY_NOW';
  targetDocumentType?: string;
  targetOpportunityId?: string;
  isCompleted: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
}

export interface IEligibilityResultRecord extends Document {
  userId: Types.ObjectId;
  opportunityId: string;
  opportunityTitle: string;
  overallStatus: OverallEligibilityStatus;
  confidenceScore: number;
  summary: string;
  requirements: RequirementResult[];
  missingDocuments: string[];
  actionItems: IActionItem[];
  evaluatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RequirementResultSchema = new Schema(
  {
    ruleId: { type: String, required: true },
    field: { type: String, required: true },
    operator: { type: String, required: true },
    expectedValue: { type: Schema.Types.Mixed },
    actualValue: { type: Schema.Types.Mixed },
    unit: { type: String },
    status: {
      type: String,
      enum: ['PASS', 'FAIL', 'UNKNOWN'],
      required: true,
    },
    reason: { type: String, required: true },
    source: {
      documentId: { type: String },
      page: { type: Number },
      evidenceSnippet: { type: String },
    },
    evidence: {
      documentId: { type: String },
      page: { type: Number },
      evidenceSnippet: { type: String },
    },
  },
  { _id: false }
);

const ActionItemSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ['UPLOAD_DOCUMENT', 'VERIFY_ATTRIBUTE', 'APPLY_NOW'],
      required: true,
    },
    targetDocumentType: { type: String },
    targetOpportunityId: { type: String },
    isCompleted: { type: Boolean, default: false },
    priority: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
    },
    dueDate: { type: String },
  },
  { _id: false }
);

const EligibilityResultSchema = new Schema<IEligibilityResultRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    opportunityId: { type: String, required: true, index: true },
    opportunityTitle: { type: String, required: true },
    overallStatus: {
      type: String,
      enum: ['PASS', 'FAIL', 'UNKNOWN'],
      required: true,
    },
    confidenceScore: { type: Number, default: 0 },
    summary: { type: String, required: true },
    requirements: { type: [RequirementResultSchema], default: [] },
    missingDocuments: { type: [String], default: [] },
    actionItems: { type: [ActionItemSchema], default: [] },
    evaluatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as mongoose.Types.ObjectId)?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

EligibilityResultSchema.index({ userId: 1, opportunityId: 1 }, { unique: true });

export const EligibilityResultModel = mongoose.model<IEligibilityResultRecord>(
  'EligibilityResult',
  EligibilityResultSchema
);

