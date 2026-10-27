import React from 'react';
import { cn } from '../../utils/cn.ts';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted' | 'interactive';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className,
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'muted':
        return {
          backgroundColor: 'var(--surface-muted)',
          borderColor: 'var(--border-subtle)',
        };
      case 'interactive':
        return {
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          cursor: 'pointer',
        };
      case 'default':
      default:
        return {
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        };
    }
  };

  return (
    <div
      className={cn('saarthi-card', className)}
      style={{
        borderRadius: 'var(--radius-card)',
        border: '1px solid',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all var(--transition-fast)',
        ...getVariantStyles(),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  style,
  ...props
}) => (
  <div
    className={cn('saarthi-card-header', className)}
    style={{
      padding: '20px 24px 12px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className,
  style,
  ...props
}) => (
  <h3
    className={cn('saarthi-card-title', className)}
    style={{
      fontSize: 'var(--text-lg)',
      fontWeight: 600,
      color: 'var(--text-primary)',
      lineHeight: 1.3,
      ...style,
    }}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className,
  style,
  ...props
}) => (
  <p
    className={cn('saarthi-card-description', className)}
    style={{
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)',
      lineHeight: 1.4,
      margin: 0,
      ...style,
    }}
    {...props}
  >
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  style,
  ...props
}) => (
  <div
    className={cn('saarthi-card-content', className)}
    style={{
      padding: '12px 24px 20px 24px',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  style,
  ...props
}) => (
  <div
    className={cn('saarthi-card-footer', className)}
    style={{
      padding: '14px 24px',
      borderTop: '1px solid var(--border-subtle)',
      backgroundColor: 'var(--surface-subtle)',
      borderBottomLeftRadius: 'calc(var(--radius-card) - 1px)',
      borderBottomRightRadius: 'calc(var(--radius-card) - 1px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);
