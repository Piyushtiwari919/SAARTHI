import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className,
      style,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Style configurations based on tokens
    const getVariantStyles = (): React.CSSProperties => {
      switch (variant) {
        case 'secondary':
          return {
            backgroundColor: 'var(--surface-muted)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          };
        case 'outline':
          return {
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          };
        case 'ghost':
          return {
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid transparent',
          };
        case 'danger':
          return {
            backgroundColor: 'var(--danger)',
            color: 'var(--text-inverse)',
            border: '1px solid var(--danger)',
          };
        case 'primary':
        default:
          return {
            backgroundColor: 'var(--brand-primary)',
            color: 'var(--text-inverse)',
            border: '1px solid var(--brand-primary)',
          };
      }
    };

    const getSizeStyles = (): React.CSSProperties => {
      switch (size) {
        case 'sm':
          return {
            padding: '6px 12px',
            fontSize: 'var(--text-sm)',
            borderRadius: 'var(--radius-btn)',
            gap: '6px',
          };
        case 'lg':
          return {
            padding: '12px 22px',
            fontSize: 'var(--text-base)',
            borderRadius: 'var(--radius-btn)',
            gap: '10px',
          };
        case 'md':
        default:
          return {
            padding: '9px 16px',
            fontSize: 'var(--text-sm)',
            borderRadius: 'var(--radius-btn)',
            gap: '8px',
          };
      }
    };

    const baseStyles: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 500,
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled || isLoading ? 0.65 : 1,
      transition: 'all var(--transition-fast)',
      whiteSpace: 'nowrap',
      lineHeight: 1.2,
      ...getVariantStyles(),
      ...getSizeStyles(),
      ...style,
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn('saarthi-btn', `saarthi-btn-${variant}`, className)}
        style={baseStyles}
        {...props}
      >
        {isLoading && (
          <Loader2
            size={size === 'sm' ? 14 : 16}
            style={{ animation: 'spin 1s linear infinite' }}
          />
        )}
        {!isLoading && leftIcon && <span style={{ display: 'inline-flex' }}>{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span style={{ display: 'inline-flex' }}>{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
