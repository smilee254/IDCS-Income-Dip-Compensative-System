import React, { useState } from 'react';
import {
  Settings, X, UserCog, Shield, Users, ShieldCheck
} from 'lucide-react';

export default function SettingsPanel({
  settingsTab, setSettingsTab, settingsData, setSettingsData,
  settingsSaved, saveSettings, squadMsg, setSquadMsg, mySquad,
  squadInputName, setSquadInputName, squadInputCode, setSquadInputCode,
  handleCreateSquad, handleJoinSquad, authHeaders, onClose
}) {
  const [attestClaimId, setAttestClaimId] = useState('');
  const [attestNotes, setAttestNotes] = useState('');
  const [attestLoading, setAttestLoading] = useState(false);
  const [attestMsg, setAttestMsg] = useState('');

  const handleAttest = async () => {
    if (!attestClaimId) return;
    setAttestLoading(true);
    setAttestMsg('');
    try {
      const res = await fetch('/api/squads/attest-claim', {
        method: 'POST',
        headers: authHeaders ? authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_id: parseInt(attestClaimId, 10),
          notes: attestNotes || 'Vouched by Trust Squad peer'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAttestMsg(`✓ ${data.message || 'Attestation recorded successfully!'}`);
        setAttestClaimId('');
        setAttestNotes('');
      } else {
        setAttestMsg(`✕ ${data.detail || 'Attestation failed.'}`);
      }
    } catch (e) {
      setAttestMsg('Network error while attesting.');
    } finally {
      setAttestLoading(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div 
        className="drawer-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 440 }}
      >
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--warm-stone-subtle)', color: 'var(--warm-stone)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--warm-stone-border)'
            }}>
              <Settings size={18} />
            </div>
            <span className="font-serif" style={{ fontWeight: 700, fontSize: 17, color: 'var(--primary-text)' }}>
              Settings & Policy
            </span>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 12px' }}>
          {[
            ['account', 'Account', UserCog],
            ['coverage', 'Coverage', Shield],
            ['squad', 'Trust Squad', Users]
          ].map(([id, label, Icon]) => (
            <button 
              key={id} 
              onClick={() => setSettingsTab(id)} 
              style={{
                flex: 1, padding: '12px 8px', background: 'none', border: 'none',
                borderBottom: settingsTab === id ? '2px solid var(--warm-stone)' : '2px solid transparent',
                color: settingsTab === id ? 'var(--primary-text)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {settingsTab === 'account' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                Update your registered personal information.
              </p>
              {[
                ['Full Name', 'name', 'text'],
                ['Phone Number', 'phone', 'tel'],
                ['Sector', 'sector', 'text'],
                ['County', 'county', 'text']
              ].map(([lbl, key, type]) => (
                <div key={key} className="form-group" style={{ margin: 0 }}>
                  <label>{lbl}</label>
                  <input 
                    type={type} 
                    className="form-control"
                    value={settingsData[key]}
                    onChange={e => setSettingsData(p => ({ ...p, [key]: e.target.value }))} 
                  />
                </div>
              ))}
              <div className="form-group" style={{ margin: 0 }}>
                <label>Employment Type</label>
                <select 
                  className="form-control" 
                  value={settingsData.employment_type}
                  onChange={e => setSettingsData(p => ({ ...p, employment_type: e.target.value }))}
                >
                  <option>Gig Worker</option>
                  <option>Self-Employed / Jua Kali</option>
                  <option>Retail / Kiosk</option>
                  <option>Private Contract</option>
                </select>
              </div>
            </div>
          )}

          {settingsTab === 'coverage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                Adjust your protection floor parameters. Changes apply to future underwriting cycles.
              </p>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Max Coverage Limit (KES)</label>
                <input 
                  type="number" 
                  className="form-control tabular-nums" 
                  value={settingsData.src_cap}
                  onChange={e => setSettingsData(p => ({ ...p, src_cap: Number(e.target.value) }))} 
                />
                <div className="tabular-nums" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  70% maximum indemnity: KES {(settingsData.src_cap * 0.7).toLocaleString()}
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Deferred Waiting Window (Days)</label>
                <input 
                  type="number" 
                  className="form-control tabular-nums" 
                  min={0} 
                  max={90} 
                  value={settingsData.deferred_period}
                  onChange={e => setSettingsData(p => ({ ...p, deferred_period: Number(e.target.value) }))} 
                />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Observation days before claim eligibility activates. Default: 30 days.
                </div>
              </div>
            </div>
          )}

          {settingsTab === 'squad' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
                <div style={{ color: 'var(--warm-stone)', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  What is a Trust Squad?
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6 }}>
                  Pool with 2–5 local traders. If your entire circle maintains an honest record for 12 months, everyone earns a
                  <b style={{ color: 'var(--primary-text)' }}> No-Claim Dividend</b> — a permanent
                  <b style={{ color: 'var(--warm-stone)' }}> −0.3%</b> discount on micro-premiums.
                </div>
              </div>

              {mySquad?.has_squad ? (
                <>
                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary-text)' }}>{mySquad.name}</span>
                      <span className="badge badge-stone" style={{ fontSize: 11 }}>-0.3% Active</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Invite Code: <b className="tabular-nums" style={{ color: 'var(--warm-stone)', letterSpacing: 1 }}>{mySquad.code}</b>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                      Members ({mySquad.member_count}):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {mySquad.members?.map(m => (
                        <div key={m.user_id} style={{ fontSize: 12, color: 'var(--primary-text)', display: 'flex', justifyContent: 'space-between', backgroundColor: 'var(--bg-card)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <span>{m.name} {m.is_leader ? '👑' : ''}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{m.sector || 'Member'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Peer Attestation Card */}
                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warm-stone)', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                      <ShieldCheck size={16} /> Vouch for a Peer's Claim
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
                      If a peer's business was idle due to supply shock, flood, or local disruption, you can attest their claim. Vouched claims receive 65% payout.
                    </div>
                    <input
                      className="form-control tabular-nums"
                      placeholder="Claim ID (e.g. 14)"
                      value={attestClaimId}
                      onChange={e => setAttestClaimId(e.target.value)}
                      style={{ marginBottom: 8 }}
                    />
                    <input
                      className="form-control"
                      placeholder="Attestation note (e.g. Market kiosk was closed for power outage)"
                      value={attestNotes}
                      onChange={e => setAttestNotes(e.target.value)}
                      style={{ marginBottom: 10 }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleAttest}
                      disabled={attestLoading || !attestClaimId}
                      style={{ width: '100%', fontSize: 13 }}
                    >
                      {attestLoading ? 'Submitting Attestation...' : 'Vouch for Peer (65% Payout)'}
                    </button>
                    {attestMsg && (
                      <div style={{ marginTop: 10, fontSize: 12, color: attestMsg.startsWith('✓') ? 'var(--semantic-success-text)' : 'var(--semantic-danger-text)' }}>
                        {attestMsg}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--primary-text)' }}>Create a New Squad</div>
                    <input 
                      className="form-control" 
                      placeholder="e.g. Gikomba Merchants"
                      value={squadInputName} 
                      onChange={e => setSquadInputName(e.target.value)} 
                      style={{ marginBottom: 8 }} 
                    />
                    <button className="btn btn-primary" onClick={handleCreateSquad} style={{ width: '100%' }}>
                      <Users size={15} /> Create Squad
                    </button>
                  </div>

                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--primary-text)' }}>Join Existing Squad</div>
                    <input 
                      className="form-control tabular-nums" 
                      placeholder="Enter Invite Code (e.g. SQ-A1B2C3)"
                      value={squadInputCode} 
                      onChange={e => setSquadInputCode(e.target.value.toUpperCase())} 
                      style={{ marginBottom: 8, textTransform: 'uppercase' }} 
                    />
                    <button className="btn btn-secondary" onClick={handleJoinSquad} style={{ width: '100%' }}>
                      Join Squad
                    </button>
                  </div>
                </div>
              )}

              {squadMsg && (
                <div style={{ 
                  backgroundColor: 'var(--semantic-success-bg)', 
                  border: '1px solid var(--semantic-success-border)', 
                  borderRadius: 'var(--radius-sm)', 
                  padding: 12, 
                  fontSize: 12, 
                  color: 'var(--semantic-success-text)' 
                }}>
                  {squadMsg}
                </div>
              )}
            </div>
          )}
        </div>

        {settingsTab !== 'squad' && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)' }}>
            {settingsSaved && (
              <div style={{ fontSize: 12, marginBottom: 10, color: settingsSaved.startsWith('✓') ? 'var(--semantic-success-text)' : 'var(--semantic-danger-text)' }}>
                {settingsSaved}
              </div>
            )}
            <button className="btn btn-primary" onClick={saveSettings} style={{ width: '100%' }}>
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
