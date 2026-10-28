
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { Topbar } from './Topbar.tsx';

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
