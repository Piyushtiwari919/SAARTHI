import React from 'react';
import { Menu, Search, ShieldCheck, LogOut } from 'lucide-react';
import { Avatar } from '../ui/Avatar.tsx';
import { Badge } from '../ui/Badge.tsx';
import { useAuth } from '../../hooks/useAuth.ts';

export interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobileMenu }) => {
  const { user, logout } = useAuth();

  return (
    <header
      className="saarthi-topbar"
      style={{
        height: 'var(--topbar-height)',
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}
    >
      {/* Left: Mobile Toggle & Quick Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0, maxWidth: '540px' }}>
        <button
          onClick={onOpenMobileMenu}
          className="topbar-menu-btn"
          aria-label="Open navigation menu"
          style={{
            display: 'none', // Handled via responsive CSS
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            padding: '6px',
            borderRadius: 'var(--radius-xs)',
          }}
        >
          <Menu size={20} />
        </button>

        <div
          className="topbar-search-container"
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '360px',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            placeholder="Search scholarships, grants, or documents..."
            style={{
              width: '100%',
              backgroundColor: 'var(--surface-muted)',
              border: '1px solid transparent',
              borderRadius: 'var(--radius-btn)',
              padding: '7px 12px 7px 36px',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'all var(--transition-fast)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface-muted)';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          />
        </div>
      </div>

      {/* Right: Privacy Badge & User controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="topbar-privacy-badge">
          <Badge variant="brand" size="sm" icon={<ShieldCheck size={12} />}>
            Verified Student Session
          </Badge>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar name={user.fullName} size="sm" />
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  display: 'none',
                }}
                className="topbar-username"
              >
                {user.fullName}
              </span>
            </div>

            <button
              onClick={() => logout()}
              title="Sign out"
              aria-label="Sign out"
              style={{
                color: 'var(--text-muted)',
                padding: '6px',
                borderRadius: 'var(--radius-xs)',
                display: 'flex',
                alignItems: 'center',
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
