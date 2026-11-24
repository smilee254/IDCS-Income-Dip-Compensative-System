import React, { useState } from 'react';
import { Store, ShieldCheck, X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function TillConnectionModal({
  isOpen,
  onClose,
  currentTill,
  onTillLinked,
  token
}) {
  const [tillNumber, setTillNumber] = useState(currentTill || '');
  const [tillType, setTillType] = useState('BUY_GOODS');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/policy/link-till', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          till_number: tillNumber.trim(),
          till_type: tillType
        })
      });

      const data = await res.json();
      if (res.ok) {
        setIsSuccess(true);
        setMessage(data.message || 'Till linked and verified successfully!');
        if (onTillLinked) {
          onTillLinked(data.till_number, data.till_type);
        }
        setTimeout(() => {
          onClose();
        }, 1600);
      } else {
        setIsSuccess(false);
        setMessage(data.detail || 'Failed to verify till number. Please verify digit length.');
      }
    } catch (err) {
      setIsSuccess(false);
      setMessage('Network error communicating with server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="login-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460, margin: 'auto', backgroundColor: 'var(--bg-card)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--warm-stone-subtle)', color: 'var(--warm-stone)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--warm-stone-border)'
            }}>
              <Store size={18} />
            </div>
            <div>
              <h2 className="font-serif" style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--primary-text)' }}>
                Link Business Till
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Automated daily income monitoring via Daraja C2B
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
          Connecting a dedicated Till or <b>Pochi la Biashara</b> isolates your genuine commercial revenue from
          personal money transfers, giving you an authentic actuarial protection baseline.
        </p>

        {message && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8,
            backgroundColor: isSuccess ? 'var(--semantic-success-bg)' : 'var(--semantic-danger-bg)',
            border: isSuccess ? '1px solid var(--semantic-success-border)' : '1px solid var(--semantic-danger-border)',
            color: isSuccess ? 'var(--semantic-success-text)' : 'var(--semantic-danger-text)'
          }}>
            {isSuccess ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Select Channel Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { id: 'BUY_GOODS', label: 'Buy Goods', desc: 'Till # (5–7 digits)' },
                { id: 'POCHI_LA_BIASHARA', label: 'Pochi la Biashara', desc: 'Merchant Phone' },
                { id: 'PAYBILL', label: 'Paybill', desc: 'Business # (5–6 digits)' }
              ].map((opt) => {
                const isSelected = tillType === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setTillType(opt.id)}
                    style={{
                      padding: '10px 6px', borderRadius: 'var(--radius-sm)', textAlign: 'center', cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--warm-stone-subtle)' : 'var(--bg-card-subtle)',
                      border: isSelected ? '1.5px solid var(--warm-stone)' : '1px solid var(--border-color)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-text)' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {opt.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label>
              {tillType === 'POCHI_LA_BIASHARA' ? 'Pochi Phone Number' : 'Till / Paybill Number'}
            </label>
            <input
              type="text"
              className="form-control tabular-nums"
              placeholder={tillType === 'POCHI_LA_BIASHARA' ? 'e.g. 0712345678' : 'e.g. 882910'}
              value={tillNumber}
              onChange={(e) => setTillNumber(e.target.value)}
              required
            />
          </div>

          <div style={{
            backgroundColor: 'var(--bg-card-subtle)', 
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)', 
            padding: 12, 
            marginBottom: 20, 
            fontSize: 12, 
            color: 'var(--text-muted)'
          }}>
            <div style={{ fontWeight: 600, color: 'var(--primary-text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} style={{ color: 'var(--warm-stone)' }} />
              Don't have a Till yet?
            </div>
            Dial <b>*334#</b> on your phone &rarr; select <i>Pochi la Biashara</i> &rarr; <i>Opt In</i> to activate a free merchant wallet in 2 minutes.
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading && <RefreshCw size={15} className="spin" />}
            {loading ? 'Verifying with Safaricom...' : 'Link & Activate Monitoring'}
          </button>
        </form>
      </div>
    </div>
  );
}
