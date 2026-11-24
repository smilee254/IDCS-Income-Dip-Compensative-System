import React from 'react';
import { TrendingUp, Shield, LineChart, ArrowRight } from 'lucide-react';

export default function MegaMenu({ isOpen, onClose, onNavigate }) {
  if (!isOpen) return null;

  const divisions = [
    {
      id: 'actuarial-science',
      title: 'Actuarial Science',
      desc: 'Valuation, pricing, stochastic modelling and balance sheet forecasting.',
      icon: TrendingUp,
      route: '/services/actuarial-science'
    },
    {
      id: 'risk-and-insurance',
      title: 'Risk & Insurance',
      desc: 'Enterprise risk assessment, parametric program design and insurance analytics.',
      icon: Shield,
      route: '/services/risk-and-insurance'
    },
    {
      id: 'financial-advisory',
      title: 'Financial Advisory',
      desc: 'Financial planning, liquidity stress-testing and strategic advisory.',
      icon: LineChart,
      route: '/services/financial-advisory'
    }
  ];

  return (
    <div 
      className="mega-menu-container"
      onMouseLeave={onClose}
      role="menu"
      aria-label="Services Division Menu"
    >
      {divisions.map((div) => {
        const Icon = div.icon;
        return (
          <div
            key={div.id}
            className="mega-menu-card"
            onClick={() => {
              onNavigate(div.route);
              onClose();
            }}
            role="menuitem"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigate(div.route);
                onClose();
              }
            }}
          >
            <div>
              <div className="mega-menu-icon">
                <Icon size={18} />
              </div>
              <div className="mega-menu-title">{div.title}</div>
              <div className="mega-menu-desc">{div.desc}</div>
            </div>
            <div className="mega-menu-cta">
              Explore division <ArrowRight size={13} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
