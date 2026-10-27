import React from 'react';
import { AuthProvider } from '../context/AuthProvider.tsx';
import { ToastProvider } from '../components/ui/Toast.tsx';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ToastProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ToastProvider>
  );
};
