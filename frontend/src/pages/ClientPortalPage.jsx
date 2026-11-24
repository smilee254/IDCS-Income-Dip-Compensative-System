import React from 'react';
import { ShieldCheck, Lock, ArrowRight, UserCheck, AlertCircle } from 'lucide-react';
import EditorialHero from '../components/dashboard/EditorialHero';
import CashflowTrend from '../components/dashboard/CashflowTrend';
import ShieldStatusHero from '../components/dashboard/ShieldStatusHero';
import ProtectionPlanPicker from '../components/dashboard/ProtectionPlanPicker';
import ClaimSection from '../components/claims/ClaimSection';
import CalibrationProgress from '../components/dashboard/CalibrationProgress';
import QuickActionGrid from '../components/dashboard/QuickActionGrid';
import TrustSquadCard from '../components/squad/TrustSquadCard';

export default function DashboardPage({
  currentUser,
  incomeHistory,
  evaluation,
  recentActivity,
  claimHistory,
  calibration,
  tiers,
  authHeaders,
  authMode,
  setAuthMode,
  phoneInput,
  setPhoneInput,
  pinInput,
  setPinInput,
  authError,
  setAuthError,
  authLoading,
  handleAuth,
  handleDemoLogin,
  handleLogout,
  theme,
  setCashModalOpen,
  setTillModalOpen,
  setUssdOpen,
  handleFileUpload,
  handleSelectTier,
  tierLoading,
  tierMsg,
  fileClaim,
  claimLoading,
  claimMsg,
  claimGateAlert,
  setClaimGateAlert,
  setSettingsOpen,
  setSettingsTab,
  mySquad,
  squadInputName,
  setSquadInputName,
  squadInputCode,
  setSquadInputCode,
  handleCreateSquad,
  handleJoinSquad,
  squadMsg,
  onNavigate
}) {
  const onOpenUssd = () => setUssdOpen(true);

  // If not logged in, show IDCS authentication card with quick demo login
  if (!currentUser) {
    return (
      <div style={{ padding: '60px 0 100px' }}>
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          <div className="card" style={{ padding: '40px 36px', boxShadow: 'var(--shadow-subtle)' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '10px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--warm-stone-border)',
                color: 'var(--warm-stone)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
                fontSize: 15,
                fontWeight: 700
              }}>
                IDCS
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 6 }}>
                IDCS Protection Dashboard
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
                Income Dip Compensative System. Enter your registered phone number or test with demo access.
              </p>
            </div>

            {authError && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: 'var(--semantic-danger-bg)',
                border: '1px solid var(--semantic-danger-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--semantic-danger-text)',
                fontSize: 13,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <AlertCircle size={15} />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Registered Phone or Email
                </label>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="0712345678 or amina@idcs.ke"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Security PIN / Password
                </label>
                <input 
                  type="password"
                  className="form-control"
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={authLoading}
                style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 4 }}
              >
                {authLoading ? 'Signing in...' : (authMode === 'login' ? 'Sign In to IDCS' : 'Register New Account')}
                {!authLoading && <ArrowRight size={14} />}
              </button>

              {/* 1-Click Instant Demo Login */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDemoLogin}
                disabled={authLoading}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '11px',
                  borderColor: 'var(--warm-stone-border)',
                  color: 'var(--warm-stone)',
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <UserCheck size={15} />
                <span>Instant Demo Access (Amina Wanjiku)</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setAuthError('');
                }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {authMode === 'login' ? "Don't have an account? Register" : 'Already registered? Sign In'}
              </button>

              {/* 1-Click Demo Fill options */}
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneInput('0712345678');
                    setPinInput('1234');
                  }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    fontSize: 11, cursor: 'pointer', textDecoration: 'underline'
                  }}
                >
                  Fill Phone Demo
                </button>
                <span style={{ color: 'var(--border-color)', fontSize: 11 }}>•</span>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneInput('amina@idcs.ke');
                    setPinInput('1234');
                  }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    fontSize: 11, cursor: 'pointer', textDecoration: 'underline'
                  }}
                >
                  Fill Email Demo
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated IDCS Dashboard View
  return (
    <div className="idcs-dashboard-authenticated" style={{ padding: '24px 0 80px' }}>
      {/* Editorial Statement Banner with 3-Pillar Institutional Summary Bar */}
      <EditorialHero
        onExplorePlans={() => document.getElementById('plans-section')?.scrollIntoView({ behavior: 'smooth' })}
        onOpenUssd={onOpenUssd}
      />

      <input
        id="quick-pdf-upload"
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* 2-Column Institutional Workspace Grid */}
      <div className="dashboard-grid">
        {/* Main Column: Trend Chart, Plan Picker, Claims */}
        <div className="dashboard-main-col">
          <CashflowTrend
            incomeHistory={incomeHistory}
            evaluation={evaluation}
            recentActivity={recentActivity}
            theme={theme}
          />

          <ProtectionPlanPicker
            tiers={tiers}
            currentTierKey={evaluation?.tier?.tier_id || 'TIER_2'}
            onSelectTier={handleSelectTier}
            tierLoading={tierLoading}
            tierMsg={tierMsg}
          />

          <ClaimSection
            claims={claimHistory}
            claimMsg={claimMsg}
            claimGateAlert={claimGateAlert}
            onOpenSquad={() => { setSettingsTab('squad'); setSettingsOpen(true); }}
            onDismissGateAlert={() => setClaimGateAlert(null)}
            onFileClaim={fileClaim}
            isEligible={evaluation?.eligible}
            claimLoading={claimLoading}
          />
        </div>

        {/* Side Column: Shield Overview, Calibration, Quick Ingestion, Trust Squad */}
        <div className="dashboard-side-col">
          <ShieldStatusHero
            evaluation={evaluation}
            user={currentUser}
            tier={evaluation?.tier}
            onFileClaim={fileClaim}
            claimLoading={claimLoading}
            onOpenTillModal={() => setTillModalOpen(true)}
          />

          <CalibrationProgress
            calibration={calibration}
            onDeclareCash={() => setCashModalOpen(true)}
            onUploadStatement={() => document.getElementById('quick-pdf-upload')?.click()}
          />

          <QuickActionGrid
            onDeclareCash={() => setCashModalOpen(true)}
            onUploadClick={handleFileUpload}
            onOpenUssd={onOpenUssd}
            onOpenTillModal={() => setTillModalOpen(true)}
            tillConnected={Boolean(currentUser?.till_number)}
            tillNumber={currentUser?.till_number}
            tillType={currentUser?.till_type}
          />

          <TrustSquadCard
            mySquad={mySquad}
            squadInputName={squadInputName}
            setSquadInputName={setSquadInputName}
            squadInputCode={squadInputCode}
            setSquadInputCode={setSquadInputCode}
            handleCreateSquad={handleCreateSquad}
            handleJoinSquad={handleJoinSquad}
            squadMsg={squadMsg}
          />
        </div>
      </div>
    </div>
  );
}
