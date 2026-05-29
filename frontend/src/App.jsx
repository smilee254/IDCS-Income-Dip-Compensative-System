import React, { useState, useEffect } from 'react';
import { 
  User, ShieldAlert, BarChart3, Upload, RefreshCw, 
  Settings, LogOut, CheckCircle2, TrendingDown, Info,
  DollarSign
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState({
    name: 'John Doe',
    age: 30,
    employment_type: 'Public Full-Time',
    current_income: 40000,
    deferred_period: 30
  });

  const [evaluation, setEvaluation] = useState(null);
  const [incomeHistory, setIncomeHistory] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Generate 12 months mock history
  const generateMockHistory = (base) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map(m => {
      // Create some variance and an occasional dip
      const isDip = Math.random() > 0.8;
      const isIrregular = Math.random() > 0.9;
      let amount = isDip ? base * 0.6 : base * (0.9 + Math.random() * 0.2);
      
      // Simulate a loan/chama spike
      if (isIrregular) amount += base * 2.5;

      return {
        month: m,
        amount: amount,
        status: isDip ? 'Unpaid' : 'Paid',
        category: isIrregular ? 'Loan' : 'Revenue'
      };
    });
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const history = generateMockHistory(profile.current_income);
      setIncomeHistory(history);

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          age: profile.age,
          employment_type: profile.employment_type,
          current_income: profile.current_income,
          income_history: history,
          premium: 0,
          deferred_period: profile.deferred_period,
          transaction_count: 55, // Simulated HIGH velocity for level 3
          sector_dip: 0.02, // Simulated 2% sector dip (macro)
          squad_no_claim_bonus: true, // Simulated active Trust Squad
          severe_weather_event: false // Normal weather
        })
      });

      if (response.ok) {
        const data = await response.json();
        setEvaluation(data.evaluation);
      }
    } catch (err) {
      console.error("Sync Error", err);
    }
    setTimeout(() => setIsSyncing(false), 800);
  };

  useEffect(() => {
    if (isLoggedIn) {
      handleSync();
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <h1>IDCS Portal</h1>
            <p>Sign in to your IDCS Dashboard</p>
          </div>
          <div className="form-group">
            <label>Work Email</label>
            <input type="email" className="form-control" placeholder="name@company.co.ke" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" className="form-control" placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" onClick={() => setIsLoggedIn(true)} style={{ marginTop: 16 }}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const basePremium = (evaluation?.mu || profile.current_income) * 0.02;
  const upfrontPremium = basePremium * 6 * 0.85;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <ShieldAlert size={28} />
            <span>IDCS</span>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-label">User Identity</div>
          <div className="form-group">
            <label>Full Name</label>
            <input 
              type="text" className="form-control" 
              value={profile.name} 
              onChange={e => setProfile({...profile, name: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label>Age</label>
            <input 
              type="number" className="form-control" 
              value={profile.age} 
              onChange={e => setProfile({...profile, age: Number(e.target.value)})} 
            />
          </div>
          <div className="form-group">
            <label>Employment</label>
            <select 
              className="form-control" 
              value={profile.employment_type}
              onChange={e => setProfile({...profile, employment_type: e.target.value})}
            >
              <option>Public Full-Time</option>
              <option>Private Contract</option>
              <option>Self-Employed/Jua Kali</option>
              <option>Unemployed</option>
            </select>
          </div>
          <div className="form-group">
            <label>Current Month Income (KES)</label>
            <input 
              type="number" className="form-control" 
              value={profile.current_income} 
              onChange={e => setProfile({...profile, current_income: Number(e.target.value)})} 
            />
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-label">Data Sources</div>
          <div className="form-group">
            <label>M-Pesa Statement (CSV)</label>
            <input type="file" className="form-control" accept=".csv" style={{ padding: '8px' }} />
          </div>
          <div className="form-group">
            <label>Bank Statement (PDF)</label>
            <input type="file" className="form-control" accept=".pdf" style={{ padding: '8px' }} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <input type="checkbox" id="includeLoans" />
            <label htmlFor="includeLoans" style={{ marginBottom: 0, cursor: 'pointer' }}>Include Loans / Chamas</label>
          </div>
        </div>

        <div className="nav-section" style={{ marginTop: 'auto' }}>
          <button className="btn btn-primary" onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? <RefreshCw className="spin" size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={18} />}
            {isSyncing ? 'Syncing...' : 'Sync Profile'}
          </button>
          <button className="btn btn-secondary" onClick={() => setIsLoggedIn(false)} style={{ marginTop: 12 }}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
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
                 Manual Audit Required (Sector Mismatch)
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
            <button className="btn btn-secondary" style={{ padding: '8px', width: 'auto' }}>
              <Settings size={20} />
            </button>
          </div>
        </div>

        <div className="dashboard-scroll">
          <div className="grid-metrics">
            <div className="card">
              <div className="card-title">Average Income (µ)</div>
              <div className="card-value">
                KES {evaluation?.mu ? evaluation.mu.toLocaleString(undefined, {maximumFractionDigits:0}) : '0'}
              </div>
              <div className="card-subtitle text-accent">
                <BarChart3 size={14} /> Based on 12 months data
              </div>
            </div>
            
            <div className="card">
              <div className="card-title">Stability Index</div>
              <div className="card-value">
                {evaluation?.stability_score ? evaluation.stability_score.toFixed(1) : '0'} / 100
              </div>
              <div className={`card-subtitle ${(evaluation?.stability_score || 0) < 50 ? 'text-danger' : 'text-accent'}`}>
                <TrendingDown size={14} /> 
                {evaluation?.risk_level || 'Unknown'} Risk
              </div>
            </div>

            <div className="card">
              <div className="card-title">Dip Probability</div>
              <div className="card-value">
                {evaluation?.dip_probability ? evaluation.dip_probability.toFixed(1) : '0'}%
              </div>
              <div className="card-subtitle text-warning">
                <Info size={14} /> Historical dip frequency
              </div>
            </div>

            <div className="card">
              <div className="card-title">Estimated Payout</div>
              <div className="card-value">
                KES {evaluation?.payout ? evaluation.payout.toLocaleString(undefined, {maximumFractionDigits:0}) : '0'}
              </div>
              <div className="card-subtitle text-accent">
                <DollarSign size={14} /> Covers up to 70% of income loss
              </div>
            </div>
          </div>

          <div className="grid-charts">
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Income History & Variance</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={incomeHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2b2b36" />
                    <XAxis dataKey="month" stroke="#9e9ea7" tick={{fill: '#9e9ea7'}} />
                    <YAxis stroke="#9e9ea7" tick={{fill: '#9e9ea7'}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1c1c24', border: '1px solid #2b2b36', borderRadius: '8px' }}
                      itemStyle={{ color: '#f1f1f1' }}
                    />
                    <Line type="monotone" dataKey="amount" stroke="#00d296" strokeWidth={3} dot={{r: 4, fill: '#121216', stroke: '#00d296', strokeWidth: 2}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Recent Transactions</h3>
              <div className="table-container" style={{ maxHeight: '280px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeHistory.slice(-6).map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.month}</td>
                        <td>
                          <span className={`badge ${item.status === 'Paid' ? 'badge-success' : 'badge-danger'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>KES {item.amount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <h2 style={{ marginBottom: 24 }}>Choose Your Income Safety Plan</h2>
          <div className="pricing-grid">
            <div className={`pricing-card ${selectedPlan === 'monthly' ? 'selected' : ''}`} onClick={() => setSelectedPlan('monthly')}>
              <div className="pricing-title">📈 Embedded Micro-Premium</div>
              <div className="pricing-price">
                {(evaluation?.micro_deduction_rate * 100 || 1.5).toFixed(1)}%
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

            <div className={`pricing-card ${selectedPlan === 'upfront' ? 'selected' : ''}`} onClick={() => setSelectedPlan('upfront')} style={{ borderColor: selectedPlan === 'upfront' ? '#00d296' : '' }}>
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
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;
