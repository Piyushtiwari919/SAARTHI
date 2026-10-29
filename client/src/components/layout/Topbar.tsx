
import React from 'react';
import {
  Menu,
  Search,
  ShieldCheck,
  LogOut,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar.tsx';
import { useAuth } from '../../hooks/useAuth.ts';
import { useState } from 'react';
import { USE_MOCKS } from '../../services/api.ts';



export interface TopbarProps {
  onOpenMobileMenu: () => void;
}
// before change default  
// export const Topbar: React.FC<TopbarProps> = ({
//   onOpenMobileMenu,
// }) => {
//   const { user, logout } = useAuth();
export const Topbar: React.FC<TopbarProps> = ({
  onOpenMobileMenu,
}) => {
  const { user, logout } = useAuth();

  const [isDark, setIsDark] = useState(() => {
    return (
      document.documentElement.dataset.theme === 'dark'
    );
  });

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';

    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem('saarthi-theme', nextTheme);
    setIsDark(nextTheme === 'dark');
  };

  // Keep your existing return (...) JSX here.

  return (
    <header className="saarthi-topbar">
      <div className="topbar-left">
        <button
          onClick={onOpenMobileMenu}
          className="topbar-menu-btn"
          aria-label="Open navigation menu"
        >
          <Menu size={21} />
        </button>

        <div className="topbar-search-container">
          <Search size={18} className="topbar-search-icon" />

          <input
            type="search"
            placeholder="Search opportunities, documents..."
            aria-label="Search opportunities and documents"
          />

          <span className="topbar-search-shortcut">Search</span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-privacy-badge">
          <span className="topbar-verified-icon">
            <ShieldCheck size={15} />
          </span>
          <span>{USE_MOCKS ? '🟡 Demo Mocks' : '🟢 Live Engine'}</span>
        </div>
        <button
              type="button"
              onClick={toggleTheme}
              className="topbar-theme-btn"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="topbar-divider" />

        {user && (
          <div className="topbar-account">
            <Avatar name={user.fullName} size="sm" />

            <div className="topbar-account-details">
              <span className="topbar-username">
                {user.fullName}
              </span>
              <span className="topbar-account-caption">
                Student account
              </span>
            </div>

            <button
              onClick={() => logout()}
              className="topbar-logout-btn"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        )}

        <span className="topbar-sparkle" aria-hidden="true">
          <Sparkles size={17} />
        </span>
      </div>
    </header>
  );
};
