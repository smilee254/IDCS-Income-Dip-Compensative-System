import React, { useState } from 'react';
import { BookOpen, FileText, Download, Calendar, User, Clock, ArrowRight, X, Cpu, ShieldCheck } from 'lucide-react';

const publications = [
  {
    id: 1,
    category: 'AI & Time-Series Forecasting',
    categoryKey: 'prophet-ai',
    title: 'Fine-Tuning Facebook Prophet for Kenyan Gig Economy Income Prediction',
    abstract: 'How IDCS leverages Facebook Prophet to plot monthly revenue ($y$) against time ($ds$), embedding Kenyan holiday calendars and school-fee cycles as external regressors to isolate deficiency zones and predict income dips.',
    author: 'IDCS AI & Actuarial Engineering Team',
    date: 'February 2026',
    readTime: '8 min read',
    featured: true,
    citations: 'IDCS Technical Report TR-2026-01: Time-Series Income Deficiencies in Mobile Commerce.',
    body: `
### 1. The Challenge of Informal Income Forecasting
Informal and gig enterprise turnover in Kenya does not follow smooth Gaussian curves. It exhibits sharp seasonality driven by school fee payments (January, May, September), public holidays (Madaraka Day, Jamhuri Day, Christmas), and localized rainfall patterns.

### 2. Facebook Prophet Architecture in IDCS
IDCS converts daily verified M-Pesa turnover into a monthly time-series dataframe:
\`\`\`python
df_prophet = df_monthly.rename(columns={'Total Income': 'y', 'month': 'ds'})
\`\`\`
The model injects external regressors including \`sector_dip\` and a tailored Kenyan holiday calendar to prevent seasonal shifts from being misinterpreted as permanent business failures.

### 3. Deficiency Zone Detection
When the 6-month Prophet forward trajectory drops below the calibrated dip floor ($0.8 \\times \\mu$), IDCS flags a "Deficiency Zone" and alerts the policyholder, triggering dynamic micro-deduction adjustments and proactive liquidity reserves.
    `
  },
  {
    id: 2,
    category: 'Automated Underwriting',
    categoryKey: 'underwriting',
    title: 'Parametric Indemnity: Eliminating Loss Adjusters with Real-Time Daraja Ingestion',
    abstract: 'Why traditional insurance claims fail informal merchants due to manual inspection costs, and how algorithmic threshold triggers disburse compensation directly to M-Pesa in seconds.',
    author: 'IDCS Underwriting Systems Group',
    date: 'January 2026',
    readTime: '6 min read',
    featured: false
  },
  {
    id: 3,
    category: 'Anti-Fraud & Defense',
    categoryKey: 'chama-defense',
    title: 'The Chama Trust Network: Decentralized Peer-Attestation for Idle Business Detection',
    abstract: 'When turnover flatlines, is the merchant experiencing a macro dip or did they shutter operations? How IDCS utilizes rotating Chama circles to vouch for active trade and prevent fraudulent claims.',
    author: 'IDCS Community Risk Protocol',
    date: 'December 2025',
    readTime: '7 min read',
    featured: false
  },
  {
    id: 4,
    category: 'Data Engineering & Privacy',
    categoryKey: 'data-engineering',
    title: 'Real-Time Commercial Inflow Classification on Safaricom Daraja API',
    abstract: 'Automated heuristics for isolating business revenue from Fuliza overdrafts, M-Shwari digital credit, and friendly P2P transfers using KDPA-compliant SHA-256 phone hashing.',
    author: 'Inflow Classification Research Unit',
    date: 'November 2025',
    readTime: '9 min read',
    featured: false
  }
];

export default function InsightsPage({ onNavigate }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [readingArticle, setReadingArticle] = useState(null);

  const categories = [
    { key: 'all', label: 'All Articles' },
    { key: 'prophet-ai', label: 'Prophet AI Forecasting' },
    { key: 'underwriting', label: 'Automated Underwriting' },
    { key: 'chama-defense', label: 'Chama Trust Defense' },
    { key: 'data-engineering', label: 'Data & Inflow Classification' }
  ];

  const filtered = selectedCategory === 'all'
    ? publications
    : publications.filter(p => p.categoryKey === selectedCategory);

  const featured = publications.find(p => p.featured);

  return (
    <div className="insights-page" style={{ padding: '32px 0 80px' }}>
      {/* ── 1. Hero ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 840, marginBottom: 40 }}>
        <div className="hero-overline">IDCS TECHNICAL SPECIFICATIONS &amp; METHODOLOGY</div>
        <h1 style={{ 
          fontFamily: 'var(--font-serif)', 
          fontSize: 44, 
          fontWeight: 700, 
          color: 'var(--primary-text)', 
          lineHeight: 1.15,
          marginBottom: 14 
        }}>
          AI Underwriting &amp; Forecasting Architecture
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Technical whitepapers on Facebook Prophet income modeling, algorithmic claims adjudication, and decentralized Chama peer verification.
        </p>
      </section>

      {/* ── 2. Featured Paper ───────────────────────────────────────── */}
      {featured && (
        <section 
          className="card"
          style={{ 
            padding: '36px', 
            marginBottom: 48, 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease'
          }}
          onClick={() => setReadingArticle(featured)}
        >
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--warm-stone)', fontWeight: 700, marginBottom: 10 }}>
            Featured Technical Brief · {featured.category}
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 12, lineHeight: 1.25 }}>
            {featured.title}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, maxWidth: 900, marginBottom: 20 }}>
            {featured.abstract}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-dim)' }}>
              <span>{featured.author}</span>
              <span>·</span>
              <span>{featured.date}</span>
              <span>·</span>
              <span>{featured.readTime}</span>
            </div>

            <button 
              className="btn btn-primary btn-sm"
              onClick={(e) => { e.stopPropagation(); setReadingArticle(featured); }}
            >
              Read full specification <ArrowRight size={14} />
            </button>
          </div>
        </section>
      )}

      {/* ── 3. Category Filter Bar ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 28 }}>
        {categories.map((c) => (
          <button
            key={c.key}
            className={`btn btn-sm ${selectedCategory === c.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedCategory(c.key)}
            style={{ whiteSpace: 'nowrap', fontSize: 12 }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* ── 4. Publication Grid ─────────────────────────────────────── */}
      <div className="insights-grid">
        {filtered.map((pub) => (
          <div 
            key={pub.id}
            className="publication-card"
            onClick={() => setReadingArticle(pub)}
          >
            <div>
              <div className="pub-category">{pub.category}</div>
              <h3 className="pub-title" style={{ fontSize: 18 }}>{pub.title}</h3>
              <p className="pub-excerpt" style={{ fontSize: 13 }}>{pub.abstract}</p>
            </div>

            <div className="pub-meta">
              <span>{pub.author}</span>
              <span>·</span>
              <span>{pub.readTime}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 5. Reading Modal ────────────────────────────────────────── */}
      {readingArticle && (
        <div 
          className="mobile-drawer-backdrop" 
          onClick={() => setReadingArticle(null)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div 
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: 780, 
              width: '100%', 
              maxHeight: '90vh', 
              overflowY: 'auto', 
              padding: '36px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              position: 'relative'
            }}
          >
            <button 
              className="btn btn-secondary btn-icon"
              onClick={() => setReadingArticle(null)}
              style={{ position: 'absolute', top: 20, right: 20 }}
              aria-label="Close reader"
            >
              <X size={18} />
            </button>

            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--warm-stone)', fontWeight: 700, marginBottom: 8 }}>
              {readingArticle.category}
            </div>

            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 12, lineHeight: 1.25 }}>
              {readingArticle.title}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, paddingBottom: 14, borderBottom: '1px solid var(--border-color)' }}>
              <span>{readingArticle.author}</span>
              <span>·</span>
              <span>{readingArticle.date}</span>
              <span>·</span>
              <span>{readingArticle.readTime}</span>
            </div>

            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, color: 'var(--primary-text)', fontSize: 15, marginBottom: 10 }}>
                Executive Abstract
              </div>
              <p style={{ marginBottom: 20, fontStyle: 'italic', paddingLeft: 14, borderLeft: '3px solid var(--warm-stone)' }}>
                {readingArticle.abstract}
              </p>

              {readingArticle.body ? (
                <div style={{ color: 'var(--primary-text)', whiteSpace: 'pre-line' }}>
                  {readingArticle.body}
                </div>
              ) : (
                <p>
                  This specification describes the production implementation wired in IDCS backend engines (\`engine.py\` and \`inflow_classifier.py\`).
                </p>
              )}

              {readingArticle.citations && (
                <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-dim)' }}>
                  <strong>Suggested Reference:</strong> {readingArticle.citations}
                </div>
              )}
            </div>

            <div style={{ marginTop: 32, paddingTop: 18, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>IDCS Research &amp; Automation Architecture</span>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setReadingArticle(null)}
              >
                Close Specification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
