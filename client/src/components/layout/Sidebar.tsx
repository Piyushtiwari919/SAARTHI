
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
  ShieldCheck,
  FileText,
  MessageSquareText,
  Settings,
  LockKeyhole,
  X,
  Compass,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../utils/cn.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { useAuth } from '../../hooks/useAuth.ts';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/opportunities', label: 'Opportunities', icon: GraduationCap },
  { to: '/app/eligibility', label: 'Eligibility Navigator', icon: ShieldCheck },
  { to: '/app/documents', label: 'My Documents', icon: FileText },
  { to: '/app/assistant', label: 'AI Assistant', icon: MessageSquareText },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onClose,
}) => {
  const { user } = useAuth();

  return (
    <>
      {isOpen && (
        <button
          className="saarthi-sidebar-backdrop"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}

      <aside className={cn('saarthi-sidebar', isOpen && 'is-open')}>
        <div className="sidebar-brand">
          <NavLink to="/app/dashboard" className="sidebar-brand-link">
            <span className="sidebar-brand-icon">
              <Compass size={25} strokeWidth={2.2} />
            </span>

            <span className="sidebar-brand-copy">
              <span className="sidebar-brand-name">SAARTHI</span>
              <span className="sidebar-brand-caption">
                Your opportunity guide
              </span>
            </span>
          </NavLink>

          {onClose && (
            <button
              onClick={onClose}
              className="sidebar-close-btn"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-navigation" aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => onClose?.()}
              className={({ isActive }) =>
                cn('sidebar-nav-link', isActive && 'active')
              }
            >
              <span className="sidebar-nav-icon">
                <Icon size={19} strokeWidth={1.9} />
              </span>

              <span className="sidebar-nav-label">{label}</span>

              <ChevronRight
                className="sidebar-nav-chevron"
                size={15}
              />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-privacy-card">
            <span className="sidebar-privacy-icon">
              <LockKeyhole size={18} />
            </span>

            <div className="sidebar-privacy-copy">
              <div className="sidebar-privacy-title">
                Your privacy matters
              </div>
              <p>
                Your documents stay protected and private.
              </p>
            </div>

            <ShieldCheck
              className="sidebar-privacy-check"
              size={17}
            />
          </div>

          <div className="sidebar-profile">
            {user && (
              <>
                <Avatar name={user.fullName} size="sm" />

                <div className="sidebar-profile-details">
                  <div className="sidebar-profile-name">
                    {user.fullName}
                  </div>
                  <div className="sidebar-profile-subtitle">
                    {user.academicDetails?.institution || 'Student account'}
                  </div>
                </div>

                <span className="sidebar-profile-status" title="Signed in" />
              </>
            )}
          </div>

          <div className="sidebar-footer-note">
            <Sparkles size={13} />
            <span>Helping you move forward</span>
          </div>
        </div>
      </aside>
    </>
  );
};
