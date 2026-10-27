import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
  ShieldCheck,
  FileText,
  MessageSquareText,
  Settings,
  Lock,
  X,
  Compass,
} from 'lucide-react';
import { cn } from '../../utils/cn.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { useAuth } from '../../hooks/useAuth.ts';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  {
    to: '/app/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={18} />,
  },
  {
    to: '/app/opportunities',
    label: 'Opportunities',
    icon: <GraduationCap size={18} />,
  },
  {
    to: '/app/eligibility',
    label: 'Eligibility Navigator',
    icon: <ShieldCheck size={18} />,
  },
  {
    to: '/app/documents',
    label: 'My Documents',
    icon: <FileText size={18} />,
  },
  {
    to: '/app/assistant',
    label: 'AI Assistant',
    icon: <MessageSquareText size={18} />,
  },
  {
    to: '/app/settings',
    label: 'Settings',
    icon: <Settings size={18} />,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user } = useAuth();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          role="presentation"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(24, 32, 29, 0.4)',
            zIndex: 990,
          }}
        />
      )}

      <aside
        className={cn('saarthi-sidebar', isOpen && 'is-open')}
        style={{
          width: 'var(--sidebar-width)',
          height: '100vh',
          backgroundColor: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 995,
          transition: 'transform var(--transition-base)',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            height: 'var(--topbar-height)',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <NavLink
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              color: 'var(--text-primary)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--brand-primary)',
                color: 'var(--text-inverse)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Compass size={18} />
            </div>
            <div>
              <span style={{ fontSize: 'var(--text-md)', fontWeight: 700, letterSpacing: '-0.01em', display: 'block' }}>
                Saarthi
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Opportunity Navigator
              </span>
            </div>
          </NavLink>

          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="sidebar-close-btn"
              aria-label="Close sidebar"
              style={{
                display: 'none', // Shown only on mobile via CSS media queries
                color: 'var(--text-muted)',
                padding: '4px',
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav
          style={{
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => onClose && onClose()}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-btn)',
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--brand-light)' : 'transparent',
                textDecoration: 'none',
                transition: 'all var(--transition-fast)',
              })}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Privacy First Indicator */}
        <div style={{ padding: '12px 16px' }}>
          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--surface-muted)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}
          >
            <Lock size={15} style={{ color: 'var(--brand-primary)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Private Student Vault
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35, marginTop: '2px' }}>
                Your documents are never shared or made public without explicit consent.
              </div>
            </div>
          </div>
        </div>

        {/* User Profile Footer */}
        {user && (
          <div
            style={{
              padding: '14px 16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'var(--surface-subtle)',
            }}
          >
            <Avatar name={user.fullName} size="sm" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.fullName}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.academicDetails.institution}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
