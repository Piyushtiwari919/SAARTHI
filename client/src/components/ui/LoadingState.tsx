import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn.ts';

export interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullHeight?: boolean;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'md',
  fullHeight = false,
  className,
}) => {
  const getIconSize = () => {
    switch (size) {
      case 'sm': return 16;
      case 'lg': return 28;
      case 'md':
      default: return 22;
    }
  };

  return (
    <div
      className={cn('saarthi-loading-state', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 24px',
        minHeight: fullHeight ? '300px' : 'auto',
        gap: '12px',
        color: 'var(--text-muted)',
      }}
    >
      <Loader2
        size={getIconSize()}
        style={{
          color: 'var(--brand-primary)',
          animation: 'spin 1s linear infinite',
        }}
      />
      {message && (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {message}
        </span>
      )}
    </div>
  );
};
