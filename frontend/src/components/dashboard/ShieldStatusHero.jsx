import React from 'react';
import { ShieldCheck, Zap, AlertTriangle, ArrowUpRight, DollarSign, Store } from 'lucide-react';

export default function ShieldStatusHero({
  evaluation,
  user,
  tier,
  onFileClaim,
  claimLoading,
  onOpenTillModal
}) {
  const isEligible = evaluation?.eligible;
  const autoDisburse = evaluation?.auto_disburse;
  const mu = evaluation?.mu || 0;
  const payout = evaluation?.payout || 0;
  const microRate = (evaluation?.micro_deduction_rate ?? 0.015) * 100;
  const tierName = tier?.name || evaluation?.tier?.name || 'Silver Shield';
  const coverageLimit = tier?.coverage_limit || evaluation?.tier?.coverage_limit || 35000;

  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Header Row */}
      <div className="card-header-row" style={{ marginBottom: 14 }}>
        <span className={`badge ${isEligible ? 'badge-warning' : 'badge-success'}`}>
          <span className="badge-dot" />
          {isEligible ? 'Income Dip Triggered' : 'Shield Active & Protected'}
        </span>
        <span className="badge badge-stone">{tierName}</span>
      </div>

      {/* Main Floor Number */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', fontWeight: 600 }}>
          Protected Income Floor
        </div>
        <div className="tabular-nums" style={{ 
          fontSize: 34, 
          fontWeight: 700, 
          color: 'var(--primary-text)', 
          letterSpacing: '-0.5px',
          lineHeight: 1.15,
          marginTop: 4
        }}>
          KES {mu > 0 ? Math.round(mu * 0.8).toLocaleString() : coverageLimit.toLocaleString()}
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>/ month</span>
        </div>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
        If monthly business income falls below this threshold, IDCS disburses up to <b>KES {coverageLimit.toLocaleString()}</b> directly to your M-Pesa.
      </p>

      {/* Action / Trigger Status */}
      <div style={{ marginBottom: 20 }}>
        {isEligible ? (
          <button
            className="btn btn-accent"
            onClick={onFileClaim}
            disabled={claimLoading}
            style={{ width: '100%', padding: '12px 18px', fontWeight: 700 }}
          >
            <DollarSign size={16} />
            {claimLoading ? 'Processing Settlement...' : `Claim KES ${payout > 0 ? Math.round(payout).toLocaleString() : 'Payout'}`}
          </button>
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            padding: '10px 14px',
            backgroundColor: 'var(--bg-card-subtle)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            fontSize: 13, 
            color: 'var(--semantic-success-text)' 
          }}>
            <span className="badge-dot" style={{ backgroundColor: 'var(--semantic-success-text)' }} />
            <span>Turnover is stable. No compensation dip detected.</span>
          </div>
        )}
      </div>

      {/* Detailed Policy Metrics */}
      <div style={{
        backgroundColor: 'var(--bg-card-subtle)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5 }}>
          Shield Parameters
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>Micro-Premium</span>
          <span className="tabular-nums" style={{ color: 'var(--primary-text)', fontWeight: 600 }}>
            {microRate.toFixed(1)}% per M-Pesa sale
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>Max Benefit Cap</span>
          <span className="tabular-nums" style={{ color: 'var(--primary-text)', fontWeight: 600 }}>
            KES {coverageLimit.toLocaleString()}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>M-Pesa Payout</span>
          <span style={{ color: 'var(--primary-text)', fontWeight: 600 }}>
            {user?.phone || 'Registered Line'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Commercial Till</span>
          {user?.till_number ? (
            <span className="badge badge-success" style={{ fontSize: 11 }}>
              <span className="badge-dot" /> #{user.till_number}
            </span>
          ) : (
            <button
              onClick={onOpenTillModal}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--warm-stone)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Store size={12} /> Link Till / Pochi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
