import React from 'react';
import { Shield, Check, ArrowRight } from 'lucide-react';

export default function ProtectionPlanPicker({
  tiers,
  currentTierKey,
  onSelectTier,
  tierLoading,
  tierMsg
}) {
  const defaultTiers = [
    {
      key: 'TIER_1',
      name: 'Bronze Shield',
      target_baseline: 25000,
      coverage_limit: 17500,
      premium_rate_pct: '1.2%',
      recommended_for: 'Boda boda riders, mama mboga, solo artisans'
    },
    {
      key: 'TIER_2',
      name: 'Silver Shield',
      target_baseline: 50000,
      coverage_limit: 35000,
      premium_rate_pct: '1.5%',
      recommended_for: 'Salonists, retail kiosks, delivery couriers'
    },
    {
      key: 'TIER_3',
      name: 'Gold Shield',
      target_baseline: 90000,
      coverage_limit: 63000,
      premium_rate_pct: '1.8%',
      recommended_for: 'Wholesale traders, hardware stores, transport fleets'
    }
  ];

  const planList = tiers && tiers.length > 0 ? tiers : defaultTiers;

  return (
    <div id="plans-section" className="card">
      <div className="card-header-row">
        <div>
          <div className="card-title font-serif" style={{ fontSize: 20 }}>
            Protection Tiers
          </div>
          <div className="card-subtitle">
            Calibrate your safety floor to match your business size. Premiums are deducted automatically as micro-cents per sale.
          </div>
        </div>

        {tierMsg && (
          <span className="badge badge-success">
            <span className="badge-dot" /> {tierMsg}
          </span>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 18,
        marginTop: 8
      }}>
        {planList.map((t) => {
          const isActive = (currentTierKey || 'TIER_2') === t.key;
          return (
            <div
              key={t.key}
              style={{
                backgroundColor: 'var(--bg-card-subtle)',
                border: isActive ? '1.5px solid var(--warm-stone)' : '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '22px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                transition: 'border-color 0.15s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-text)' }}>
                    {t.name}
                  </span>
                  {isActive && (
                    <span className="badge badge-stone" style={{ fontSize: 11 }}>
                      Current Plan
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, minHeight: 34 }}>
                  {t.recommended_for}
                </div>

                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 18
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Target Baseline:</span>
                    <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--primary-text)' }}>
                      KES {t.target_baseline?.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Max Dip Cover:</span>
                    <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--primary-text)' }}>
                      KES {t.coverage_limit?.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Micro-Rate:</span>
                    <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--warm-stone)' }}>
                      {t.premium_rate_pct} / sale
                    </span>
                  </div>
                </div>
              </div>

              <button
                className={`btn ${isActive ? 'btn-secondary' : 'btn-primary'}`}
                disabled={isActive || tierLoading}
                onClick={() => onSelectTier(t.key)}
                style={{ width: '100%', fontSize: 13 }}
              >
                {isActive ? '✓ Active Tier' : `Select ${t.name.split(' ')[0]}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
