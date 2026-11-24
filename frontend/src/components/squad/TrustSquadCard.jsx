import React, { useState } from 'react';
import { Users, ShieldCheck, UserPlus, Copy, Check } from 'lucide-react';

export default function TrustSquadCard({
  mySquad,
  squadInputName,
  setSquadInputName,
  squadInputCode,
  setSquadInputCode,
  handleCreateSquad,
  handleJoinSquad,
  squadMsg
}) {
  const [copied, setCopied] = useState(false);

  const copyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="squad-section" className="card">
      <div className="card-header-row">
        <div>
          <div className="card-title font-serif" style={{ fontSize: 18 }}>
            <Users size={18} style={{ color: 'var(--warm-stone)' }} />
            Trust Squad (Peer Chama)
          </div>
          <div className="card-subtitle">
            Community reserve backing and peer attestations for expedited claims and +5% no-claim dividend.
          </div>
        </div>

        {mySquad && (
          <span className="badge badge-success">
            <span className="badge-dot" /> Squad Active (+5% Bonus)
          </span>
        )}
      </div>

      {squadMsg && (
        <div style={{
          padding: '10px 14px', 
          backgroundColor: 'var(--semantic-success-bg)', 
          border: '1px solid var(--semantic-success-border)',
          borderRadius: 'var(--radius-sm)', 
          color: 'var(--semantic-success-text)', 
          fontSize: 13, 
          marginBottom: 16
        }}>
          {squadMsg}
        </div>
      )}

      {mySquad ? (
        <div style={{
          backgroundColor: 'var(--bg-card-subtle)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: 18
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Chama Squad</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-text)' }}>{mySquad.squad_name}</div>
            </div>

            {mySquad.invite_code && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="tabular-nums" style={{
                  padding: '5px 10px', 
                  backgroundColor: 'var(--bg-card)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)', 
                  fontSize: 13, 
                  fontFamily: 'monospace', 
                  color: 'var(--warm-stone)', 
                  fontWeight: 700
                }}>
                  {mySquad.invite_code}
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyCode(mySquad.invite_code)}
                >
                  {copied ? <Check size={13} style={{ color: 'var(--semantic-success-text)' }} /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Share'}</span>
                </button>
              </div>
            )}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            Members ({mySquad.members?.length || 1} / 6)
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(mySquad.members || []).map((m, idx) => (
              <div
                key={m.id || idx}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', 
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-full)', 
                  fontSize: 12
                }}
              >
                <span className="badge-dot" style={{ backgroundColor: 'var(--semantic-success-text)' }} />
                <span>{m.name || m.phone || `Member #${idx + 1}`}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
          backgroundColor: 'var(--bg-card-subtle)', 
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)', 
          padding: 16
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 6 }}>
              Create a Squad
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-control"
                placeholder="Squad name (e.g. Eastleigh Market)"
                value={squadInputName}
                onChange={(e) => setSquadInputName(e.target.value)}
                style={{ fontSize: 13, padding: '7px 10px' }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCreateSquad}
              >
                Create
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 6 }}>
              Join with Code
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-control"
                placeholder="6-character code"
                value={squadInputCode}
                onChange={(e) => setSquadInputCode(e.target.value.toUpperCase())}
                style={{ fontSize: 13, padding: '7px 10px', textTransform: 'uppercase' }}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleJoinSquad}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
