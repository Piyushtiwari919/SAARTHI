import React from 'react';
import { cn } from '../../utils/cn.ts';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius = 'var(--radius-xs)',
  className,
  style,
  ...props
}) => {
  return (
    <div
      className={cn('animate-pulse', className)}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--border-subtle)',
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
};
