import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './Button.tsx';
import { cn } from '../../utils/cn.ts';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an error loading this information. Please try again.',
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn('saarthi-error-state', className)}
      style={{
        padding: '36px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--danger-light)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--danger-border)',
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          backgroundColor: 'var(--surface)',
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-subtle)',
        }}
      >
        <AlertCircle size={22} />
      </div>
      <div>
        <h4 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>
          {title}
        </h4>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: '420px', margin: 0 }}>
          {message}
        </p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RotateCcw size={14} />}
          style={{ marginTop: '8px' }}
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
