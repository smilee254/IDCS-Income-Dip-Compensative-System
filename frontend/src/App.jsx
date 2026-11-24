import React, { useState, useEffect, Suspense, lazy } from 'react';
import Header from './components/navigation/Header';
import MobileDrawer from './components/navigation/MobileDrawer';
import Footer from './components/navigation/Footer';

// Pages
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ServicesOverviewPage from './pages/ServicesOverviewPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import InsightsPage from './pages/InsightsPage';
import ResourcesPage from './pages/ResourcesPage';
import ContactPage from './pages/ContactPage';
import ClientPortalPage from './pages/ClientPortalPage';

// Shared Components & Modals
import HelpDrawer from './components/common/HelpDrawer';
import TillConnectionModal from './components/settings/TillConnectionModal';

const SettingsPanel = lazy(() => import('./SettingsPanel'));
const CashModal = lazy(() => import('./CashModal'));
const USSDSimulator = lazy(() => import('./USSDSimulator'));

const API = '/api';

export default function App() {
  // ── Visual Theme System ───────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('idcs_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('idcs_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  // ── URL & Navigation Routing ──────────────────────────────────
  const [currentRoute, setCurrentRoute] = useState(() => window.location.pathname || '/');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentRoute(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Client Portal & Risk Engine State ─────────────────────────
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [phoneInput, setPhoneInput] = useState('+254712345678');
  const [pinInput, setPinInput] = useState('1234');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [evaluation, setEvaluation] = useState(null);
  const [calibration, setCalibration] = useState(null);
  const [incomeHistory, setIncomeHistory] = useState([]);
  const [recentActivity, setRecentActivity] = useState({ transactions: [], cash_declarations: [] });
  const [isSyncing, setIsSyncing] = useState(false);

  // Claims
  const [claimHistory, setClaimHistory] = useState([]);
  const [claimMsg, setClaimMsg] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimGateAlert, setClaimGateAlert] = useState(null);

  // Tiers
  const [tiers, setTiers] = useState([]);
  const [tierLoading, setTierLoading] = useState(false);
  const [tierMsg, setTierMsg] = useState('');

  // Trust Squad
  const [mySquad, setMySquad] = useState(null);
  const [squadInputName, setSquadInputName] = useState('');
  const [squadInputCode, setSquadInputCode] = useState('');
  const [squadMsg, setSquadMsg] = useState('');

  // Modals & Drawers
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('account');
  const [settingsSaved, setSettingsSaved] = useState('');
  const [settingsData, setSettingsData] = useState({
    name: '', phone: '', sector: '', county: '', employment_type: '',
    src_cap: 50000, deferred_period: 30
  });

  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [ussdOpen, setUssdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tillModalOpen, setTillModalOpen] = useState(false);

  // AI Assistant Chat (Help Drawer)
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: "Hello! I am the IDCS Actuarial & Protection Assistant. How may I assist you regarding risk modeling, parametric triggers, or claim procedures?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // ── Session Rehydration ───────────────────────────────────────
  useEffect(() => {
    const savedToken = localStorage.getItem('idcs_token');
    const savedUser = localStorage.getItem('idcs_user');
    if (savedToken) {
      setToken(savedToken);
      if (savedUser) {
        try { setCurrentUser(JSON.parse(savedUser)); } catch {}
      }
    }
  }, []);

  const authHeaders = (extra = {}) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra
  });

  // ── Portal Authentication ─────────────────────────────────────
  const handlePortalAuth = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    const url = authMode === 'login' ? `${API}/auth/login` : `${API}/auth/register`;

    const identifier = phoneInput.trim();
    const body = authMode === 'login'
      ? { email: identifier, password: pinInput }
      : {
          name: 'Merchant Enterprise',
          email: identifier.includes('@') ? identifier : `${identifier.replace(/[^0-9]/g, '')}@idcs.ke`,
          phone: identifier.includes('@') ? '' : identifier,
          password: pinInput,
          employment_type: 'Merchant Enterprise',
          sector: 'Retail Commerce',
          county: 'Nairobi'
        };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || 'Authentication failed. Please verify credentials.');
        return;
      }
      setToken(data.access_token);
      const userObj = { id: data.user_id, name: data.name, phone: phoneInput, is_admin: data.is_admin };
      setCurrentUser(userObj);
      localStorage.setItem('idcs_token', data.access_token);
      localStorage.setItem('idcs_user', JSON.stringify(userObj));
    } catch {
      setAuthError('Connection error to client portal gateway.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'amina@idcs.ke', password: '1234' })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || 'Demo login failed.');
        return;
      }
      setToken(data.access_token);
      const userObj = { id: data.user_id, name: data.name, phone: '0712345678', is_admin: data.is_admin };
      setCurrentUser(userObj);
      localStorage.setItem('idcs_token', data.access_token);
      localStorage.setItem('idcs_user', JSON.stringify(userObj));
    } catch {
      setAuthError('Connection error to client portal gateway.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('idcs_token');
    localStorage.removeItem('idcs_user');
    setToken(null);
    setCurrentUser(null);
    setEvaluation(null);
    setIncomeHistory([]);
    setRecentActivity({ transactions: [], cash_declarations: [] });
    setClaimHistory([]);
    setMySquad(null);
  };

  // ── Risk Engine Sync ──────────────────────────────────────────
  const handleSync = async () => {
    if (!token) return;
    setIsSyncing(true);
    try {
      const evalRes = await fetch(`${API}/evaluate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          current_income: 40000,
          income_history: incomeHistory && incomeHistory.length > 0 ? incomeHistory : [],
          premium: 0,
          deferred_period: 30,
          transaction_count: 15,
          sector_dip: 0.02,
          squad_no_claim_bonus: true,
          severe_weather_event: false
        })
      });

      if (evalRes.ok) {
        const d = await evalRes.json();
        setEvaluation(d.evaluation);
        setCalibration(d.calibration);
        if (d.income_history && d.income_history.length > 0) {
          setIncomeHistory(d.income_history);
        }
      } else if (evalRes.status === 401) {
        handleLogout();
        return;
      }

      const actRes = await fetch(`${API}/user/activity`, { headers: authHeaders() });
      if (actRes.ok) {
        const actData = await actRes.json();
        setRecentActivity(actData);
      }
    } catch (e) {
      console.error('Telemetry sync failed', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchClaimHistory = async () => {
    try {
      const res = await fetch(`${API}/claims/history`, { headers: authHeaders() });
      if (res.ok) setClaimHistory(await res.json());
    } catch {}
  };

  const fetchMySquad = async () => {
    try {
      const res = await fetch(`${API}/squads/me`, { headers: authHeaders() });
      if (res.ok) setMySquad(await res.json());
      else if (res.status === 404) setMySquad(null);
    } catch {}
  };

  const fetchTiers = async () => {
    try {
      const res = await fetch(`${API}/policy/tiers`);
      if (res.ok) {
        const d = await res.json();
        setTiers(d.tiers || []);
      }
    } catch {}
  };

  useEffect(() => {
    if (token) {
      handleSync();
      fetchClaimHistory();
      fetchMySquad();
      fetchTiers();
    }
  }, [token]);

  // ── Actions ───────────────────────────────────────────────────
  const fileClaim = async () => {
    setClaimLoading(true);
    setClaimMsg('');
    setClaimGateAlert(null);
    try {
      const res = await fetch(`${API}/claims/file`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ sector_dip: 0.02, severe_weather_event: false })
      });
      const d = await res.json();
      if (res.status === 422 && d.detail?.claim_blocked === 'IDLE_BUSINESS_GATE') {
        setClaimGateAlert(d.detail);
      } else {
        setClaimMsg(d.message || (typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail)) || 'Parametric claim processed.');
      }
      fetchClaimHistory();
      handleSync();
    } catch {
      setClaimMsg('Error connecting to settlement processor.');
    } finally {
      setClaimLoading(false);
    }
  };

  const handleSelectTier = async (tierKey) => {
    setTierLoading(true);
    setTierMsg('');
    try {
      const res = await fetch(`${API}/policy/select-tier`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ tier: tierKey })
      });
      const d = await res.json();
      if (res.ok) {
        setTierMsg(`Enrolled in ${tierKey} protection successfully.`);
        handleSync();
      } else {
        setTierMsg(d.detail || 'Could not update policy tier.');
      }
    } catch {
      setTierMsg('Network error selecting tier.');
    } finally {
      setTierLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setClaimMsg('');
    const formData = new FormData();
    formData.append('file', file);

    setIsSyncing(true);
    try {
      const res = await fetch(`${API}/upload/statement`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimMsg(data.detail || 'Upload failed.');
      } else {
        setClaimMsg('Financial statement verified.');
        if (data.inflows && data.inflows.length > 0) {
          const mapped = data.inflows.map((inf) => {
            const d = new Date(inf.date);
            return {
              month: d.toLocaleString('default', { month: 'short' }),
              amount: inf.amount,
              status: 'Paid',
              category: 'Revenue'
            };
          });
          setIncomeHistory(mapped.slice(-12));
          handleSync();
        }
      }
    } catch {
      setClaimMsg('Network error during file upload.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateSquad = async () => {
    if (!squadInputName.trim()) return;
    try {
      const res = await fetch(`${API}/squads/create`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ squad_name: squadInputName })
      });
      const data = await res.json();
      if (res.ok) {
        setSquadMsg(`Squad '${data.squad_name}' registered. Invite code: ${data.invite_code}`);
        setSquadInputName('');
        fetchMySquad();
      } else {
        setSquadMsg(data.detail || 'Failed to register squad.');
      }
    } catch {
      setSquadMsg('Network error creating squad.');
    }
  };

  const handleJoinSquad = async () => {
    if (!squadInputCode.trim()) return;
    try {
      const res = await fetch(`${API}/squads/join`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invite_code: squadInputCode.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setSquadMsg(`Joined '${data.squad_name}' successfully.`);
        setSquadInputCode('');
        fetchMySquad();
      } else {
        setSquadMsg(data.detail || 'Failed to join squad.');
      }
    } catch {
      setSquadMsg('Network error joining squad.');
    }
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
        setChatMessages((prev) => [...prev, { role: 'assistant', content: d.content }]);
      } else {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: "Our advisory assistant is currently unavailable. Please contact support@idcs.co.ke." }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: "Network error communicating with advisory assistant." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const openSettings = async () => {
    fetchMySquad();
    try {
      const res = await fetch(`${API}/auth/me`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setSettingsData({
          name: d.name || '',
          phone: d.phone || '',
          sector: d.sector || '',
          county: d.county || '',
          employment_type: d.employment_type || '',
          src_cap: d.src_cap ?? 50000,
          deferred_period: d.deferred_period ?? 30
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
        setSettingsSaved('Settings saved successfully.');
        setTimeout(() => setSettingsSaved(''), 3000);
      } else {
        setSettingsSaved('Failed to save settings.');
      }
    } catch {
      setSettingsSaved('Network error.');
    }
  };

  // ── Route View Renderer ───────────────────────────────────────
  const renderPage = () => {
    if (currentRoute === '/resources') {
      return <ResourcesPage onNavigate={handleNavigate} theme={theme} />;
    }
    if (currentRoute === '/insights') {
      return <InsightsPage onNavigate={handleNavigate} />;
    }
    if (currentRoute === '/contact') {
      return <ContactPage onNavigate={handleNavigate} />;
    }
    if (currentRoute === '/about') {
      return <AboutPage onNavigate={handleNavigate} />;
    }

    // Default: The renovated IDCS Protection Dashboard (for /, /dashboard, /portal)
    return (
      <ClientPortalPage
        currentUser={currentUser}
        incomeHistory={incomeHistory}
        evaluation={evaluation}
        recentActivity={recentActivity}
        claimHistory={claimHistory}
        calibration={calibration}
        tiers={tiers}
        authHeaders={authHeaders}
        authMode={authMode}
        setAuthMode={setAuthMode}
        phoneInput={phoneInput}
        setPhoneInput={setPhoneInput}
        pinInput={pinInput}
        setPinInput={setPinInput}
        authError={authError}
        setAuthError={setAuthError}
        authLoading={authLoading}
        handleAuth={handlePortalAuth}
        handleDemoLogin={handleDemoLogin}
        handleLogout={handleLogout}
        theme={theme}
        setCashModalOpen={setCashModalOpen}
        setTillModalOpen={setTillModalOpen}
        setUssdOpen={setUssdOpen}
        handleFileUpload={handleFileUpload}
        handleSelectTier={handleSelectTier}
        tierLoading={tierLoading}
        tierMsg={tierMsg}
        fileClaim={fileClaim}
        claimLoading={claimLoading}
        claimMsg={claimMsg}
        claimGateAlert={claimGateAlert}
        setClaimGateAlert={setClaimGateAlert}
        setSettingsOpen={setSettingsOpen}
        setSettingsTab={setSettingsTab}
        mySquad={mySquad}
        squadInputName={squadInputName}
        setSquadInputName={setSquadInputName}
        squadInputCode={squadInputCode}
        setSquadInputCode={setSquadInputCode}
        handleCreateSquad={handleCreateSquad}
        handleJoinSquad={handleJoinSquad}
        squadMsg={squadMsg}
        onNavigate={handleNavigate}
      />
    );
  };

  return (
    <div className="nexora-shell">
      {/* ── Global Sticky Navigation Header ─────────────────────── */}
      <Header
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenMobileMenu={() => setMobileDrawerOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenSettings={openSettings}
        onOpenUssd={() => setUssdOpen(true)}
      />

      {/* ── Responsive Mobile Navigation Drawer ─────────────────── */}
      <MobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        theme={theme}
        onToggleTheme={toggleTheme}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenSettings={openSettings}
        onOpenUssd={() => setUssdOpen(true)}
      />

      {/* ── Main IDCS Workspace / Tools ─────────────────────────── */}
      <main className="nexora-container" style={{ flex: 1 }}>
        {renderPage()}
      </main>

      {/* ── Institutional Footer ─────────────────────────────────── */}
      <Footer onNavigate={handleNavigate} />

      {/* ── Modals & Drawers ────────────────────────────────────── */}
      <HelpDrawer
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        chatMessages={chatMessages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        sendChat={sendChat}
        chatLoading={chatLoading}
      />

      <TillConnectionModal
        isOpen={tillModalOpen}
        onClose={() => setTillModalOpen(false)}
        authHeaders={authHeaders}
        currentUser={currentUser}
        onTillLinked={(num, type) => {
          setCurrentUser((prev) => ({ ...prev, till_number: num, till_type: type, till_verified: true }));
          handleSync();
        }}
      />

      <Suspense fallback={null}>
        <CashModal
          isOpen={cashModalOpen}
          onClose={() => setCashModalOpen(false)}
          authHeaders={authHeaders}
          onDeclared={handleSync}
        />
      </Suspense>

      <Suspense fallback={null}>
        <USSDSimulator
          isOpen={ussdOpen}
          onClose={() => setUssdOpen(false)}
          defaultPhone={currentUser?.phone || '+254712345678'}
        />
      </Suspense>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel
            settingsTab={settingsTab}
            setSettingsTab={setSettingsTab}
            settingsData={settingsData}
            setSettingsData={setSettingsData}
            settingsSaved={settingsSaved}
            saveSettings={saveSettings}
            squadMsg={squadMsg}
            setSquadMsg={setSquadMsg}
            mySquad={mySquad}
            squadInputName={squadInputName}
            setSquadInputName={setSquadInputName}
            squadInputCode={squadInputCode}
            setSquadInputCode={setSquadInputCode}
            handleCreateSquad={handleCreateSquad}
            handleJoinSquad={handleJoinSquad}
            authHeaders={authHeaders}
            onClose={() => setSettingsOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
