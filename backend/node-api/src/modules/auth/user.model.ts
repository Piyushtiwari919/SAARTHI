import mongoose, { Schema, Document } from 'mongoose';

export interface IUserAcademicDetails {
  institution: string;
  course: string;
  currentYear?: number;
  totalYears?: number;
  academicStream?: string;
  gpaOrPercentage?: number;
  category?: 'GENERAL' | 'OBC' | 'SC' | 'ST' | 'EWS';
  annualFamilyIncome?: number;
  stateOfDomicile?: string;
}

export interface IUserPrivacyConsent {
  acceptedAt: Date;
  dataRetentionDays: number;
  shareWithInstitutions: boolean;
}

export interface IUser extends Document {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  phone?: string;
  avatarUrl?: string;
  academicDetails: IUserAcademicDetails;
  privacyConsent: IUserPrivacyConsent;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    avatarUrl: { type: String },
    academicDetails: {
      institution: { type: String, default: '' },
      course: { type: String, default: '' },
      currentYear: { type: Number, default: 1 },
      totalYears: { type: Number, default: 4 },
      academicStream: { type: String, default: '' },
      gpaOrPercentage: { type: Number },
      category: {
        type: String,
        enum: ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'],
        default: 'GENERAL',
      },
      annualFamilyIncome: { type: Number },
      stateOfDomicile: { type: String },
    },
    privacyConsent: {
      acceptedAt: { type: Date, default: Date.now },
      dataRetentionDays: { type: Number, default: 365 },
      shareWithInstitutions: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as mongoose.Types.ObjectId)?.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

export const UserModel = mongoose.model<IUser>('User', UserSchema);

