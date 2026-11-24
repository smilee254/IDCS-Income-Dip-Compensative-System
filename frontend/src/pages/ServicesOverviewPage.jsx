import React from 'react';
import { TrendingUp, Shield, LineChart, ArrowRight, Check } from 'lucide-react';

export default function ServicesOverviewPage({ onNavigate }) {
  const divisions = [
    {
      id: 'actuarial-science',
      num: '01 / 03',
      title: 'Actuarial Science',
      tagline: 'Mathematical and statistical expertise applied to financial risk and uncertainty.',
      description: 'We deliver comprehensive actuarial modeling, pricing frameworks, and statutory reserve valuations. Our models translate complex probabilistic scenarios into precise capital allocation and liability forecasts.',
      capabilities: [
        'Parametric policy pricing & premium rate determination',
        'Stochastic loss modeling & solvency stress testing',
        'Balance sheet liability valuation & reserving',
        'Mortality, morbidity & turnover distribution modeling'
      ],
      route: '/services/actuarial-science'
    },
    {
      id: 'risk-and-insurance',
      num: '02 / 03',
      title: 'Risk & Insurance',
      tagline: 'Identifying, quantifying, and managing exposure across commercial environments.',
      description: 'We design bespoke risk transfer mechanisms, parametric micro-protection programs, and enterprise risk management protocols to insulate cashflows against unpredictable macroeconomic and operational shocks.',
      capabilities: [
        'Parametric safety floor architecture & index design',
        'Enterprise risk audits & quantitative heat-maps',
        'Reinsurance program optimization & capacity sizing',
        'Automated algorithmic claims adjudication protocols'
      ],
      route: '/services/risk-and-insurance'
    },
    {
      id: 'financial-advisory',
      num: '03 / 03',
      title: 'Financial Advisory',
      tagline: 'Structured financial analysis and strategic guidance for sustainable decisions.',
      description: 'We partner with enterprise leadership to provide strategic liquidity planning, capital structure optimization, and quantitative decision analysis that withstands shifting market dynamics.',
      capabilities: [
        'Dynamic working capital & liquidity stress testing',
        'Corporate financial planning & multi-scenario forecasting',
        'Capital allocation strategy & debt capacity analysis',
        'Institutional risk governance & board advisory'
      ],
      route: '/services/financial-advisory'
    }
  ];

  return (
    <div className="services-overview-page" style={{ padding: '40px 0 80px' }}>
      <section style={{ maxWidth: 840, marginBottom: 54 }}>
        <div className="hero-overline">PRACTICE DIVISIONS</div>
        <h1 style={{ 
          fontFamily: 'var(--font-serif)', 
          fontSize: 48, 
          fontWeight: 700, 
          color: 'var(--primary-text)', 
          lineHeight: 1.15,
          marginBottom: 16 
        }}>
          Disciplined expertise across the risk spectrum.
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          IDCS Parametric Protection Systems organize risk mitigation into three automated underwriting tiers. Each tier dynamically adjusts micro-contributions and parametric dip floors.
        </p>
      </section>

      {/* 3 Large Service Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginBottom: 72 }}>
        {divisions.map((div) => (
          <div 
            key={div.id}
            className="card"
            style={{ 
              padding: '36px', 
              display: 'grid', 
              gridTemplateColumns: '1.2fr 1fr', 
              gap: 40,
              alignItems: 'center',
              transition: 'border-color 0.2s ease'
            }}
          >
            <div>
              <div style={{ fontSize: 12, letterSpacing: 1.5, color: 'var(--warm-stone)', fontWeight: 700, marginBottom: 12 }}>
                {div.num}
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 10 }}>
                {div.title}
              </h2>
              <div style={{ fontSize: 16, color: 'var(--warm-stone)', fontWeight: 500, marginBottom: 16 }}>
                {div.tagline}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.65, marginBottom: 24 }}>
                {div.description}
              </p>
              <button 
                className="btn btn-primary"
                onClick={() => onNavigate(div.route)}
                style={{ padding: '10px 22px' }}
              >
                <span>Explore division in detail</span>
                <ArrowRight size={15} />
              </button>
            </div>

            <div style={{ 
              backgroundColor: 'var(--bg-card-subtle)', 
              borderRadius: 'var(--radius-md)', 
              padding: '24px 28px',
              border: '1px solid var(--border-color)' 
            }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 14 }}>
                Core Capabilities
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {div.capabilities.map((cap, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--primary-text)', lineHeight: 1.45 }}>
                    <Check size={16} style={{ color: 'var(--warm-stone)', flexShrink: 0, marginTop: 1 }} />
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Engagement Note */}
      <section style={{ 
        padding: '36px', 
        backgroundColor: 'var(--bg-card-subtle)', 
        borderRadius: 'var(--radius-md)', 
        border: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 20
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary-text)', marginBottom: 4 }}>
            Need a multidisciplinary engagement?
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Many client challenges span across both Actuarial Modeling and Strategic Financial Advisory.
          </div>
        </div>
        <button 
          className="btn btn-secondary"
          onClick={() => onNavigate('/contact')}
        >
          Consult on Scoping <ArrowRight size={14} />
        </button>
      </section>
    </div>
  );
}
