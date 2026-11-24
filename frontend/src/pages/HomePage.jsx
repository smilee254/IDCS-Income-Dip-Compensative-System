import React from 'react';
import { 
  TrendingUp, Shield, LineChart, ArrowRight, ArrowUpRight, 
  CheckCircle2, Compass, Activity, FileText, Check 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

export default function HomePage({ onNavigate, theme }) {
  const isLight = theme === 'light';

  // Sample Bayesian volatility projection for the hero visual card
  const heroCurveData = [
    { period: 'Q1', revenue: 42000, floor: 35000, upperBand: 48000 },
    { period: 'Q2', revenue: 45000, floor: 35000, upperBand: 52000 },
    { period: 'Q3', revenue: 39000, floor: 35000, upperBand: 47000 },
    { period: 'Q4', revenue: 34500, floor: 35000, upperBand: 46000 }, // dip
    { period: 'Q5', revenue: 47000, floor: 35000, upperBand: 54000 },
    { period: 'Q6', revenue: 51000, floor: 35000, upperBand: 58000 },
  ];

  return (
    <div className="home-page-container">
      {/* ── 1. Split Hero ────────────────────────────────────────────── */}
      <section className="split-hero">
        <div className="hero-content">
          <div className="hero-overline">
            ACTUARIAL · RISK · ADVISORY
          </div>
          <h1 className="hero-headline">
            Clarity in complexity.<br />
            <em>Confidence in decisions.</em>
          </h1>
          <p className="hero-lead">
            We transform financial uncertainty into measurable insights, institutional resilience, and strategic direction.
          </p>

          <div className="hero-cta-group">
            <button 
              className="btn btn-primary"
              onClick={() => onNavigate('/services')}
              style={{ padding: '14px 28px', fontSize: 15 }}
            >
              Explore our services <ArrowRight size={16} />
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => onNavigate('/contact')}
              style={{ padding: '14px 24px', fontSize: 15 }}
            >
              Request a consultation
            </button>
          </div>
        </div>

        {/* Hero Visual Card: Live Analytical Corridor */}
        <div className="hero-visual-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--warm-stone)', fontWeight: 700 }}>
                Quantitative Risk Model
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--primary-text)' }}>
                Parametric Volatility Corridor
              </div>
            </div>
            <span className="badge badge-stone tabular-nums">95% CI</span>
          </div>

          <div style={{ height: 200, width: '100%', margin: '10px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={heroCurveData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="heroGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isLight ? '#101828' : '#B7A78B'} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={isLight ? '#101828' : '#B7A78B'} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="period" stroke="var(--border-color)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis stroke="var(--border-color)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => `${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: 12 }} 
                  formatter={(v, name) => [`KES ${v.toLocaleString()}`, name === 'revenue' ? 'Observed Flow' : 'Threshold']}
                />
                <ReferenceLine y={35000} stroke={isLight ? '#9A5B04' : '#E8A638'} strokeDasharray="3 3" label={{ value: 'Dip Floor', fill: isLight ? '#9A5B04' : '#E8A638', fontSize: 10, position: 'insideTopLeft' }} />
                <Area type="monotone" dataKey="revenue" stroke={isLight ? '#101828' : '#B7A78B'} strokeWidth={2} fill="url(#heroGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Baseline (µ)</div>
              <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary-text)' }}>KES 43,500</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Volatility (σ)</div>
              <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: 'var(--warm-stone)' }}>12.4%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Safety Floor</div>
              <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: 'var(--semantic-success-text)' }}>KES 35,000</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Three Service Divisions ─────────────────────────────────── */}
      <section style={{ margin: '40px 0 80px' }}>
        <div style={{ marginBottom: 32 }}>
          <div className="hero-overline">EXPERT PRACTICES</div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 700, color: 'var(--primary-text)' }}>
            Expertise across the financial landscape.
          </h2>
        </div>

        <div className="divisions-grid">
          {/* Actuarial Science */}
          <div className="division-box">
            <div>
              <div className="division-num">01 / 03</div>
              <h3 className="division-heading">Actuarial Science</h3>
              <p className="division-text">
                Mathematical and statistical expertise applied to financial risk, product pricing, reserve adequacy, and long-term liabilities.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} style={{ color: 'var(--warm-stone)' }} /> Policy pricing &amp; premium rate determination
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} style={{ color: 'var(--warm-stone)' }} /> Liability valuation &amp; capital adequacy
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} style={{ color: 'var(--warm-stone)' }} /> Stochastic forecasting &amp; stress testing
                </li>
              </ul>
            </div>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('/services/actuarial-science')}
              style={{ width: '100%', justifyContent: 'space-between' }}
            >
              <span>Explore division</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Risk & Insurance */}
          <div className="division-box">
            <div>
              <div className="division-num">02 / 03</div>
              <h3 className="division-heading">Risk &amp; Insurance</h3>
              <p className="division-text">
                Identifying, quantifying, and mitigating exposure across commercial environments with parametric and indemnity frameworks.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} style={{ color: 'var(--warm-stone)' }} /> Parametric micro-protection architecture
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} style={{ color: 'var(--warm-stone)' }} /> Enterprise risk assessment &amp; audit
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} style={{ color: 'var(--warm-stone)' }} /> Reinsurance optimization &amp; claims analytics
                </li>
              </ul>
            </div>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('/services/risk-and-insurance')}
              style={{ width: '100%', justifyContent: 'space-between' }}
            >
              <span>Explore division</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Financial Advisory */}
          <div className="division-box">
            <div>
              <div className="division-num">03 / 03</div>
              <h3 className="division-heading">Financial Advisory</h3>
              <p className="division-text">
                Structured financial analysis, liquidity management, and strategic balance-sheet guidance for sustainable capital durability.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} style={{ color: 'var(--warm-stone)' }} /> Strategic financial planning &amp; scenario models
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} style={{ color: 'var(--warm-stone)' }} /> Liquidity stress-testing &amp; cash-flow audit
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} style={{ color: 'var(--warm-stone)' }} /> Institutional governance &amp; capital allocation
                </li>
              </ul>
            </div>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('/services/financial-advisory')}
              style={{ width: '100%', justifyContent: 'space-between' }}
            >
              <span>Explore division</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ── 3. Methodology & Approach ─────────────────────────────────── */}
      <section style={{ margin: '80px 0', padding: '48px 36px', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        <div style={{ maxWidth: 640 }}>
          <div className="hero-overline">OUR DISCIPLINED METHODOLOGY</div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 700, color: 'var(--primary-text)' }}>
            A disciplined approach to uncertainty.
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, marginTop: 10 }}>
            Every engagement follows a structured, repeatable analytical framework designed to replace assumption with empirical precision.
          </p>
        </div>

        <div className="methodology-strip">
          <div className="methodology-step">
            <div className="step-num">01 / DISCOVER</div>
            <div className="step-title">Ingest &amp; Baseline</div>
            <div className="step-desc">
              Comprehensive data audit, cashflow ingestion, and historical volatility baselining.
            </div>
          </div>

          <div className="methodology-step">
            <div className="step-num">02 / ANALYSE</div>
            <div className="step-title">Stochastic Modeling</div>
            <div className="step-desc">
              Bayesian probability distributions, tail-risk simulations, and stress testing.
            </div>
          </div>

          <div className="methodology-step">
            <div className="step-num">03 / ADVISE</div>
            <div className="step-title">Strategic Architecture</div>
            <div className="step-desc">
              Bespoke parametric thresholds, risk pricing, and capital allocation strategies.
            </div>
          </div>

          <div className="methodology-step">
            <div className="step-num">04 / MONITOR</div>
            <div className="step-title">Continuous Governance</div>
            <div className="step-desc">
              Automated trigger monitoring, dynamic recalibration, and audited disbursements.
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Featured Insights / Research ──────────────────────────── */}
      <section style={{ margin: '80px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="hero-overline">KNOWLEDGE &amp; PERSPECTIVES</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 700, color: 'var(--primary-text)' }}>
              Perspectives that inform decisions.
            </h2>
          </div>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('/insights')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>View all publications</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="insights-grid">
          <div className="publication-card" onClick={() => onNavigate('/insights')}>
            <div>
              <div className="pub-category">Research · Financial Risk</div>
              <h3 className="pub-title">Measuring financial uncertainty in changing economic conditions</h3>
              <p className="pub-excerpt">
                An analysis of non-stationary income volatility in developing markets and the calibration of parametric downside buffers.
              </p>
            </div>
            <div className="pub-meta">
              <span>Dr. E. Vance, FSA</span>
              <span>·</span>
              <span>8 min read</span>
            </div>
          </div>

          <div className="publication-card" onClick={() => onNavigate('/insights')}>
            <div>
              <div className="pub-category">Actuarial · Insurance</div>
              <h3 className="pub-title">Understanding the evolving parametric protection landscape</h3>
              <p className="pub-excerpt">
                Why index-based settlement mechanisms eliminate moral hazard and dramatically lower loss-adjustment expenses.
              </p>
            </div>
            <div className="pub-meta">
              <span>M. Thornton, FIA</span>
              <span>·</span>
              <span>6 min read</span>
            </div>
          </div>

          <div className="publication-card" onClick={() => onNavigate('/insights')}>
            <div>
              <div className="pub-category">Quantitative Methods</div>
              <h3 className="pub-title">Statistical forecasting in independent business planning</h3>
              <p className="pub-excerpt">
                Applying Bayesian priors to micro-enterprise turnover for robust liquidity projection under extreme seasonal fluctuations.
              </p>
            </div>
            <div className="pub-meta">
              <span>Actuarial Research Unit</span>
              <span>·</span>
              <span>10 min read</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Trust Indicators & Credentials ────────────────────────── */}
      <section style={{ margin: '60px 0', borderTop: '1px solid var(--border-color)', paddingTop: 48 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ color: 'var(--warm-stone)', marginTop: 2 }}>
              <Shield size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-text)', marginBottom: 4 }}>
                Actuarial Standards Board
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Modeling methodologies adhere strictly to international actuarial practice standards and regulatory governance.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ color: 'var(--warm-stone)', marginTop: 2 }}>
              <Activity size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-text)', marginBottom: 4 }}>
                Bayesian Empirical Precision
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Continuous updating of income baselines utilizing verified M-Pesa transaction velocity and cash records.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ color: 'var(--warm-stone)', marginTop: 2 }}>
              <FileText size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-text)', marginBottom: 4 }}>
                Independent &amp; Objective
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Unbiased quantitative evaluation designed to provide balance-sheet durability without product-push conflicts.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Consultation Call to Action ────────────────────────────── */}
      <section style={{ 
        margin: '60px 0 20px', 
        padding: '54px 40px', 
        backgroundColor: 'var(--bg-card)', 
        border: '1px solid var(--border-color)', 
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 24
      }}>
        <div style={{ maxWidth: 580 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 10 }}>
            Let's make your next decision a better-informed one.
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.5 }}>
            Start a conversation with our actuarial and financial advisory team to evaluate your institutional exposure.
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => onNavigate('/contact')}
          style={{ padding: '14px 32px', fontSize: 15, fontWeight: 600 }}
        >
          Request a consultation <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}
