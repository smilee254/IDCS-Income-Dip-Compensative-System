import React from 'react';
import { HandCoins, Upload, Phone, Store, CheckCircle } from 'lucide-react';

export default function QuickActionGrid({
  onDeclareCash,
  onUploadClick,
  onOpenUssd,
  onOpenTillModal,
  tillConnected,
  tillNumber,
  tillType
}) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 14 }}>
        Management & Data Ingestion
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Link Till Card */}
        <div 
          onClick={onOpenTillModal}
          style={{
            backgroundColor: 'var(--bg-card-subtle)',
            border: tillConnected ? '1px solid var(--warm-stone-border)' : '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '6px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--warm-stone)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border-color)'
            }}>
              <Store size={16} />
            </div>
            {tillConnected && (
              <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 6px' }}>
                Active
              </span>
            )}
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary-text)', marginBottom: 2 }}>
            {tillConnected ? `Till #${tillNumber}` : 'Link Till / Pochi'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>
            {tillConnected ? `${tillType?.replace('_', ' ') || 'Daraja'} live feed` : 'Connect M-Pesa Buy Goods'}
          </div>
        </div>

        {/* Declare Cash Card */}
        <div 
          onClick={onDeclareCash}
          style={{
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '6px',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--warm-stone)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border-color)',
            marginBottom: 8
          }}>
            <HandCoins size={16} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary-text)', marginBottom: 2 }}>
            Declare Cash Sales
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>
            Add unbanked cash turnover
          </div>
        </div>

        {/* Statement Upload */}
        <label 
          style={{
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            margin: 0
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '6px',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--warm-stone)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border-color)',
            marginBottom: 8
          }}>
            <Upload size={16} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary-text)', marginBottom: 2 }}>
            Upload Statement
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>
            PDF statement parsing
          </div>
          <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={onUploadClick} />
        </label>

        {/* USSD Dial */}
        <div 
          onClick={onOpenUssd}
          style={{
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '6px',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--warm-stone)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border-color)',
            marginBottom: 8
          }}>
            <Phone size={16} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary-text)', marginBottom: 2 }}>
            USSD Offline Dial
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>
            Dial *384*432# flow
          </div>
        </div>
      </div>
    </div>
  );
}
