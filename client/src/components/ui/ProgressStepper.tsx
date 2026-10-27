import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../utils/cn.ts';

export interface StepItem {
  id: string;
  title: string;
  description?: string;
}

export interface ProgressStepperProps {
  steps: StepItem[];
  currentStepIndex: number;
  className?: string;
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({
  steps,
  currentStepIndex,
  className,
}) => {
  return (
    <nav
      aria-label="Progress"
      className={cn('saarthi-stepper', className)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        position: 'relative',
      }}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;

        return (
          <div
            key={step.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              position: 'relative',
              textAlign: 'center',
            }}
          >
            {/* Connecting line */}
            {index < steps.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '14px',
                  left: '50%',
                  width: '100%',
                  height: '2px',
                  backgroundColor: isCompleted ? 'var(--brand-primary)' : 'var(--border)',
                  zIndex: 0,
                  transition: 'background-color var(--transition-base)',
                }}
              />
            )}

            {/* Step circle */}
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: isCompleted
                  ? 'var(--brand-primary)'
                  : isCurrent
                  ? 'var(--surface)'
                  : 'var(--surface-muted)',
                border: isCurrent
                  ? '2px solid var(--brand-primary)'
                  : isCompleted
                  ? '2px solid var(--brand-primary)'
                  : '2px solid var(--border)',
                color: isCompleted
                  ? 'var(--text-inverse)'
                  : isCurrent
                  ? 'var(--brand-primary)'
                  : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                zIndex: 1,
                marginBottom: '6px',
                transition: 'all var(--transition-base)',
              }}
            >
              {isCompleted ? <Check size={14} /> : index + 1}
            </div>

            {/* Label */}
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: isCurrent ? 600 : 500,
                color: isCurrent
                  ? 'var(--text-primary)'
                  : isCompleted
                  ? 'var(--brand-primary)'
                  : 'var(--text-muted)',
              }}
            >
              {step.title}
            </span>
          </div>
        );
      })}
    </nav>
  );
};
