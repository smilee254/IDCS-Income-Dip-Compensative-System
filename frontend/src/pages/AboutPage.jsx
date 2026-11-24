import React from 'react';
import { Shield, TrendingUp, Users, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';

export default function AboutPage({ onNavigate }) {
  return (
    <div className="about-page" style={{ padding: '32px 0 80px' }}>
      {/* ── 1. Hero ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, marginBottom: 54 }}>
        <div className="hero-overline">ABOUT THE SYSTEM</div>
        <h1 style={{ 
          fontFamily: 'var(--font-serif)', 
          fontSize: 44, 
          fontWeight: 700, 
          color: 'var(--primary-text)', 
          lineHeight: 1.15,
          marginBottom: 16 
        }}>
          Predicting income dips.<br />
          <em>Automating financial safety floors.</em>
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text-muted)', lineHeight: 1.65 }}>
          The Income Dip Compensative System (IDCS) is an automated parametric protection platform built for Kenya's informal enterprise, gig workers, and independent merchants. We combine Facebook Prophet time-series forecasting with real-time M-Pesa underwriting to eliminate income volatility.
        </p>
      </section>

      {/* ── 2. The Core Challenge & System Mission ──────────────────── */}
      <section style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: 40, 
        padding: '40px 0', 
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: 64 
      }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 14 }}>
            The Informal Economy Volatility Trap
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
            Over 80% of Kenya's commercial workforce operates in the informal sector—running retail kiosks, salon services, delivery fleets, and market stalls. While their day-to-day turnover is high velocity, a sudden market dip or seasonal slump can cause catastrophic insolvency.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7 }}>
            Traditional insurance has failed these enterprises because legacy loss-adjustment costs exceed the micro-claims themselves. IDCS was built to replace adjusters with algorithms.
          </p>
        </div>

        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 14 }}>
            The IDCS Automated Underwriting Solution
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
            By linking directly to Safaricom Daraja Till/Paybill numbers and allowing cash turnover declarations, IDCS continuously streams real revenue.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7 }}>
            Facebook Prophet models seasonal patterns, school fee shocks, and holidays to forecast rolling 6-month trajectories. When turnover falls below the guaranteed 80% floor, parametric payouts are disbursed directly to M-Pesa without paperwork.
          </p>
        </div>
      </section>

      {/* ── 3. Three Core Pillars of IDCS ───────────────────────────── */}
      <section style={{ marginBottom: 72 }}>
        <div style={{ marginBottom: 28 }}>
          <div className="hero-overline">SYSTEM ARCHITECTURE</div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 700, color: 'var(--primary-text)' }}>
            Three technical pillars powering the IDCS engine.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <div className="division-box">
            <div className="division-num">01 / TIME-SERIES AI</div>
            <h3 className="division-heading" style={{ fontSize: 20 }}>Facebook Prophet Forecasting</h3>
            <p className="division-text">
              Prophet decomposes monthly revenue into seasonality, holiday shocks, and underlying growth trajectories, accurately predicting future deficiency zones.
            </p>
          </div>

          <div className="division-box">
            <div className="division-num">02 / UNDERWRITING</div>
            <h3 className="division-heading" style={{ fontSize: 20 }}>Parametric Micro-Deductions</h3>
            <p className="division-text">
              Premiums are collected seamlessly as fractions of a cent per sale (1.2%–1.8%), ensuring protection costs scale directly with actual commercial turnover.
            </p>
          </div>

          <div className="division-box">
            <div className="division-num">03 / ANTI-FRAUD</div>
            <h3 className="division-heading" style={{ fontSize: 20 }}>Chama Trust Defense</h3>
            <p className="division-text">
              Decentralized peer-attestation networks verify ongoing active trade when sales flatline, defeating moral hazard without manual inspection bureaucracy.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. Four-Stage Automated Lifecycle ───────────────────────── */}
      <section style={{ 
        padding: '40px 32px', 
        backgroundColor: 'var(--bg-card-subtle)', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-color)',
        marginBottom: 64 
      }}>
        <div className="hero-overline">AUTOMATION LIFECYCLE</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 8 }}>
          How IDCS Automates Protection End-to-End
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 600, marginBottom: 28 }}>
          From real-time transaction ingestion to instant algorithmic claim settlement.
        </p>

        <div className="methodology-strip">
          <div className="methodology-step">
            <div className="step-num">STAGE 01</div>
            <div className="step-title">Ingest</div>
            <div className="step-desc">
              Daraja C2B webhooks stream commercial sales; cash declarations capture hybrid physical payments.
            </div>
          </div>
          <div className="methodology-step">
            <div className="step-num">STAGE 02</div>
            <div className="step-title">Classify</div>
            <div className="step-desc">
              Inflow classifiers quarantine Fuliza/M-Shwari loans, personal transfers, and cashbacks.
            </div>
          </div>
          <div className="methodology-step">
            <div className="step-num">STAGE 03</div>
            <div className="step-title">Forecast</div>
            <div className="step-desc">
              Prophet AI calculates dynamic baseline (μ), volatility (σ), and identifies deficiency zones.
            </div>
          </div>
          <div className="methodology-step">
            <div className="step-num">STAGE 04</div>
            <div className="step-title">Compensate</div>
            <div className="step-desc">
              Verified income dips trigger automatic parametric compensation disbursed directly to M-Pesa.
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. CTA Banner ───────────────────────────────────────────── */}
      <section style={{ 
        padding: '40px 32px', 
        backgroundColor: 'var(--bg-card)', 
        border: '1px solid var(--border-color)', 
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20
      }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 6 }}>
            Ready to explore your income protection status?
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Open the live protection dashboard or test the USSD simulator.
          </p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => onNavigate('/')}
        >
          Open IDCS Dashboard <ArrowRight size={15} />
        </button>
      </section>
    </div>
  );
}
