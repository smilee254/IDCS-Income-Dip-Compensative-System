import React, { useState, useEffect, useRef } from 'react';
import {
  User, ShieldAlert, BarChart3, RefreshCw,
  Settings, LogOut, CheckCircle2, TrendingDown, Info, DollarSign,
  AlertTriangle, X, Users, Shield, UserCog, MessageSquare, Send
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const API = '/api';

// ─── Settings Panel (top-level component) ─────────────────────────────────────
function SettingsPanel({ settingsTab, setSettingsTab, settingsData, setSettingsData,
  settingsSaved, saveSettings, squadMsg, setSquadMsg, onClose }) {
  return (
    <>
      <div onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:999 }} />
      <div style={{
        position:'fixed', top:0, right:0, height:'100%', width:420,
        background:'#1c1c24', borderLeft:'1px solid #2b2b36',
        zIndex:1000, display:'flex', flexDirection:'column',
        boxShadow:'-8px 0 32px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'20px 24px', borderBottom:'1px solid #2b2b36' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Settings size={20} color="#00d296" />
            <span style={{ fontWeight:700, fontSize:16 }}>Settings</span>
          </div>
          <button onClick={onClose}
            style={{ background:'none', border:'none', cursor:'pointer', color:'#9e9ea7', padding:4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display:'flex', borderBottom:'1px solid #2b2b36' }}>
          {[['account','Account',UserCog],['coverage','Coverage',Shield],['squad','Trust Squad',Users]].map(([id,label,Icon]) => (
            <button key={id} onClick={() => setSettingsTab(id)} style={{
              flex:1, padding:'12px 8px', background:'none', border:'none',
              borderBottom: settingsTab === id ? '2px solid #00d296' : '2px solid transparent',
              color: settingsTab === id ? '#00d296' : '#9e9ea7',
              cursor:'pointer', fontSize:12, fontWeight:600,
              display:'flex', flexDirection:'column', alignItems:'center', gap:4
            }}>
              <Icon size={16} />{label}
            </button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>
          {settingsTab === 'account' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <p style={{ color:'#9e9ea7', fontSize:13, margin:0 }}>Update your personal information.</p>
              {[['Full Name','name','text'],['Phone Number','phone','tel'],['Sector','sector','text'],['County','county','text']].map(([lbl,key,type]) => (
                <div key={key} className="form-group" style={{ margin:0 }}>
                  <label style={{ fontSize:12 }}>{lbl}</label>
                  <input type={type} className="form-control"
                    value={settingsData[key]}
                    onChange={e => setSettingsData(p => ({...p, [key]: e.target.value}))} />
                </div>
              ))}
              <div className="form-group" style={{ margin:0 }}>
                <label style={{ fontSize:12 }}>Employment Type</label>
                <select className="form-control" value={settingsData.employment_type}
                  onChange={e => setSettingsData(p => ({...p, employment_type: e.target.value}))}>
                  <option>Gig Worker</option><option>SRC_Teacher</option>
                  <option>Private Contract</option><option>Self-Employed/Jua Kali</option>
                  <option>Public Full-Time</option>
                </select>
              </div>
            </div>
          )}

          {settingsTab === 'coverage' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <p style={{ color:'#9e9ea7', fontSize:13, margin:0 }}>Adjust your coverage parameters. Changes apply to your active policy immediately.</p>
              <div className="form-group" style={{ margin:0 }}>
                <label style={{ fontSize:12 }}>Max Coverage Cap (KES)</label>
                <input type="number" className="form-control" value={settingsData.src_cap}
                  onChange={e => setSettingsData(p => ({...p, src_cap: Number(e.target.value)}))} />
                <div style={{ fontSize:11, color:'#9e9ea7', marginTop:4 }}>70% indemnity cap: KES {(settingsData.src_cap * 0.7).toLocaleString()}</div>
              </div>
              <div className="form-group" style={{ margin:0 }}>
                <label style={{ fontSize:12 }}>Deferred Period (days)</label>
                <input type="number" className="form-control" min={0} max={90} value={settingsData.deferred_period}
                  onChange={e => setSettingsData(p => ({...p, deferred_period: Number(e.target.value)}))} />
                <div style={{ fontSize:11, color:'#9e9ea7', marginTop:4 }}>Days before a claim activates after a dip is detected. Standard: 30 days.</div>
              </div>
            </div>
          )}

          {settingsTab === 'squad' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ background:'#121216', border:'1px solid #00d296', borderRadius:10, padding:16 }}>
                <div style={{ color:'#00d296', fontWeight:700, fontSize:13, marginBottom:6 }}>🛡️ What is a Trust Squad?</div>
                <div style={{ color:'#9e9ea7', fontSize:12, lineHeight:1.6 }}>
                  Pool with 2–5 peers. If your entire squad files zero suspicious claims for 12 months, everyone earns a
                  <b style={{ color:'#fff' }}> No-Claim Dividend</b> — a permanent
                  <b style={{ color:'#00d296' }}> −0.3%</b> reduction on micro-premium deductions.
                </div>
              </div>
              <button className="btn btn-secondary"
                onClick={() => setSquadMsg('✅ Join request registered! Activation coming in Phase 2.')}>
                Request to Join a Squad
              </button>
              <button className="btn btn-primary"
                onClick={() => setSquadMsg('✅ New squad created! Share your code with peers. Activation in Phase 2.')}>
                <Users size={16} /> Create a New Squad
              </button>
              {squadMsg && <div style={{ background:'#1c2e24', border:'1px solid #00d296', borderRadius:8, padding:12, fontSize:12, color:'#00d296' }}>{squadMsg}</div>}
            </div>
          )}
        </div>

        {settingsTab !== 'squad' && (
          <div style={{ padding:'16px 24px', borderTop:'1px solid #2b2b36' }}>
            {settingsSaved && <div style={{ fontSize:12, marginBottom:10, color: settingsSaved.startsWith('✅') ? '#00d296' : '#ff4444' }}>{settingsSaved}</div>}
            <button className="btn btn-primary" onClick={saveSettings} style={{ width:'100%' }}>Save Changes</button>
          </div>
        )}
      </div>
    </>
  );
}

function App() {
  const [token, setToken]           = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode]     = useState('login'); // 'login' | 'register'
  const [authForm, setAuthForm]     = useState({ name: '', email: '', password: '', employment_type: 'Gig Worker', sector: 'Delivery', county: 'Nairobi' });
  const [authError, setAuthError]   = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [profile, setProfile]       = useState({ current_income: 40000 });
  const [evaluation, setEvaluation] = useState(null);
  const [incomeHistory, setIncomeHistory] = useState([]);
  const [isSyncing, setIsSyncing]   = useState(false);
  
  // Settings panel
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [settingsTab, setSettingsTab]     = useState('account');
  const [settingsSaved, setSettingsSaved] = useState('');
  const [settingsData, setSettingsData]   = useState({
    name: '', phone: '', sector: '', county: '', employment_type: '',
    src_cap: 50000, deferred_period: 30
  });
  
  // Trust Squad state
  const [squadCode, setSquadCode]   = useState('');
  const [squadName, setSquadName]   = useState('');
  const [squadMsg, setSquadMsg]     = useState('');

  const [claimHistory, setClaimHistory] = useState([]);
  const [claimMsg, setClaimMsg]     = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);

  // AI Copilot
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your IDCS AI Copilot. Ask me about your velocity score, income trends, or how to improve your resilience level." }
  ]);
  const [chatInput, setChatInput]     = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef                    = useRef(null);

  // Prophet forecast
  const [forecast, setForecast]       = useState([]);

  // ── Auth helpers ──────────────────────────────────────────────
  const authHeaders = (extra = {}) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra
  });

  const handleAuth = async () => {
    setAuthLoading(true);
    setAuthError('');
    const url = authMode === 'login' ? `${API}/auth/login` : `${API}/auth/register`;
    const body = authMode === 'login'
      ? { email: authForm.email, password: authForm.password }
      : { name: authForm.name, email: authForm.email, password: authForm.password,
          employment_type: authForm.employment_type, sector: authForm.sector, county: authForm.county };
    try {
      const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.detail || 'Authentication failed'); return; }
      setToken(data.access_token);
      setCurrentUser({ id: data.user_id, name: data.name, is_admin: data.is_admin });
    } catch { setAuthError('Network error. Is the backend running?'); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = () => { setToken(null); setCurrentUser(null); setEvaluation(null); setClaimHistory([]); };

  // ── Evaluate ──────────────────────────────────────────────────
  const generateMockHistory = (base) => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months.map(m => {
      const isDip = Math.random() > 0.8;
      const isIrregular = Math.random() > 0.9;
      let amount = isDip ? base * 0.6 : base * (0.9 + Math.random() * 0.2);
      if (isIrregular) amount += base * 2.5;
      return { month: m, amount, status: isDip ? 'Unpaid' : 'Paid', category: isIrregular ? 'Loan' : 'Revenue' };
    });
  };

  // ── Settings handlers ──────────────────────────────────────
  const openSettings = async () => {
    try {
      const res = await fetch(`${API}/auth/me`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setSettingsData({
          name:            d.name            || '',
          phone:           d.phone           || '',
          sector:          d.sector          || '',
          county:          d.county          || '',
          employment_type: d.employment_type || '',
          src_cap:         d.src_cap         ?? 50000,
          deferred_period: d.deferred_period ?? 30,
        });
      }
    } catch {}
    setSettingsOpen(true);
    setSettingsSaved('');
    setSquadMsg('');
  };

  const saveSettings = async () => {
    try {
      const res = await fetch(`${API}/user/settings`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(settingsData)
      });
      if (res.ok) {
        setSettingsSaved('✅ Settings saved successfully.');
        setTimeout(() => setSettingsSaved(''), 3000);
      } else {
        setSettingsSaved('❌ Failed to save. Please try again.');
      }
    } catch { setSettingsSaved('❌ Network error.'); }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const history = generateMockHistory(profile.current_income);
      setIncomeHistory(history);
      const res = await fetch(`${API}/evaluate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          current_income: profile.current_income,
          income_history: history,
          premium: 0,
          deferred_period: 30,
          transaction_count: 55,
          sector_dip: 0.02,
          squad_no_claim_bonus: true,
          severe_weather_event: false
        })
      });
      if (res.ok) { const d = await res.json(); setEvaluation(d.evaluation); setForecast(d.forecast || []); }
      else if (res.status === 401) handleLogout();
    } catch (e) { console.error('Sync error', e); }
    setTimeout(() => setIsSyncing(false), 800);
  };

  const fetchClaimHistory = async () => {
    try {
      const res = await fetch(`${API}/claims/history`, { headers: authHeaders() });
      if (res.ok) setClaimHistory(await res.json());
    } catch {}
  };

  const fileClaim = async () => {
    setClaimMsg('');
    try {
      const res = await fetch(`${API}/claims/file`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ sector_dip: 0.02, severe_weather_event: false })
      });
      const d = await res.json();
      setClaimMsg(d.message || d.detail || 'Done.');
      fetchClaimHistory();
    } catch { setClaimMsg('Error filing claim.'); }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: chatInput.trim() };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ messages: updated })
      });
      if (res.ok) {
        const d = await res.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: d.content }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Copilot unavailable right now. Please try again shortly.' }]);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Is the backend running?' }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => { if (token) { handleSync(); fetchClaimHistory(); } }, [token]);

  // ── Login / Register Screen ───────────────────────────────────
  if (!token) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <ShieldAlert size={36} style={{ color: '#00d296', marginBottom: 8 }} />
            <h1>IDCS Portal</h1>
            <p>{authMode === 'login' ? 'Sign in to your dashboard' : 'Create your IDCS account'}</p>
          </div>

          {authMode === 'register' && (
            <div className="form-group">
              <label>Full Name</label>
              <input className="form-control" placeholder="e.g. Amina Wanjiku"
                value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} />
            </div>
          )}
          <div className="form-group">
            <label>Work Email</label>
            <input type="email" className="form-control" placeholder="name@company.co.ke"
              value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" className="form-control" placeholder="••••••••"
              value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && handleAuth()} />
          </div>
          {authMode === 'register' && (
            <>
              <div className="form-group">
                <label>Employment Type</label>
                <select className="form-control" value={authForm.employment_type}
                  onChange={e => setAuthForm({...authForm, employment_type: e.target.value})}>
                  <option>Gig Worker</option><option>SRC_Teacher</option>
                  <option>Private Contract</option><option>Self-Employed/Jua Kali</option>
                </select>
              </div>
              <div className="form-group">
                <label>Sector</label>
                <input className="form-control" placeholder="e.g. Delivery, Retail"
                  value={authForm.sector} onChange={e => setAuthForm({...authForm, sector: e.target.value})} />
              </div>
              <div className="form-group">
                <label>County</label>
                <input className="form-control" placeholder="e.g. Nairobi"
                  value={authForm.county} onChange={e => setAuthForm({...authForm, county: e.target.value})} />
              </div>
            </>
          )}

          {authError && <div className="badge badge-danger" style={{ marginBottom: 12, width: '100%', textAlign: 'center', padding: '10px' }}>{authError}</div>}

          <button className="btn btn-primary" onClick={handleAuth} disabled={authLoading} style={{ marginTop: 8 }}>
            {authLoading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
          <button className="btn btn-secondary" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
            style={{ marginTop: 10 }}>
            {authMode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
          </button>
        </div>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  const basePremium    = (evaluation?.mu || profile.current_income) * 0.02;
  const upfrontPremium = basePremium * 6 * 0.85;

  // ── Main Dashboard ────────────────────────────────────────────
  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo"><ShieldAlert size={28} /><span>IDCS</span></div>
        </div>

        <div className="nav-section">
          <div className="nav-label">Signed in as</div>
          <div style={{ color: '#00d296', fontWeight: 600, fontSize: 14, padding: '4px 0 12px' }}>
            {currentUser?.name}
          </div>
          <div className="nav-label">Current Month Income (KES)</div>
          <div className="form-group">
            <input type="number" className="form-control"
              value={profile.current_income}
              onChange={e => setProfile({...profile, current_income: Number(e.target.value)})} />
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-label">Live Actions</div>
          <button className="btn btn-primary" onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={18} />}
            {isSyncing ? 'Syncing...' : 'Sync & Evaluate'}
          </button>

          {evaluation?.eligible && (
            <button className="btn btn-primary" onClick={fileClaim}
              style={{ marginTop: 10, backgroundColor: '#ff9800', border: 'none' }}>
              📋 File a Claim
            </button>
          )}

          <button className="btn btn-secondary" onClick={handleLogout} style={{ marginTop: 12 }}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>

        {claimMsg && (
          <div className="nav-section">
            <div className="badge" style={{ backgroundColor: '#1c1c24', border: '1px solid #00d296', color: '#00d296', padding: '10px', borderRadius: '8px', fontSize: 12 }}>
              {claimMsg}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="topbar">
          <div className="page-title">Income Dip Compensation Dashboard</div>
          <div className="topbar-actions">
            {evaluation?.auto_disburse && (
              <div className="badge badge-success" style={{ backgroundColor: '#00d296', color: '#121212', fontWeight: 'bold' }}>
                ⚡ Auto-Disbursement Triggered
              </div>
            )}
            {evaluation?.financial_level && (
              <div className="badge badge-secondary" style={{ border: '1px solid #ffaa00', color: '#ffaa00' }}>
                🏆 Level {evaluation.financial_level} Resilience
              </div>
            )}
            {evaluation?.needs_manual_audit && (
              <div className="badge badge-warning" style={{ backgroundColor: '#ff9800', color: '#121212' }}>
                <AlertTriangle size={12} /> Manual Audit Required
              </div>
            )}
            {evaluation && (
              <div className={`badge ${evaluation.eligible ? 'badge-success' : 'badge-danger'}`}>
                {evaluation.eligible ? '✓ Eligible for Payout' : '✕ Not Eligible'}
              </div>
            )}
            <div className="badge badge-success">
              <CheckCircle2 size={14} style={{ marginRight: 6 }} /> System Online
            </div>
            <button className="btn btn-secondary" onClick={openSettings}
              style={{ padding:'8px', width:'auto' }} title="Settings">
              <Settings size={20} />
            </button>
          </div>
        </div>

        {settingsOpen && (
          <SettingsPanel
            settingsTab={settingsTab}
            setSettingsTab={setSettingsTab}
            settingsData={settingsData}
            setSettingsData={setSettingsData}
            settingsSaved={settingsSaved}
            saveSettings={saveSettings}
            squadMsg={squadMsg}
            setSquadMsg={setSquadMsg}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        <div className="dashboard-scroll">
          {/* Metric Cards */}
          <div className="grid-metrics">
            <div className="card">
              <div className="card-title">Average Income (µ)</div>
              <div className="card-value">KES {evaluation?.mu ? evaluation.mu.toLocaleString(undefined, {maximumFractionDigits:0}) : '—'}</div>
              <div className="card-subtitle text-accent"><BarChart3 size={14} /> Based on 12 months data</div>
            </div>
            <div className="card">
              <div className="card-title">Stability Index</div>
              <div className="card-value">{evaluation?.stability_score ? evaluation.stability_score.toFixed(1) : '—'} / 100</div>
              <div className={`card-subtitle ${(evaluation?.stability_score || 0) < 50 ? 'text-danger' : 'text-accent'}`}>
                <TrendingDown size={14} /> {evaluation?.risk_level || 'Unknown'} Risk
              </div>
            </div>
            <div className="card">
              <div className="card-title">Dip Probability</div>
              <div className="card-value">{evaluation?.dip_probability ? evaluation.dip_probability.toFixed(1) : '—'}%</div>
              <div className="card-subtitle text-warning"><Info size={14} /> Historical dip frequency</div>
            </div>
            <div className="card">
              <div className="card-title">Estimated Payout</div>
              <div className="card-value">KES {evaluation?.payout ? evaluation.payout.toLocaleString(undefined, {maximumFractionDigits:0}) : '—'}</div>
              <div className="card-subtitle text-accent"><DollarSign size={14} /> Covers up to 70% of income loss</div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid-charts">
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Income History & Variance</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={incomeHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2b2b36" />
                    <XAxis dataKey="month" stroke="#9e9ea7" tick={{fill:'#9e9ea7'}} />
                    <YAxis stroke="#9e9ea7" tick={{fill:'#9e9ea7'}} />
                    <Tooltip contentStyle={{ backgroundColor:'#1c1c24', border:'1px solid #2b2b36', borderRadius:'8px' }} itemStyle={{ color:'#f1f1f1' }} />
                    <Line type="monotone" dataKey="amount" stroke="#00d296" strokeWidth={3}
                      dot={{r:4, fill:'#121216', stroke:'#00d296', strokeWidth:2}} activeDot={{r:6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Recent Transactions</h3>
              <div className="table-container" style={{ maxHeight: '280px' }}>
                <table>
                  <thead><tr><th>Month</th><th>Status</th><th>Amount</th></tr></thead>
                  <tbody>
                    {incomeHistory.slice(-6).map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.month}</td>
                        <td><span className={`badge ${item.status === 'Paid' ? 'badge-success' : 'badge-danger'}`}>{item.status}</span></td>
                        <td>KES {item.amount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Claims History */}
          {claimHistory.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 16 }}>My Claims</h3>
              <div className="table-container">
                <table>
                  <thead><tr><th>Claim #</th><th>Dip Amount</th><th>Payout</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {claimHistory.map(c => (
                      <tr key={c.claim_id}>
                        <td>#{c.claim_id}</td>
                        <td>KES {c.dip_amount?.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                        <td>KES {c.payout?.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                        <td>
                          <span className={`badge ${c.status === 'APPROVED' || c.status === 'AUTO_DISBURSED' ? 'badge-success' : c.status === 'FLAGGED_FOR_AUDIT' ? 'badge-warning' : 'badge-danger'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: '#9e9ea7' }}>{c.created_at?.slice(0,10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Prophet 6-Month Forecast */}
          {forecast.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <span style={{ fontSize:20 }}>🔮</span>
                <h3 style={{ margin:0 }}>6-Month Income Forecast</h3>
                <span className="badge badge-secondary" style={{ marginLeft:'auto', fontSize:11 }}>Prophet AI</span>
              </div>
              <p style={{ color:'#9e9ea7', fontSize:13, marginBottom:20 }}>
                Trained on your income history. Predicts seasonal patterns and flags high-risk months before they hit.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
                {forecast.map((f, i) => (
                  <div key={i} style={{
                    background: f.is_high_risk ? 'rgba(255,75,75,0.08)' : 'rgba(0,210,150,0.04)',
                    border: `1px solid ${f.is_high_risk ? 'rgba(255,75,75,0.35)' : '#2b2b36'}`,
                    borderRadius: 10, padding: '14px 16px'
                  }}>
                    <div style={{ fontSize:12, color:'#9e9ea7', marginBottom:6, fontWeight:600 }}>{f.month}</div>
                    <div style={{ fontSize:20, fontWeight:700,
                      color: f.is_high_risk ? '#ff4b4b' : '#f1f1f1' }}>
                      KES {f.predicted_income.toLocaleString(undefined, {maximumFractionDigits:0})}
                    </div>
                    <div style={{ fontSize:11, color:'#9e9ea7', marginTop:4 }}>
                      Floor: KES {f.predicted_lower.toLocaleString(undefined, {maximumFractionDigits:0})}
                    </div>
                    {f.is_high_risk
                      ? <div style={{ marginTop:8, fontSize:11, color:'#ff4b4b', fontWeight:700 }}>⚠ High Risk — Dip Likely</div>
                      : <div style={{ marginTop:8, fontSize:11, color:'#00d296', fontWeight:600 }}>✓ Stable</div>
                    }
                  </div>
                ))}
              </div>
              {evaluation?.prophet_risk_score > 0 && (
                <div style={{ marginTop:16, padding:'10px 14px', background:'#121216',
                  borderRadius:8, border:'1px solid #2b2b36', fontSize:13, color:'#9e9ea7' }}>
                  Prophet Risk Score: <b style={{ color: evaluation.prophet_risk_score > 50 ? '#ff4b4b' : evaluation.prophet_risk_score > 20 ? '#f5a623' : '#00d296' }}>
                    {evaluation.prophet_risk_score.toFixed(1)} / 100
                  </b>
                  <span style={{ marginLeft:12, fontSize:12 }}>
                    {evaluation.prophet_risk_score > 50 ? '— High seasonal risk detected. Premium loading applied.' :
                     evaluation.prophet_risk_score > 20 ? '— Moderate risk. Monitor income trend.' :
                     '— Low risk outlook. Maintain your velocity score.'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* AI Copilot Chat */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <MessageSquare size={20} color="#00d296" />
              <h3 style={{ margin:0 }}>IDCS AI Copilot</h3>
              <span className="badge badge-secondary" style={{ marginLeft:'auto', fontSize:11 }}>Powered by Gemini</span>
            </div>
            <div style={{
              background:'#121216', borderRadius:8, border:'1px solid #2b2b36',
              padding:16, height:260, overflowY:'auto',
              display:'flex', flexDirection:'column', gap:10, marginBottom:16
            }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth:'78%', padding:'10px 14px', borderRadius:12,
                    background: msg.role === 'user' ? '#00d296' : '#1c1c24',
                    color: msg.role === 'user' ? '#000' : '#f1f1f1',
                    border: msg.role === 'assistant' ? '1px solid #2b2b36' : 'none',
                    fontSize:13, lineHeight:1.6
                  }}>{msg.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display:'flex', justifyContent:'flex-start' }}>
                  <div style={{ padding:'10px 14px', background:'#1c1c24', borderRadius:12,
                    border:'1px solid #2b2b36', color:'#9e9ea7', fontSize:13,
                    display:'flex', alignItems:'center', gap:8 }}>
                    <RefreshCw size={12} style={{ animation:'spin 1s linear infinite' }} />
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <input
                className="form-control"
                placeholder="Ask about your scores, claims, or income trends..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                style={{ flex:1 }}
              />
              <button className="btn btn-primary" onClick={sendChat}
                disabled={chatLoading} style={{ width:'auto', padding:'10px 18px' }}>
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* Plans */}
          <h2 style={{ marginBottom: 24 }}>Choose Your Income Safety Plan</h2>
          <div className="pricing-grid">
            <div className={`pricing-card ${selectedPlan === 'monthly' ? 'selected' : ''}`} onClick={() => setSelectedPlan('monthly')}>
              <div className="pricing-title">📈 Embedded Micro-Premium</div>
              <div className="pricing-price">
                {((evaluation?.micro_deduction_rate ?? 0.015) * 100).toFixed(1)}%
                <span className="pricing-period"> per transaction</span>
              </div>
              <div className="pricing-desc">
                Automatically secured from your incoming platform earnings.<br/>
                No monthly lump sum required. Rate dynamically updates based on your Velocity Score.
              </div>
              <button className={selectedPlan === 'monthly' ? 'btn btn-primary' : 'btn btn-secondary'}>
                {selectedPlan === 'monthly' ? 'Active Plan' : 'Select Embedded'}
              </button>
            </div>

            <div className={`pricing-card ${selectedPlan === 'upfront' ? 'selected' : ''}`} onClick={() => setSelectedPlan('upfront')}>
              <div className="pricing-title">🛡️ 6-Month Shield</div>
              <div className="pricing-price">
                KES {upfrontPremium.toLocaleString(undefined, {maximumFractionDigits:0})}
                <span className="pricing-period"> Total</span>
              </div>
              <div className="pricing-desc">
                One-time payment for 6 months of guaranteed coverage.<br/>
                <b>15% Stability Discount Included.</b>
              </div>
              <button className={selectedPlan === 'upfront' ? 'btn btn-primary' : 'btn btn-secondary'}>
                {selectedPlan === 'upfront' ? 'Active Plan' : 'Select Upfront'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

export default App;
