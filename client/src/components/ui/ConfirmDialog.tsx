import React from 'react';
import { Modal } from './Modal.tsx';
import { Button } from './Button.tsx';
import { AlertTriangle, Info } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'warning';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="440px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div
          style={{
            padding: '8px',
            borderRadius: '50%',
            backgroundColor:
              variant === 'danger'
                ? 'var(--danger-light)'
                : variant === 'warning'
                ? 'var(--warning-light)'
                : 'var(--brand-light)',
            color:
              variant === 'danger'
                ? 'var(--danger)'
                : variant === 'warning'
                ? 'var(--warning)'
                : 'var(--brand-primary)',
            flexShrink: 0,
            display: 'flex',
          }}
        >
          {variant === 'danger' || variant === 'warning' ? (
            <AlertTriangle size={20} />
          ) : (
            <Info size={20} />
          )}
        </div>
        <div>
          <h4 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '6px' }}>
            {title}
          </h4>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
};
