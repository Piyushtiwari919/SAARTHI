import React from 'react';
import { cn } from '../../utils/cn.ts';

export interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: 'brand' | 'success' | 'warning' | 'warm';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showValue = false,
  variant = 'brand',
  size = 'md',
  className,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const getHeight = () => {
    switch (size) {
      case 'sm': return '4px';
      case 'lg': return '10px';
      case 'md':
      default: return '6px';
    }
  };

  const getFillColor = () => {
    switch (variant) {
      case 'success': return 'var(--success)';
      case 'warning': return 'var(--warning)';
      case 'warm': return 'var(--accent-warm)';
      case 'brand':
      default: return 'var(--brand-primary)';
    }
  };

  return (
    <div className={cn('saarthi-progress-container', className)} style={{ width: '100%' }}>
      {(label || showValue) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            fontSize: 'var(--text-xs)',
          }}
        >
          {label && <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>}
          {showValue && <span style={{ color: 'var(--text-muted)' }}>{Math.round(percentage)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          width: '100%',
          height: getHeight(),
          backgroundColor: 'var(--border-subtle)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: getFillColor(),
            borderRadius: 'var(--radius-full)',
            transition: 'width var(--transition-base)',
          }}
        />
      </div>
    </div>
  );
};
