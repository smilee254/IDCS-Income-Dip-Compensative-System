import React, { useState } from 'react';
import { Phone, X, RefreshCw, Send, PhoneCall, PhoneOff } from 'lucide-react';

export default function USSDSimulator({ isOpen, onClose, defaultPhone = "+254712345678" }) {
  const [phoneNumber, setPhoneNumber] = useState(defaultPhone);
  const [sessionSteps, setSessionSteps] = useState([]); // array of input strings e.g. ["1", "2"]
  const [screenText, setScreenText] = useState('Dial *384*432# to connect to IDCS USSD Gateway');
  const [currentInput, setCurrentInput] = useState('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

  if (!isOpen) return null;

  const startUSSD = async () => {
    setLoading(true);
    setSessionSteps([]);
    setIsEnded(false);
    try {
      const res = await fetch('/api/ussd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: `SIM-${Date.now()}`,
          serviceCode: '*384*432#',
          phoneNumber: phoneNumber,
          text: ''
        })
      });
      const data = await res.text();
      setScreenText(data);
      setIsSessionActive(true);
      if (data.startsWith('END')) {
        setIsEnded(true);
      }
    } catch {
      setScreenText('Connection failed. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const sendStep = async (stepValue) => {
    const val = (stepValue !== undefined ? stepValue : currentInput).trim();
    if (!val && !isSessionActive) return;

    const newSteps = [...sessionSteps, val];
    const fullText = newSteps.join('*');
    setSessionSteps(newSteps);
    setCurrentInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ussd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: `SIM-${Date.now()}`,
          serviceCode: '*384*432#',
          phoneNumber: phoneNumber,
          text: fullText
        })
      });
      const data = await res.text();
      setScreenText(data);
      if (data.startsWith('END')) {
        setIsEnded(true);
      }
    } catch {
      setScreenText('Session error. Please redial.');
      setIsEnded(true);
    } finally {
      setLoading(false);
    }
  };

  const handleKeypad = (char) => {
    if (!isSessionActive) {
      if (char === 'call') startUSSD();
      return;
    }
    if (char === 'call') {
      sendStep();
    } else if (char === 'clear') {
      setCurrentInput('');
    } else {
      setCurrentInput(prev => prev + char);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1001 }} />
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%, -50%)',
        width: 360, backgroundColor:'var(--bg-card)', border:'2px solid var(--border-color)', borderRadius: 24,
        padding: 20, zIndex: 1002, boxShadow: 'var(--shadow-subtle)',
        display:'flex', flexDirection:'column', alignItems:'center'
      }}>
        {/* Top Header */}
        <div style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Phone size={16} color="var(--warm-stone)" />
            <span className="font-serif" style={{ fontSize:12, fontWeight:700, color:'var(--primary-text)', letterSpacing:1 }}>GSM USSD SIMULATOR</span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9e9ea7', cursor:'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Phone Number Input */}
        <div style={{ width:'100%', marginBottom:10 }}>
          <label style={{ fontSize:10, color:'#9e9ea7', display:'block', marginBottom:4 }}>Trader MSISDN (Phone):</label>
          <input
            type="text"
            className="form-control"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            disabled={isSessionActive && !isEnded}
            style={{ fontSize:12, padding:'6px 10px', height:32 }}
          />
        </div>

        {/* Feature Phone LCD Screen */}
        <div style={{
          width:'100%', minHeight:150, maxHeight:200, overflowY:'auto',
          background:'#a4b79b', color:'#112211', fontFamily:'Courier New, monospace',
          padding: 12, borderRadius: 8, border: '3px solid #33442e',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)', fontSize:12, lineHeight:1.45,
          whiteSpace: 'pre-wrap', marginBottom: 12, wordBreak:'break-word'
        }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <RefreshCw size={14} className="spin" /> Sending USSD query...
            </div>
          ) : (
            screenText
          )}
        </div>

        {/* Current Input Display */}
        {isSessionActive && !isEnded && (
          <div style={{ width:'100%', display:'flex', gap:6, marginBottom:12 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Enter choice & press Send"
              value={currentInput}
              onChange={e => setCurrentInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendStep(); }}
              style={{ flex:1, fontSize:13, background:'var(--bg-card-muted)' }}
              autoFocus
            />
            <button
              className="btn btn-primary"
              onClick={() => sendStep()}
              disabled={loading || !currentInput.trim()}
              style={{ padding:'6px 14px', width:'auto' }}
            >
              <Send size={14} />
            </button>
          </div>
        )}

        {/* Keypad Buttons */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, width:'100%', marginBottom:10
        }}>
          {['1','2','3','4','5','6','7','8','9','*','0','#'].map(k => (
            <button
              key={k}
              onClick={() => handleKeypad(k)}
              style={{
                background:'#22222c', border:'1px solid #333342', color:'#f1f1f1',
                padding:'10px 0', borderRadius:8, fontSize:15, fontWeight:600,
                cursor:'pointer', transition:'all 0.1s'
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Call / Action Controls */}
        <div style={{ display:'flex', gap:8, width:'100%' }}>
          {!isSessionActive || isEnded ? (
            <button
              className="btn btn-primary"
              onClick={startUSSD}
              disabled={loading}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
            >
              <PhoneCall size={16} /> Dial *384*432#
            </button>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentInput('')}
                style={{ flex:1, fontSize:12 }}
              >
                Clear
              </button>
              <button
                className="btn btn-primary"
                onClick={() => { setIsSessionActive(false); setScreenText('Call Ended.'); setIsEnded(true); }}
                style={{ flex:1, backgroundColor:'var(--semantic-danger-bg)', borderColor:'var(--semantic-danger-border)', color:'var(--semantic-danger-text)', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}
              >
                <PhoneOff size={14} /> End Call
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
