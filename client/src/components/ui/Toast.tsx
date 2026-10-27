import React, { useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn.ts';
import { ToastContext, type ToastItem } from '../../context/ToastContext.ts';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast]
  );

  const success = useCallback((message: string, title?: string) => showToast({ type: 'success', title, message }), [showToast]);
  const warning = useCallback((message: string, title?: string) => showToast({ type: 'warning', title, message }), [showToast]);
  const error = useCallback((message: string, title?: string) => showToast({ type: 'error', title, message }), [showToast]);
  const info = useCallback((message: string, title?: string) => showToast({ type: 'info', title, message }), [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, success, warning, error, info }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notifications"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '400px',
        width: 'calc(100% - 48px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </aside>
  );
};

interface ToastMessageProps {
  toast: ToastItem;
  onDismiss: () => void;
}

const ToastMessage: React.FC<ToastMessageProps> = ({ toast, onDismiss }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />;
      case 'warning':
        return <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />;
      case 'error':
        return <XCircle size={18} style={{ color: 'var(--danger)' }} />;
      case 'info':
      default:
        return <Info size={18} style={{ color: 'var(--brand-primary)' }} />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success': return 'var(--success-border)';
      case 'warning': return 'var(--warning-border)';
      case 'error': return 'var(--danger-border)';
      case 'info': return 'var(--brand-border)';
      default: return 'var(--border)';
    }
  };

  return (
    <div
      role="status"
      style={{
        pointerEvents: 'auto',
        background: 'var(--surface)',
        border: `1px solid ${getBorderColor()}`,
        borderRadius: 'var(--radius-card)',
        padding: '12px 14px',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}
      className={cn('saarthi-toast')}
    >
      <div style={{ flexShrink: 0, marginTop: '2px' }}>{getIcon()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: '2px' }}>
            {toast.title}
          </div>
        )}
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {toast.message}
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          color: 'var(--text-muted)',
          padding: '2px',
          borderRadius: 'var(--radius-xs)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
};
