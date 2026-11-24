import React from 'react';
import { Shield, Settings, HelpCircle, LogOut, Sun, Moon } from 'lucide-react';

export default function Navbar({
  currentUser,
  theme = 'dark',
  onToggleTheme,
  onOpenSettings,
  onOpenHelp,
  onLogout,
  onOpenTillModal
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        {/* Brand Logo & Editorial Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div className="brand-logo">
            <div className="brand-icon">
              <Shield size={18} strokeWidth={2.2} />
            </div>
            <div className="brand-name">
              IDCS
              <span>Financial</span>
            </div>
          </div>

          {/* Understated Nav Links */}
          <nav className="nav-links">
            <button 
              className="nav-link"
              onClick={() => document.getElementById('cashflow-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Performance
            </button>
            <button 
              className="nav-link"
              onClick={() => document.getElementById('plans-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Protection Plans
            </button>
            <button 
              className="nav-link"
              onClick={() => document.getElementById('claims-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Claims
            </button>
            <button 
              className="nav-link"
              onClick={() => document.getElementById('squad-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Chama Squad
            </button>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="topbar-actions">
          {currentUser && (
            <div className="user-status-pill">
              <span className="status-dot" />
              <span>{currentUser.name}</span>
              {currentUser.sector && (
                <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                  • {currentUser.sector}
                </span>
              )}
            </div>
          )}

          {/* Light / Dark Theme Toggle */}
          <button
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Help Drawer Trigger */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={onOpenHelp}
            title="Help & Questions"
          >
            <HelpCircle size={15} />
            <span>Help</span>
          </button>

          {/* Settings Trigger */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={onOpenSettings}
            title="Account & Squad Settings"
          >
            <Settings size={15} />
            <span>Settings</span>
          </button>

          {/* Sign Out */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={onLogout}
            title="Sign out of IDCS Shield"
            style={{ color: 'var(--text-muted)' }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
