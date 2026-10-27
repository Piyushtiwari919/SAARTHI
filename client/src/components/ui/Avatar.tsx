import React from 'react';
import { cn } from '../../utils/cn.ts';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  className,
}) => {
  const getInitials = (fullName: string): string => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const getDimensions = () => {
    switch (size) {
      case 'sm': return { width: '28px', height: '28px', fontSize: 'var(--text-xs)' };
      case 'lg': return { width: '48px', height: '48px', fontSize: 'var(--text-md)' };
      case 'md':
      default: return { width: '36px', height: '36px', fontSize: 'var(--text-sm)' };
    }
  };

  const dimensions = getDimensions();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('saarthi-avatar', className)}
        style={{
          ...dimensions,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid var(--border)',
        }}
      />
    );
  }

  return (
    <div
      className={cn('saarthi-avatar-initials', className)}
      style={{
        ...dimensions,
        borderRadius: '50%',
        backgroundColor: 'var(--brand-light)',
        color: 'var(--brand-primary)',
        border: '1px solid var(--brand-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        userSelect: 'none',
      }}
      title={name}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  );
};
