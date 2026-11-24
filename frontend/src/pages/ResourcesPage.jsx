import React, { useState } from 'react';
import { 
  Calculator, FileText, Download, Cpu, 
  ShieldCheck, Info, ArrowRight, CheckCircle2 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

export default function ResourcesPage({ onNavigate, theme }) {
  const isLight = theme === 'light';

  // Calculator State
  const [monthlyTurnover, setMonthlyTurnover] = useState(60000);
  const [volatilityLevel, setVolatilityLevel] = useState(0.20); // 20% std dev
  const [floorTriggerPct, setFloorTriggerPct] = useState(0.80); // 80%

  // Automated Underwriting Calculations
  const baseline = Number(monthlyTurnover) || 0;
  const dipFloor = Math.round(baseline * floorTriggerPct);
  const estimatedDipProb = Math.min(Math.round((volatilityLevel * 100) * 1.4), 45);
  const microRateEstimate = (0.012 + (volatilityLevel * 0.02)).toFixed(2);
  const maxIndemnity = Math.round(dipFloor * 0.9);

  // Synthetic 6-month Prophet Projection ($y$ vs $ds$)
  const prophetForecastData = [
    { month: 'Month 1', historical: baseline, predicted: baseline, deficiencyZone: 0 },
    { month: 'Month 2', historical: Math.round(baseline * 1.05), predicted: Math.round(baseline * 1.02), deficiencyZone: 0 },
    { month: 'Month 3 (School Fees)', historical: null, predicted: Math.round(baseline * 0.76), deficiencyZone: Math.round(dipFloor - baseline * 0.76) },
    { month: 'Month 4', historical: null, predicted: Math.round(baseline * 0.88), deficiencyZone: 0 },
    { month: 'Month 5', historical: null, predicted: Math.round(baseline * 1.10), deficiencyZone: 0 },
    { month: 'Month 6 (Holidays)', historical: null, predicted: Math.round(baseline * 1.18), deficiencyZone: 0 },
  ];

  return (
    <div className="resources-page" style={{ padding: '32px 0 80px' }}>
      {/* ── 1. Hero ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 840, marginBottom: 40 }}>
        <div className="hero-overline">IDCS PREDICTIVE UNDERWRITING TOOLS</div>
        <h1 style={{ 
          fontFamily: 'var(--font-serif)', 
          fontSize: 44, 
          fontWeight: 700, 
          color: 'var(--primary-text)', 
          lineHeight: 1.15,
          marginBottom: 14 
        }}>
          Prophet Risk Simulator &amp; Modeling Assets
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Explore the mechanics of Facebook Prophet time-series income forecasting, dynamic deficiency zone prediction, and algorithmic parametric compensation.
        </p>
      </section>

      {/* ── 2. Interactive Prophet Risk Simulator ───────────────────── */}
      <section style={{ marginBottom: 64 }}>
        <div className="card" style={{ padding: '36px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '8px',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--warm-stone-border)',
              color: 'var(--warm-stone)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Cpu size={18} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--primary-text)' }}>
                Prophet 6-Month Income Forecast &amp; Deficiency Simulator
              </h2>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28, maxWidth: 840 }}>
            Simulate how IDCS plots $y$ (income) against $ds$ (time), accounts for Kenyan seasonal spikes (e.g. school fees), and isolates future deficiency zones where payouts trigger.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 40, alignItems: 'flex-start' }}>
            {/* Input Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--primary-text)', marginBottom: 8 }}>
                  <span>Baseline Monthly Turnover (KES)</span>
                  <span className="tabular-nums" style={{ color: 'var(--warm-stone)', fontWeight: 700 }}>
                    KES {Number(monthlyTurnover).toLocaleString()}
                  </span>
                </label>
                <input 
                  type="range"
                  min="15000"
                  max="300000"
                  step="5000"
                  value={monthlyTurnover}
                  onChange={(e) => setMonthlyTurnover(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--warm-stone)', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  <span>KES 15,000 (Mama Mboga / Boda)</span>
                  <span>KES 300,000 (Duka / Wholesale)</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--primary-text)', marginBottom: 8 }}>
                  <span>Income Volatility (σ - Seasonal Shock)</span>
                  <span className="tabular-nums" style={{ color: 'var(--warm-stone)', fontWeight: 700 }}>
                    {(volatilityLevel * 100).toFixed(0)}% std dev
                  </span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { label: 'Low (10%)', val: 0.10 },
                    { label: 'Moderate (20%)', val: 0.20 },
                    { label: 'High (35%)', val: 0.35 }
                  ].map(lvl => (
                    <button
                      key={lvl.val}
                      className={`btn btn-sm ${volatilityLevel === lvl.val ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setVolatilityLevel(lvl.val)}
                      style={{ fontSize: 12, padding: '8px' }}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--primary-text)', marginBottom: 8 }}>
                  <span>Parametric Dip Floor Threshold</span>
                  <span className="tabular-nums" style={{ color: 'var(--warm-stone)', fontWeight: 700 }}>
                    {(floorTriggerPct * 100).toFixed(0)}% of baseline
                  </span>
                </label>
                <input 
                  type="range"
                  min="0.70"
                  max="0.90"
                  step="0.05"
                  value={floorTriggerPct}
                  onChange={(e) => setFloorTriggerPct(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--warm-stone)', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  <span>70% (Deep Dip)</span>
                  <span>80% (Standard Floor)</span>
                  <span>90% (Strict)</span>
                </div>
              </div>

              <div style={{
                padding: '14px 16px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start'
              }}>
                <Info size={16} style={{ color: 'var(--warm-stone)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <strong>How the Algorithm Works:</strong> IDCS feeds cleaned turnover data into Facebook Prophet to establish rolling seasonal baselines. Dips below the 80% threshold trigger automated payouts directly to M-Pesa.
                </div>
              </div>
            </div>

            {/* Output Visual & Computed Metrics */}
            <div style={{ 
              backgroundColor: 'var(--bg-card-subtle)', 
              borderRadius: 'var(--radius-md)', 
              padding: '28px',
              border: '1px solid var(--border-color)' 
            }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 14 }}>
                Prophet 6-Month Projection ($y$ vs $ds$)
              </div>

              <div style={{ height: 190, width: '100%', margin: '10px 0 20px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={prophetForecastData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="prophetGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isLight ? '#101828' : '#B7A78B'} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={isLight ? '#101828' : '#B7A78B'} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" stroke="var(--border-color)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                    <YAxis stroke="var(--border-color)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={(v) => `${v/1000}k`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: 12 }} 
                      formatter={(v) => [`KES ${v ? v.toLocaleString() : 0}`, 'Income']}
                    />
                    <ReferenceLine y={dipFloor} stroke={isLight ? '#9A5B04' : '#E8A638'} strokeDasharray="3 3" label={{ value: `Floor: ${dipFloor/1000}k`, fill: isLight ? '#9A5B04' : '#E8A638', fontSize: 10, position: 'insideTopLeft' }} />
                    <Area type="monotone" dataKey="predicted" stroke={isLight ? '#101828' : '#B7A78B'} strokeWidth={2} fill="url(#prophetGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* 4 Computed Underwriting Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Protected Floor</div>
                  <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary-text)' }}>
                    KES {dipFloor.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Monthly safety limit</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dip Probability</div>
                  <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: 'var(--warm-stone)' }}>
                    ~{estimatedDipProb}%
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Prophet risk score</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Micro-Contribution</div>
                  <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: 'var(--semantic-success-text)' }}>
                    {microRateEstimate}%
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Auto-deducted per sale</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Max Payout Limit</div>
                  <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary-text)' }}>
                    KES {maxIndemnity.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Instant M-Pesa disbursement</div>
                </div>
              </div>

              <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-subtle)' }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => onNavigate('/')}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Open Live Protection Dashboard <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Technical Whitepapers ─────────────────────────────────── */}
      <section>
        <div className="hero-overline">IDCS TECHNICAL SPECIFICATIONS</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 24 }}>
          Algorithmic Architecture &amp; System Papers
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--warm-stone)', fontWeight: 700 }}>
                Prophet AI Architecture
              </div>
              <span className="badge badge-stone">Technical Brief</span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 8 }}>
              Time-Series Forecasting for the Kenyan Gig Economy
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
              How IDCS fine-tunes Facebook Prophet with Kenyan holiday schedules, school-fee cycles, and external sector regressors to model micro-enterprise income.
            </p>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('/insights')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Read Specification <ArrowRight size={14} />
            </button>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--warm-stone)', fontWeight: 700 }}>
                Underwriting &amp; Anti-Fraud
              </div>
              <span className="badge badge-stone">System Architecture</span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 8 }}>
              Commercial Inflow Filtering &amp; Chama Trust Squads
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
              The multi-layer gating system: filtering out Fuliza/M-Shwari loans and P2P transfers via KDPA-compliant hashing, combined with peer-vouching networks.
            </p>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('/insights')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Read Specification <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
