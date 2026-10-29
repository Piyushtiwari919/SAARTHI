import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { Topbar } from './Topbar.tsx';
import { useAuth } from '../../hooks/useAuth.ts';
import { USE_MOCKS } from '../../services/api.ts';
import { LoadingState } from '../ui/LoadingState.tsx';

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <LoadingState message="Restoring your session..." />
      </div>
    );
  }

  if (!isAuthenticated && !USE_MOCKS) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="saarthi-app-layout">
      <Sidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="saarthi-main-wrapper">
        <Topbar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="saarthi-main-content">
          <div className="saarthi-page-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
