import React, { useState, useEffect } from 'react';
import { DollarSign, X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function CashModal({ isOpen, onClose, token, onCashDeclared }) {
  const [amount, setAmount] = useState('');
  const [weekEnding, setWeekEnding] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultBadge, setResultBadge] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      fetchHistory();
    }
  }, [isOpen, token]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/cash/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch {}
    setHistoryLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResultBadge(null);

    try {
      const res = await fetch('/api/cash/declare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          week_ending: weekEnding,
          notes: notes || 'Weekly cash declaration'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setResultBadge(data);
        setAmount('');
        setNotes('');
        fetchHistory();
        if (onCashDeclared) onCashDeclared();
      } else {
        setResultBadge({ error: data.detail || 'Declaration failed' });
      }
    } catch (err) {
      setResultBadge({ error: 'Network error submitting declaration' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="login-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto',
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)', padding: 28, zIndex: 1000,
          boxShadow: 'var(--shadow-subtle)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--warm-stone-subtle)', color: 'var(--warm-stone)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--warm-stone-border)'
            }}>
              <DollarSign size={18} />
            </div>
            <span className="font-serif" style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary-text)' }}>
              Declare Cash Sales
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
          Cash spent before banking is genuine enterprise turnover. Declare weekly cash receipts to strengthen your protection baseline without needing immediate mobile deposits.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Weekly Cash Amount (KES)</label>
            <input
              type="number"
              className="form-control tabular-nums"
              placeholder="e.g. 15000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Week Ending Date</label>
            <input
              type="date"
              className="form-control tabular-nums"
              value={weekEnding}
              onChange={e => setWeekEnding(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Notes (Optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Salon cuts, hair products, client tips"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !amount}
            style={{ width: '100%', marginTop: 4 }}
          >
            {loading ? 'Submitting Declaration...' : 'Submit Cash Declaration'}
          </button>
        </form>

        {resultBadge && (
          <div style={{
            marginTop: 16, padding: 14, borderRadius: 'var(--radius-sm)',
            backgroundColor: resultBadge.error ? 'var(--semantic-danger-bg)' : (resultBadge.credibility_flag === 'HIGH_CASH_RATIO' ? 'var(--semantic-warning-bg)' : 'var(--semantic-success-bg)'),
            border: `1px solid ${resultBadge.error ? 'var(--semantic-danger-border)' : (resultBadge.credibility_flag === 'HIGH_CASH_RATIO' ? 'var(--semantic-warning-border)' : 'var(--semantic-success-border)')}`
          }}>
            {resultBadge.error ? (
              <div style={{ color: 'var(--semantic-danger-text)', fontSize: 13 }}>✕ {resultBadge.error}</div>
            ) : (
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: resultBadge.credibility_flag === 'HIGH_CASH_RATIO' ? 'var(--semantic-warning-text)' : 'var(--semantic-success-text)', marginBottom: 4 }}>
                  {resultBadge.badge}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {resultBadge.badge_detail}
                </div>
                <div className="tabular-nums" style={{ fontSize: 12, color: 'var(--primary-text)', marginTop: 6 }}>
                  Counted Baseline Addition: <b>KES {resultBadge.weighted_amount?.toLocaleString()}</b>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 22, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-text)' }}>Recent Cash Declarations</span>
            {historyLoading && <RefreshCw size={12} className="spin" />}
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No cash declarations recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
              {history.map(item => (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  backgroundColor: 'var(--bg-card-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  fontSize: 12, border: '1px solid var(--border-color)'
                }}>
                  <div>
                    <span className="tabular-nums" style={{ color: 'var(--primary-text)', fontWeight: 600 }}>KES {item.amount.toLocaleString()}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>Week of {item.week_ending}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${item.credibility_flag === 'OK' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                      <span className="badge-dot" />
                      {item.credibility_flag === 'OK' ? '100% Credited' : '60% Weighted'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
