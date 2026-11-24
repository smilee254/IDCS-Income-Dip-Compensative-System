import React from 'react';
import { TrendingUp, Shield, Users, ArrowRight, PhoneCall, Cpu, Activity } from 'lucide-react';

export default function EditorialHero({ onExplorePlans, onOpenUssd }) {
  return (
    <div className="editorial-hero-container">
      <div className="editorial-hero-header">
        <h1 className="editorial-title">
          Predicting Volatility.<br />
          <em>Automating Income Protection.</em>
        </h1>
        <p className="editorial-subtitle">
          IDCS pairs Facebook Prophet time-series forecasting with real-time M-Pesa automated underwriting to guarantee cashflow safety floors for Kenya's independent enterprise.
        </p>

        <div className="editorial-actions">
          <button 
            className="btn btn-primary"
            onClick={onExplorePlans}
          >
            Explore Protection Tiers <ArrowRight size={15} />
          </button>
          
          <button 
            className="btn btn-secondary"
            onClick={onOpenUssd}
          >
            <PhoneCall size={14} style={{ color: 'var(--warm-stone)' }} /> USSD Simulator (*334#)
          </button>
        </div>
      </div>

      {/* 3-Pillar Automation System Bar */}
      <div className="pillars-bar">
        <div className="pillar-item">
          <div className="pillar-icon">
            <Cpu size={18} />
          </div>
          <div>
            <div className="pillar-title">Prophet AI Forecasting</div>
            <div className="pillar-desc">6-month time-series modeling tuned for Kenyan seasonal &amp; holiday income trends.</div>
          </div>
        </div>

        <div className="pillar-item">
          <div className="pillar-icon">
            <Shield size={18} />
          </div>
          <div>
            <div className="pillar-title">Automated Underwriting</div>
            <div className="pillar-desc">Algorithmic parametric floor derivation with instant, adjuster-free M-Pesa payouts.</div>
          </div>
        </div>

        <div className="pillar-item">
          <div className="pillar-icon">
            <Users size={18} />
          </div>
          <div>
            <div className="pillar-title">Chama Trust Defense</div>
            <div className="pillar-desc">Decentralized peer-attestation squads preventing fraud &amp; verifying active trade.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
