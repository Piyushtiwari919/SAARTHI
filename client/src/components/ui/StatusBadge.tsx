import React from 'react';
import { Badge, type BadgeVariant } from './Badge.tsx';

export interface StatusBadgeProps {
  status: string;
  label?: string;
  variant?: BadgeVariant;
  pulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  variant = 'neutral',
  pulse = false,
}) => {
  const displayLabel = label || status;

  const getDotColor = () => {
    switch (variant) {
      case 'brand': return 'var(--brand-primary)';
      case 'success': return 'var(--success)';
      case 'warning': return 'var(--warning)';
      case 'danger': return 'var(--danger)';
      case 'warm': return 'var(--accent-warm)';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <Badge variant={variant} size="sm">
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: getDotColor(),
          display: 'inline-block',
          animation: pulse ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : undefined,
        }}
        aria-hidden="true"
      />
      {displayLabel}
    </Badge>
  );
};
