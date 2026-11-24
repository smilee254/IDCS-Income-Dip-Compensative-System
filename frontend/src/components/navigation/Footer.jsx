import React from 'react';

export default function Footer({ onNavigate }) {
  return (
    <footer className="nexora-footer">
      <div className="nexora-container">
        <div className="footer-top" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          {/* Brand Column */}
          <div>
            <div 
              className="nexora-brand"
              onClick={() => onNavigate('/')}
              style={{ cursor: 'pointer', marginBottom: 14 }}
            >
              <div className="nexora-brand-mark" style={{ width: 'auto', padding: '0 10px', fontSize: 15 }}>
                IDCS
              </div>
              <div className="nexora-brand-text">
                <span className="nexora-brand-title">IDCS</span>
                <span className="nexora-brand-subtitle">INCOME DIP COMPENSATIVE SYSTEM</span>
              </div>
            </div>
            <p className="footer-brand-desc" style={{ maxWidth: 460 }}>
              Empirical actuarial risk modeling, parametric income dip protection, and automated M-Pesa safety nets for Kenya's independent enterprise.
            </p>
          </div>

          {/* Knowledge, Tools & Disclaimers Links (Company & Services removed as requested) */}
          <div>
            <div className="footer-col-title">Knowledge &amp; Governance</div>
            <ul className="footer-links">
              <li><a onClick={() => onNavigate('/')}>IDCS Protection Dashboard</a></li>
              <li><a onClick={() => onNavigate('/resources')}>Parametric Risk &amp; Floor Calculator</a></li>
              <li><a onClick={() => onNavigate('/insights')}>Actuarial Research &amp; Publications</a></li>
              <li><a onClick={() => onNavigate('/contact')}>Advisory &amp; Support Inquiries</a></li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <div>
            &copy; 2026 IDCS (Income Dip Compensative System). All rights reserved.
          </div>
          <div style={{ maxWidth: 640, textAlign: 'right', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Actuarial modeling and parametric protection parameters are calibrated from empirical transaction velocity in compliance with applicable risk governance standards. Indicative calculations do not constitute binding valuation certificates without formal portfolio engagement.
          </div>
        </div>
      </div>
    </footer>
  );
}
