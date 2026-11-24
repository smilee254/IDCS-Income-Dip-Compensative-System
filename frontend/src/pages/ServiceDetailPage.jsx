import React, { useState } from 'react';
import { 
  Check, ArrowRight, ChevronDown, ChevronUp, FileText, 
  Shield, TrendingUp, LineChart, HelpCircle 
} from 'lucide-react';

const serviceData = {
  'actuarial-science': {
    title: 'Actuarial Science',
    subtitle: 'Mathematical precision for balance sheet resilience and policy liabilities.',
    icon: TrendingUp,
    overview: 'Our Actuarial Science division deploys formal probabilistic and stochastic frameworks to price risk, model asset-liability interactions, and establish statutory solvency margins. We operate across life, general, and innovative parametric risk domains.',
    capabilities: [
      { name: 'Parametric Index & Pricing Architecture', desc: 'Developing mathematically robust strike thresholds, probability-of-loss calculations, and micro-premium schedules for automated indemnity products.' },
      { name: 'Stochastic Asset-Liability Reserving', desc: 'Monte Carlo simulations and dynamic financial analysis to quantify tail-risk scenarios and ensure adequate regulatory reserve capital.' },
      { name: 'Mortality, Morbidity & Cashflow Curves', desc: 'Actuarial table construction and empirical baseline drift tracking for evolving demographic and commercial pools.' },
      { name: 'Capital Adequacy & Solvency Testing', desc: 'Stress testing balance sheets under extreme macroeconomic conditions and statutory regulatory compliance.' }
    ],
    methodology: [
      { step: '01', title: 'Data Audit & Hygiene', desc: 'Validating historical loss data, adjusting for systemic outliers, and structuring inputs.' },
      { step: '02', title: 'Distribution Fitting', desc: 'Calibrating parametric distributions (Gamma, Pareto, Log-normal) to capture heavy-tailed loss events.' },
      { step: '03', title: 'Stochastic Simulation', desc: 'Running tens of thousands of scenario iterations to establish confidence bounds and expected shortfalls.' },
      { step: '04', title: 'Valuation & Documentation', desc: 'Producing formal actuarial valuation certificates and regulatory filings.' }
    ],
    applications: [
      'Micro-insurance and parametric income guarantee platforms',
      'Life and general insurance statutory reserving',
      'Pension funds and long-term employee benefit schemes',
      'Corporate risk retention and captive insurance programs'
    ],
    deliverables: [
      'Comprehensive Actuarial Valuation Reports',
      'Dynamic Financial Model Spreadsheets & Code Assets',
      'Regulatory Solvency and Capital Margin Certificates',
      'Executive Summary Presentations for Board & Regulators'
    ],
    faqs: [
      { q: 'What qualifications do your actuarial consultants possess?', a: 'Our lead actuaries hold professional fellowships with the Institute and Faculty of Actuaries (IFoA) or Society of Actuaries (SOA), backed by extensive commercial experience in emerging and international markets.' },
      { q: 'How does your parametric modeling differ from traditional indemnity insurance?', a: 'Parametric models trigger payouts automatically based on pre-defined objective indices (e.g., recorded turnover drops or weather thresholds), eliminating subjective claims loss adjustment and minimizing expense ratios.' },
      { q: 'Can you assist with statutory insurance regulatory filings?', a: 'Yes, our valuation reports are authored in strict accordance with relevant insurance statutory guidelines and actuarial standards of practice.' }
    ]
  },
  'risk-and-insurance': {
    title: 'Risk & Insurance',
    subtitle: 'Enterprise risk management and parametric safety net engineering.',
    icon: Shield,
    overview: 'Our Risk & Insurance division helps commercial enterprises, financial cooperatives, and institutional underwriters systematically identify, measure, and transfer operational and macroeconomic risk.',
    capabilities: [
      { name: 'Parametric Micro-Protection Design', desc: 'Structuring algorithmic safety floors for distributed workforces and merchants, linking real-time mobile money or transactional data to automatic compensation.' },
      { name: 'Enterprise Risk Assessment & Scoring', desc: 'Developing custom risk scoring engines, volatility indices, and operational heatmaps to isolate vulnerability points.' },
      { name: 'Reinsurance Program Optimization', desc: 'Sizing optimal retention limits, quota-share versus excess-of-loss treaties, and capital relief structures.' },
      { name: 'Algorithmic Fraud & Anti-Selection Gates', desc: 'Designing behavioral heuristics, peer-vouching networks (Trust Squads), and KDPA-compliant identity hashing to prevent adverse claims.' }
    ],
    methodology: [
      { step: '01', title: 'Exposure Mapping', desc: 'Comprehensive identification of operational, liquidity, and systemic volatility exposures across the business model.' },
      { step: '02', title: 'Vulnerability Quantification', desc: 'Estimating Maximum Probable Loss (MPL) and evaluating the correlation between business interruptions and revenue.' },
      { step: '03', title: 'Program Structuring', desc: 'Designing customized coverage terms, deductible thresholds, and automated claims workflows.' },
      { step: '04', title: 'Execution & Monitoring', desc: 'Overseeing placement, establishing audit protocols, and integrating live telemetry for ongoing monitoring.' }
    ],
    applications: [
      'Fintech and digital merchant payment ecosystems',
      'Agricultural supply chains and climate risk hedging',
      'Transport and mobility logistics fleets',
      'Commercial banking loan portfolio credit-dip protection'
    ],
    deliverables: [
      'Enterprise Risk Assessment Register & Matrix',
      'Parametric Contract Term Sheet & Rules Specifications',
      'Reinsurance Structure & Capacity Placement Recommendations',
      'Automated Claims Adjudication Architecture Specification'
    ],
    faqs: [
      { q: 'What is a parametric income dip protection program?', a: 'It is a protection policy where payouts are triggered instantaneously when an enterprise verified daily or monthly revenue drops below an actuarially computed baseline, requiring no physical loss adjusters.' },
      { q: 'How do you prevent fraudulent claims in digital or cash-based businesses?', a: 'We employ multi-layer gating: classifying inflows (filtering out loans and P2P transfers), peer-attestation squads (Chama-based trust circles), and anomaly spike caps.' },
      { q: 'Does IDCS act as an underwriter or an automated platform?', a: 'IDCS is an automated parametric risk prediction and underwriting engine. We design the algorithms, forecasting pipelines, and automated settlement rules; parametric risk pools provide liquidity.' }
    ]
  },
  'financial-advisory': {
    title: 'Financial Advisory',
    subtitle: 'Strategic capital allocation, liquidity stress-testing, and corporate finance.',
    icon: LineChart,
    overview: 'Our Financial Advisory division provides institutional clients with rigorous analytical support for critical balance sheet decisions, capital structuring, debt capacity planning, and liquidity optimization.',
    capabilities: [
      { name: 'Liquidity Stress-Testing & Working Capital', desc: 'Simulating severe cashflow contraction scenarios to determine optimal cash buffers, revolving lines, and reserve targets.' },
      { name: 'Corporate Financial Modeling & Valuation', desc: 'Developing multi-scenario discounted cash flow (DCF), economic value added (EVA), and transaction models for major corporate decisions.' },
      { name: 'Capital Structure & Debt Capacity', desc: 'Balancing debt and equity to minimize the weighted average cost of capital (WACC) while maintaining debt covenants.' },
      { name: 'Board & Governance Advisory', desc: 'Providing independent risk audits and strategic financial counsel directly to boards of directors and audit committees.' }
    ],
    methodology: [
      { step: '01', title: 'Financial Diagnostic', desc: 'Deep-dive analysis of historical audited financials, cashflow conversion cycles, and cost structures.' },
      { step: '02', title: 'Scenario Architecture', desc: 'Building dynamic forecasting models accommodating interest rate shocks, currency fluctuations, and volume drops.' },
      { step: '03', title: 'Strategic Recommendations', desc: 'Synthesizing quantitative outputs into clear, prioritized corporate and capital allocation actions.' },
      { step: '04', title: 'Implementation Support', desc: 'Assisting executive teams with lender negotiations, covenant structures, and capital deployment tracking.' }
    ],
    applications: [
      'Middle-market corporations navigating growth or restructuring',
      'Private equity and venture funds conducting portfolio risk audits',
      'Infrastructure projects requiring long-term project finance modeling',
      'Financial institutions optimizing capital and liquidity ratios'
    ],
    deliverables: [
      'Comprehensive Strategic Financial Review Dossier',
      'Audited Financial Model (.xlsx / dynamic Python notebooks)',
      'Liquidity & Debt Capacity Sensitivity Memoranda',
      'Board-Ready Executive Strategy Decks'
    ],
    faqs: [
      { q: 'How does IDCS differ from traditional micro-lenders or insurers?', a: 'Traditional lenders add debt when income drops, whereas traditional insurers require manual claim adjusters. IDCS predicts volatility using Facebook Prophet and provides non-debt parametric compensation directly to M-Pesa.' },
      { q: 'How long does a typical advisory assignment take?', a: 'Targeted liquidity diagnostics typically take 2 to 4 weeks, while comprehensive capital restructuring or custom model development runs 6 to 12 weeks.' },
      { q: 'Can your team work alongside our existing finance leadership?', a: 'Yes, we frequently partner directly with Chief Financial Officers and treasury teams, augmenting their internal bandwidth with specialized quantitative modeling.' }
    ]
  }
};

export default function ServiceDetailPage({ slug = 'actuarial-science', onNavigate }) {
  const [openFaq, setOpenFaq] = useState(null);

  const data = serviceData[slug] || serviceData['actuarial-science'];
  const Icon = data.icon;

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="service-detail-page" style={{ padding: '40px 0 80px' }}>
      {/* ── 1. Hero ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, marginBottom: 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button 
            onClick={() => onNavigate('/services')}
            style={{ fontSize: 12, color: 'var(--warm-stone)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
          >
            SERVICES
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>/</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{data.title.toUpperCase()}</span>
        </div>

        <h1 style={{ 
          fontFamily: 'var(--font-serif)', 
          fontSize: 48, 
          fontWeight: 700, 
          color: 'var(--primary-text)', 
          lineHeight: 1.15,
          marginBottom: 16 
        }}>
          {data.title}
        </h1>
        <p style={{ fontSize: 18, color: 'var(--warm-stone)', fontWeight: 500, marginBottom: 16 }}>
          {data.subtitle}
        </p>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 28 }}>
          {data.overview}
        </p>

        <button 
          className="btn btn-primary"
          onClick={() => onNavigate('/contact')}
        >
          Consult on {data.title} <ArrowRight size={15} />
        </button>
      </section>

      {/* ── 2. Capabilities Grid ────────────────────────────────────── */}
      <section style={{ marginBottom: 72 }}>
        <div className="hero-overline">DETAILED CAPABILITIES</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 24 }}>
          Core Practice Offerings
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {data.capabilities.map((cap, idx) => (
            <div key={idx} className="card" style={{ padding: '24px' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary-text)', marginBottom: 8 }}>
                {cap.name}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {cap.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. Methodology ──────────────────────────────────────────── */}
      <section style={{ 
        padding: '44px 36px', 
        backgroundColor: 'var(--bg-card-subtle)', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-color)',
        marginBottom: 72 
      }}>
        <div className="hero-overline">OUR APPROACH</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 24 }}>
          How We Deliver {data.title}
        </h2>

        <div className="methodology-strip">
          {data.methodology.map((m, idx) => (
            <div key={idx} className="methodology-step">
              <div className="step-num">{m.step} / PROCESS</div>
              <div className="step-title">{m.title}</div>
              <div className="step-desc">{m.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Applications & Deliverables ──────────────────────────── */}
      <section style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: 32, 
        marginBottom: 72 
      }}>
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--warm-stone)', fontWeight: 700, marginBottom: 12 }}>
            Applications &amp; Sectors
          </div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 18 }}>
            Where We Apply This Expertise
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.applications.map((app, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--text-muted)' }}>
                <Check size={16} style={{ color: 'var(--warm-stone)', flexShrink: 0, marginTop: 2 }} />
                <span>{app}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--warm-stone)', fontWeight: 700, marginBottom: 12 }}>
            Tangible Outputs
          </div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 18 }}>
            What Clients Receive
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.deliverables.map((del, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--text-muted)' }}>
                <FileText size={16} style={{ color: 'var(--warm-stone)', flexShrink: 0, marginTop: 2 }} />
                <span>{del}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 5. FAQs ─────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 72 }}>
        <div className="hero-overline">COMMON QUESTIONS</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 24 }}>
          Frequently Asked Questions
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div 
                key={idx}
                className="card"
                style={{ padding: '20px 24px', cursor: 'pointer' }}
                onClick={() => toggleFaq(idx)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--primary-text)' }}>
                    {faq.q}
                  </span>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                {isOpen && (
                  <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 6. Consultation CTA ─────────────────────────────────────── */}
      <section style={{ 
        padding: '48px 36px', 
        backgroundColor: 'var(--bg-card)', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20
      }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 6 }}>
            Ready to discuss {data.title}?
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Schedule an initial technical discussion with our practice leads.
          </p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => onNavigate('/contact')}
        >
          Request Technical Consultation <ArrowRight size={15} />
        </button>
      </section>
    </div>
  );
}
