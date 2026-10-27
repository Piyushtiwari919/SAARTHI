import React from 'react';
import type { EligibilityStatus } from '../../types/eligibility.ts';
import { Badge, type BadgeVariant } from '../ui/Badge.tsx';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

export interface EligibilityStatusBadgeProps {
  status: EligibilityStatus;
  size?: 'sm' | 'md';
  customLabel?: string;
}

export const EligibilityStatusBadge: React.FC<EligibilityStatusBadgeProps> = ({
  status,
  size = 'md',
  customLabel,
}) => {
  const getConfig = (): { variant: BadgeVariant; icon: React.ReactNode; defaultLabel: string } => {
    switch (status) {
      case 'PASS':
        return {
          variant: 'success',
          icon: <CheckCircle2 size={size === 'sm' ? 12 : 14} />,
          defaultLabel: 'Eligible (Pass)',
        };
      case 'FAIL':
        return {
          variant: 'danger',
          icon: <XCircle size={size === 'sm' ? 12 : 14} />,
          defaultLabel: 'Ineligible (Fail)',
        };
      case 'NOT_VERIFIED':
      default:
        return {
          variant: 'warning',
          icon: <HelpCircle size={size === 'sm' ? 12 : 14} />,
          defaultLabel: 'Needs Verification',
        };
    }
  };

  const { variant, icon, defaultLabel } = getConfig();

  return (
    <Badge variant={variant} size={size} icon={icon}>
      {customLabel || defaultLabel}
    </Badge>
  );
};
