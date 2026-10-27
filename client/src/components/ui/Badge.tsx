import React from 'react';
import { cn } from '../../utils/cn.ts';

export type BadgeVariant = 'neutral' | 'brand' | 'warm' | 'success' | 'warning' | 'danger';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className,
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'brand':
        return {
          backgroundColor: 'var(--brand-light)',
          color: 'var(--brand-primary)',
          borderColor: 'var(--brand-border)',
        };
      case 'warm':
        return {
          backgroundColor: 'var(--accent-warm-light)',
          color: '#9E6C15',
          borderColor: 'var(--accent-warm-border)',
        };
      case 'success':
        return {
          backgroundColor: 'var(--success-light)',
          color: 'var(--success)',
          borderColor: 'var(--success-border)',
        };
      case 'warning':
        return {
          backgroundColor: 'var(--warning-light)',
          color: 'var(--warning)',
          borderColor: 'var(--warning-border)',
        };
      case 'danger':
        return {
          backgroundColor: 'var(--danger-light)',
          color: 'var(--danger)',
          borderColor: 'var(--danger-border)',
        };
      case 'neutral':
      default:
        return {
          backgroundColor: 'var(--surface-muted)',
          color: 'var(--text-secondary)',
          borderColor: 'var(--border)',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          fontSize: 'var(--text-xs)',
          padding: '2px 8px',
          gap: '4px',
        };
      case 'md':
      default:
        return {
          fontSize: 'var(--text-xs)',
          padding: '3px 10px',
          gap: '6px',
        };
    }
  };

  return (
    <span
      className={cn('saarthi-badge', `saarthi-badge-${variant}`, className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 500,
        borderRadius: 'var(--radius-full)',
        border: '1px solid',
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...props}
    >
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </span>
  );
};
