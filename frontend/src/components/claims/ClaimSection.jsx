import React from 'react';
import { DollarSign, ShieldAlert, CheckCircle2, Clock, Users } from 'lucide-react';

export default function ClaimSection({
  claims,
  claimMsg,
  claimGateAlert,
  onOpenSquad,
  onDismissGateAlert,
  onFileClaim,
  isEligible,
  claimLoading
}) {
  return (
    <div id="claims-section" className="card">
      <div className="card-header-row">
        <div>
          <div className="card-title font-serif" style={{ fontSize: 20 }}>
            Claims & Settlement History
          </div>
          <div className="card-subtitle">
            Parametric compensation automatically audited and disbursed directly to registered M-Pesa.
          </div>
        </div>

        {isEligible && (
          <button
            className="btn btn-accent btn-sm"
            onClick={onFileClaim}
            disabled={claimLoading}
          >
            <DollarSign size={15} />
            {claimLoading ? 'Filing Claim...' : 'File Dip Claim Now'}
          </button>
        )}
      </div>

      {claimMsg && (
        <div style={{
          padding: '12px 16px', 
          backgroundColor: 'var(--semantic-success-bg)', 
          border: '1px solid var(--semantic-success-border)',
          borderRadius: 'var(--radius-sm)', 
          color: 'var(--semantic-success-text)', 
          fontSize: 13, 
          marginBottom: 16,
          display: 'flex', 
          alignItems: 'center', 
          gap: 8
        }}>
          <CheckCircle2 size={16} />
          <span>{claimMsg}</span>
        </div>
      )}

      {claimGateAlert && (
        <div style={{
          backgroundColor: 'var(--semantic-warning-bg)', 
          border: '1px solid var(--semantic-warning-border)', 
          borderRadius: 'var(--radius-sm)',
          padding: 16, 
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--semantic-warning-text)', fontWeight: 700, fontSize: 14 }}>
            <ShieldAlert size={18} /> Business Activity Verification Required
          </div>
          <div style={{ fontSize: 13, color: 'var(--primary-text)', marginTop: 6, lineHeight: 1.5 }}>
            {claimGateAlert.reason || 'No recent activity was observed on your till during this dip period.'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {claimGateAlert.remedy || 'Request a peer attestation from your Trust Squad to vouch that your shop was open.'}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={onOpenSquad}
            >
              <Users size={14} /> Request Squad Peer Attestation
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onDismissGateAlert}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {claims.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Clock size={28} style={{ color: 'var(--text-dim)', marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 500 }}>No claims filed yet.</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            When a verified income dip occurs, payouts are processed automatically via M-Pesa.
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Dip Amount</th>
                <th>Compensation</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.claim_id}>
                  <td style={{ fontWeight: 600 }}>
                    <span className="tabular-nums">#{c.claim_id}</span>
                  </td>
                  <td className="tabular-nums">
                    KES {c.dip_amount ? Math.round(c.dip_amount).toLocaleString() : '—'}
                  </td>
                  <td className="tabular-nums" style={{ fontWeight: 700, color: 'var(--primary-text)' }}>
                    KES {c.payout ? Math.round(c.payout).toLocaleString() : '—'}
                  </td>
                  <td>
                    <span className={`badge ${
                      c.status === 'APPROVED' || c.status === 'AUTO_DISBURSED'
                        ? 'badge-success'
                        : c.status === 'FLAGGED_FOR_AUDIT'
                        ? 'badge-warning'
                        : 'badge-danger'
                    }`}>
                      <span className="badge-dot" />
                      {c.status === 'AUTO_DISBURSED' ? 'M-Pesa Disbursed' : c.status}
                    </span>
                  </td>
                  <td className="tabular-nums" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {c.created_at ? c.created_at.slice(0, 10) : 'Recent'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
