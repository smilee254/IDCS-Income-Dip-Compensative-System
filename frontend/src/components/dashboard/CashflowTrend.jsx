import React, { useState } from 'react';
import { TrendingUp, BarChart3, Info, ChevronDown, ArrowUpRight } from 'lucide-react';
import IncomeAreaChart from '../../IncomeAreaChart';

export default function CashflowTrend({
  incomeHistory,
  evaluation,
  recentActivity,
  theme = 'dark'
}) {
  const [timeHorizon, setTimeHorizon] = useState('12_months');

  const mu = evaluation?.mu || 0;
  const dipThreshold = mu > 0 ? mu * 0.8 : 0;
  const stability = evaluation?.stability_score ? evaluation.stability_score.toFixed(0) : '—';
  const dipProb = evaluation?.dip_probability ? evaluation.dip_probability.toFixed(0) : '0';

  // Recent 6 transactions to display in the verified turnover feed
  const items = (recentActivity?.transactions && recentActivity.transactions.length > 0)
    ? recentActivity.transactions.slice(0, 6)
    : (incomeHistory && incomeHistory.length > 0)
    ? incomeHistory.slice(-6).map((item, idx) => ({
        id: idx,
        type: 'credit',
        amount: item.amount,
        reference: item.month,
        timestamp: item.month,
        category: 'Revenue'
      }))
    : [];

  return (
    <div id="cashflow-section" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Main Performance Card: Prophet Forecast & Parametric Floor */}
      <div className="card">
        <div className="card-header-row">
          <div>
            <div className="card-title font-serif" style={{ fontSize: 20 }}>
              Income & Parametric Floor
            </div>
            <div className="card-subtitle">
              Calibrated from verified M-Pesa turnover and declared cash sales. Dips below the floor trigger instant payout.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {mu > 0 && (
              <span className="badge badge-stone tabular-nums">
                Baseline: KES {Math.round(mu).toLocaleString()}
              </span>
            )}
            
            <div style={{ position: 'relative' }}>
              <select 
                className="form-control tabular-nums"
                value={timeHorizon}
                onChange={(e) => setTimeHorizon(e.target.value)}
                style={{ 
                  padding: '6px 28px 6px 12px', 
                  fontSize: 13, 
                  height: 34, 
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundColor: 'var(--bg-card-subtle)'
                }}
              >
                <option value="12_months">12 months</option>
                <option value="6_months">6 months</option>
                <option value="30_days">30 days</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: 10, pointerEvents: 'none', color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* Chart View */}
        <div style={{ height: 280, width: '100%', margin: '12px 0 20px' }}>
          <IncomeAreaChart 
            incomeHistory={incomeHistory} 
            dipThreshold={dipThreshold} 
            theme={theme}
          />
        </div>

        {/* 3 Summary Stats (Tabular Numerals & Understated Styling) */}
        <div style={{
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: 16,
          paddingTop: 18, 
          borderTop: '1px solid var(--border-color)'
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Historical Baseline (µ)</div>
            <div className="tabular-nums" style={{ fontSize: 19, fontWeight: 700, color: 'var(--primary-text)', marginTop: 2 }}>
              KES {mu > 0 ? Math.round(mu).toLocaleString() : '—'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Income Stability Index</div>
            <div className="tabular-nums" style={{ 
              fontSize: 19, 
              fontWeight: 700, 
              color: stability > 60 ? 'var(--semantic-success-text)' : 'var(--semantic-warning-text)', 
              marginTop: 2 
            }}>
              {stability} / 100
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Dip Risk Probability</div>
            <div className="tabular-nums" style={{ 
              fontSize: 19, 
              fontWeight: 700, 
              color: dipProb > 30 ? 'var(--semantic-danger-text)' : 'var(--semantic-success-text)', 
              marginTop: 2 
            }}>
              {dipProb}%
            </div>
          </div>
        </div>
      </div>

      {/* Verified Commercial Turnover Feed */}
      <div className="card">
        <div className="card-header-row">
          <div>
            <div className="card-title">Verified Turnover Activity</div>
            <div className="card-subtitle">Real-time M-Pesa receipts separated from loans & friendly funds</div>
          </div>

          <span className="badge badge-neutral" style={{ fontSize: 12 }}>
            Auto-reconciled
          </span>
        </div>

        {items.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '36px 20px', color: 'var(--text-muted)', textAlign: 'center'
          }}>
            <Info size={24} style={{ color: 'var(--text-dim)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 500 }}>No verified transactions recorded yet.</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, maxWidth: 360 }}>
              Incoming M-Pesa Till payments and declared cash sales will automatically appear here.
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Classification</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      <span className="tabular-nums">
                        {it.reference || (it.timestamp ? it.timestamp.slice(0, 10) : `TX-${idx + 1}`)}
                      </span>
                    </td>
                    <td>
                      {it.category === 'Loan' ? (
                        <span className="badge badge-warning" title="Digital credit disbursement — zero micro-premium">
                          <span className="badge-dot" /> Loan (Filtered)
                        </span>
                      ) : it.category === 'Chama' || it.category === 'P2P_Personal' ? (
                        <span className="badge badge-neutral" title="Personal/Chama transfer — excluded from baseline">
                          <span className="badge-dot" /> Personal
                        </span>
                      ) : it.category === 'Reversal' || it.anomaly_flag === 'REVERSED' ? (
                        <span className="badge badge-danger" title="Customer reversal clawed back">
                          <span className="badge-dot" /> Reversed
                        </span>
                      ) : (
                        <span className="badge badge-success" title="Verified commercial turnover">
                          <span className="badge-dot" /> {it.category || 'Revenue'}
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums" style={{ fontWeight: 600, textAlign: 'right' }}>
                      KES {Number(it.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
