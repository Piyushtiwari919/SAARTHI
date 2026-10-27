import type { UserProfile } from '../../types/auth.ts';

export const mockUserProfile: UserProfile = {
  id: 'usr_sar_892341',
  fullName: 'Priya Sharma',
  email: 'priya.sharma@nit.ac.in',
  phone: '+91 98765 43210',
  academicDetails: {
    institution: 'National Institute of Technology, Nagpur',
    course: 'B.Tech in Computer Science & Engineering',
    currentYear: 3,
    totalYears: 4,
    academicStream: 'Engineering & Technology',
    gpaOrPercentage: 82.5,
    category: 'OBC',
    annualFamilyIncome: 240000,
    stateOfDomicile: 'Maharashtra',
  },
  privacyConsent: {
    acceptedAt: '2026-08-15T10:30:00Z',
    dataRetentionDays: 365,
    shareWithInstitutions: false,
  },
  createdAt: '2026-08-15T10:30:00Z',
  updatedAt: '2026-09-20T14:15:00Z',
};
