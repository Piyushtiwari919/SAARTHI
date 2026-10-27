export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
  academicDetails: {
    institution: string;
    course: string;
    currentYear: number;
    totalYears: number;
    academicStream: string;
    gpaOrPercentage?: number;
    category?: 'GENERAL' | 'OBC' | 'SC' | 'ST' | 'EWS';
    annualFamilyIncome?: number;
    stateOfDomicile?: string;
  };
  privacyConsent: {
    acceptedAt: string;
    dataRetentionDays: number;
    shareWithInstitutions: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  token: string;
  user: UserProfile;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface SignupData {
  fullName: string;
  email: string;
  institution: string;
  course: string;
  agreeToPrivacy: boolean;
}
