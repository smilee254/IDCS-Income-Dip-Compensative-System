import React from 'react';
import { 
  X, Sun, Moon, ArrowRight, ShieldCheck, PhoneCall, 
  Calculator, BookOpen, LayoutDashboard, Settings, LogOut 
} from 'lucide-react';

export default function MobileDrawer({
  isOpen,
  onClose,
  currentRoute,
  onNavigate,
  theme,
  onToggleTheme,
  currentUser,
  onLogout,
  onOpenSettings,
  onOpenUssd
}) {
  if (!isOpen) return null;

  const handleLinkClick = (route) => {
    onNavigate(route);
    onClose();
  };

  return (
    <div className="mobile-drawer-backdrop" onClick={onClose}>
      <div 
        className="mobile-drawer-panel" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation"
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="nexora-brand-mark" style={{ width: 'auto', padding: '0 8px', fontSize: 14 }}>
              IDCS
            </div>
            <div className="nexora-brand-text">
              <span className="nexora-brand-title" style={{ fontSize: 16 }}>IDCS</span>
              <span className="nexora-brand-subtitle" style={{ fontSize: 9 }}>INCOME PROTECTION</span>
            </div>
          </div>
          <button 
            className="btn btn-secondary btn-icon"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Links List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
          <button
            className={`btn ${currentRoute === '/' ? 'btn-secondary' : ''}`}
            onClick={() => handleLinkClick('/')}
            style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: 15, textAlign: 'left', background: currentRoute === '/' ? 'var(--bg-card-subtle)' : 'transparent', border: 'none', display: 'flex', gap: 10 }}
          >
            <LayoutDashboard size={16} />
            <span>Protection Dashboard</span>
          </button>

          <button
            className={`btn ${currentRoute === '/resources' ? 'btn-secondary' : ''}`}
            onClick={() => handleLinkClick('/resources')}
            style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: 15, textAlign: 'left', background: currentRoute === '/resources' ? 'var(--bg-card-subtle)' : 'transparent', border: 'none', display: 'flex', gap: 10 }}
          >
            <Calculator size={16} />
            <span>Risk &amp; Floor Calculator</span>
          </button>

          <button
            className={`btn ${currentRoute === '/insights' ? 'btn-secondary' : ''}`}
            onClick={() => handleLinkClick('/insights')}
            style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: 15, textAlign: 'left', background: currentRoute === '/insights' ? 'var(--bg-card-subtle)' : 'transparent', border: 'none', display: 'flex', gap: 10 }}
          >
            <BookOpen size={16} />
            <span>Research &amp; Insights</span>
          </button>

          <button
            className={`btn ${currentRoute === '/contact' ? 'btn-secondary' : ''}`}
            onClick={() => handleLinkClick('/contact')}
            style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: 15, textAlign: 'left', background: currentRoute === '/contact' ? 'var(--bg-card-subtle)' : 'transparent', border: 'none' }}
          >
            Contact &amp; Support
          </button>

          <div style={{ height: 1, backgroundColor: 'var(--border-color)', margin: '12px 0' }} />

          {/* USSD Simulator */}
          <button
            onClick={() => {
              onClose();
              onOpenUssd();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              color: 'var(--warm-stone)',
              background: 'var(--warm-stone-subtle)',
              border: '1px solid var(--warm-stone-border)',
              cursor: 'pointer'
            }}
          >
            <PhoneCall size={16} />
            <span>USSD Simulator (*334#)</span>
          </button>
        </div>

        {/* Footer actions */}
        <div style={{ paddingTop: 20, borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {currentUser ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { onClose(); onOpenSettings(); }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Settings size={14} />
                <span>Settings</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { onClose(); onLogout(); }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => handleLinkClick('/')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Sign In to IDCS <ArrowRight size={14} />
            </button>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Appearance</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onToggleTheme}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
