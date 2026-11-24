import React from 'react';
import { Shield, CheckCircle2, ArrowRight, HandCoins, Upload } from 'lucide-react';

export default function CalibrationProgress({
  calibration,
  onDeclareCash,
  onUploadStatement
}) {
  const isCalibrated = calibration?.is_calibrated;
  const progressPct = calibration?.progress_pct || 40;
  const observed = calibration?.data_points || calibration?.txns_observed || 2;
  const target = calibration?.target_points || 7;

  if (isCalibrated) return null;

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '6px',
            backgroundColor: 'var(--bg-card-subtle)',
            color: 'var(--warm-stone)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border-color)'
          }}>
            <Shield size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-text)' }}>
              Baseline Calibration in Progress
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Observed {observed} of {target} days required to lock your floor.
            </div>
          </div>
        </div>
        
        <span className="badge badge-stone tabular-nums">
          {progressPct}%
        </span>
      </div>

      <div style={{
        width: '100%',
        height: 6,
        backgroundColor: 'var(--bg-card-subtle)',
        borderRadius: 999,
        overflow: 'hidden',
        marginBottom: 16
      }}>
        <div style={{
          width: `${progressPct}%`,
          height: '100%',
          backgroundColor: 'var(--warm-stone)',
          borderRadius: 999,
          transition: 'width 0.4s ease'
        }} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onDeclareCash}
          style={{ flex: 1 }}
        >
          <HandCoins size={14} style={{ color: 'var(--warm-stone)' }} />
          Declare Cash
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onUploadStatement}
          style={{ flex: 1 }}
        >
          <Upload size={14} style={{ color: 'var(--warm-stone)' }} />
          Upload PDF
        </button>
      </div>
    </div>
  );
}
