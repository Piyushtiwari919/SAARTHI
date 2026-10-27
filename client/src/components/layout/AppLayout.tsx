import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { Topbar } from './Topbar.tsx';

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'hidden',
      }}
    >
      {/* Sidebar (Desktop fixed, Mobile drawer) */}
      <Sidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className="saarthi-main-wrapper"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0, // Prevent flex children from overflowing
          marginLeft: 'var(--sidebar-width)',
          transition: 'margin-left var(--transition-base)',
        }}
      >
        <Topbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main
          className="saarthi-main-content"
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 'var(--max-content-width)',
            margin: '0 auto',
            padding: '28px 24px 48px 24px',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
