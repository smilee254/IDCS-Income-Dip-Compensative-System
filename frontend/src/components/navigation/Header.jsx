import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Sun, Moon, ArrowRight, Menu, PhoneCall, 
  Settings, LogOut, Calculator, BookOpen, LayoutDashboard 
} from 'lucide-react';

export default function Header({
  currentRoute,
  onNavigate,
  theme,
  onToggleTheme,
  onOpenMobileMenu,
  currentUser,
  onLogout,
  onOpenSettings,
  onOpenUssd
}) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`nexora-header ${isScrolled ? 'header-scrolled' : 'header-transparent'}`}>
      <div className="nexora-container">
        <div className="nexora-header-inner">
          {/* Brand Logo */}
          <div 
            className="nexora-brand"
            onClick={() => onNavigate('/')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onNavigate('/'); }}
          >
            <div className="nexora-brand-mark" style={{ width: 'auto', padding: '0 10px', fontSize: 15 }}>
              IDCS
            </div>
            <div className="nexora-brand-text">
              <span className="nexora-brand-title">IDCS</span>
              <span className="nexora-brand-subtitle">INCOME PROTECTION</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="desktop-only" aria-label="Main Navigation">
            <ul className="nexora-nav-links">
              <li className="nexora-nav-item">
                <button
                  className={`nexora-nav-link ${currentRoute === '/' ? 'active' : ''}`}
                  onClick={() => onNavigate('/')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <LayoutDashboard size={15} />
                  <span>Dashboard</span>
                </button>
              </li>

              <li className="nexora-nav-item">
                <button
                  className={`nexora-nav-link ${currentRoute === '/resources' ? 'active' : ''}`}
                  onClick={() => onNavigate('/resources')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Calculator size={15} />
                  <span>Risk Calculator</span>
                </button>
              </li>

              <li className="nexora-nav-item">
                <button
                  className={`nexora-nav-link ${currentRoute === '/insights' ? 'active' : ''}`}
                  onClick={() => onNavigate('/insights')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <BookOpen size={15} />
                  <span>Research &amp; Insights</span>
                </button>
              </li>

              <li className="nexora-nav-item">
                <button
                  className={`nexora-nav-link ${currentRoute === '/contact' ? 'active' : ''}`}
                  onClick={() => onNavigate('/contact')}
                >
                  Contact &amp; Support
                </button>
              </li>
            </ul>
          </nav>

          {/* Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* USSD Simulator Launcher */}
            <button
              className="btn btn-secondary btn-sm desktop-only"
              onClick={onOpenUssd}
              title="Open USSD Simulator (*334#)"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <PhoneCall size={14} style={{ color: 'var(--warm-stone)' }} />
              <span>*334# USSD</span>
            </button>

            {/* Theme Toggle */}
            <button
              className="btn btn-secondary btn-icon"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle visual theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* User Session Pill or Login Trigger */}
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-stone tabular-nums desktop-only" style={{ fontSize: 12 }}>
                  {currentUser.phone || currentUser.name || 'Active Account'}
                </span>

                <button
                  className="btn btn-secondary btn-icon"
                  onClick={onOpenSettings}
                  title="Policy Settings"
                  aria-label="Settings"
                >
                  <Settings size={15} />
                </button>

                <button
                  className="btn btn-secondary btn-icon"
                  onClick={onLogout}
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onNavigate('/')}
                style={{ fontWeight: 600, padding: '8px 18px' }}
              >
                <span>Sign In</span>
                <ArrowRight size={13} className="desktop-only" />
              </button>
            )}

            {/* Mobile Hamburger Button */}
            <button
              className="btn btn-secondary btn-icon mobile-only"
              onClick={onOpenMobileMenu}
              aria-label="Open navigation drawer"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
