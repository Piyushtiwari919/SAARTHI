import { useContext } from 'react';
import { ToastContext, type ToastContextValue, type ToastType, type ToastItem } from '../context/ToastContext.ts';

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export type { ToastType, ToastItem };
