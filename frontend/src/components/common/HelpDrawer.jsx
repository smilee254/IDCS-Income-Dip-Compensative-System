import React, { useState, useRef, useEffect } from 'react';
import { X, MessageSquare, Send, RefreshCw, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function HelpDrawer({
  isOpen,
  onClose,
  chatMessages,
  chatInput,
  setChatInput,
  sendChat,
  chatLoading
}) {
  const [activeTab, setActiveTab] = useState('faq'); // 'faq' | 'ask'
  const [expandedFaq, setExpandedFaq] = useState(0);
  const chatEndRef = useRef(null);

  const faqs = [
    {
      q: "How does the Income Dip Shield work?",
      a: "IDCS monitors your baseline revenue from M-Pesa receipts and cash logs. If a seasonal drop, bad weather, or local market disruption causes your weekly income to fall below 80% of your typical baseline, the shield pays out compensation directly to your M-Pesa."
    },
    {
      q: "How are micro-premiums collected?",
      a: "No monthly lump sums are required. A micro-premium (typically 1.2% to 1.8%) is embedded seamlessly per business transaction, matching your daily earning flow."
    },
    {
      q: "What if most of my customers pay in cash?",
      a: "Use the 'Declare Cash Income' feature on your dashboard or via USSD (*384*432#). Regular weekly cash logs are factored directly into your protection baseline."
    },
    {
      q: "How does my Trust Squad help me?",
      a: "Your Trust Squad is a circle of 3 to 6 fellow business owners in your sector. Squad members vouch for each other during unusual dips and earn a +5% no-claim payout bonus."
    }
  ];

  useEffect(() => {
    if (activeTab === 'ask' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--warm-stone-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--warm-stone)',
              border: '1px solid var(--warm-stone-border)'
            }}>
              <HelpCircle size={18} />
            </div>
            <div>
              <div className="font-serif" style={{ fontWeight: 700, fontSize: 17, color: 'var(--primary-text)' }}>
                Help & Advisory
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                IDCS Parametric Protection Guide
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

        {/* Tab Switch */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 24px' }}>
          <button
            onClick={() => setActiveTab('faq')}
            style={{
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'faq' ? '2px solid var(--warm-stone)' : '2px solid transparent',
              color: activeTab === 'faq' ? 'var(--primary-text)' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            Common Questions
          </button>
          <button
            onClick={() => setActiveTab('ask')}
            style={{
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'ask' ? '2px solid var(--warm-stone)' : '2px solid transparent',
              color: activeTab === 'ask' ? 'var(--primary-text)' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            Ask Assistant
          </button>
        </div>

        <div className="drawer-body">
          {activeTab === 'faq' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {faqs.map((f, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    onClick={() => setExpandedFaq(expandedFaq === i ? -1 : i)}
                    style={{
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      color: 'var(--primary-text)'
                    }}
                  >
                    <span>{f.q}</span>
                    {expandedFaq === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  {expandedFaq === i && (
                    <div style={{ padding: '0 16px 14px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {f.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{
                flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
                gap: 10, paddingBottom: 16
              }}>
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '82%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: msg.role === 'user' ? 'var(--primary-navy)' : 'var(--bg-card-subtle)',
                        color: msg.role === 'user' ? '#FFFFFF' : 'var(--primary-text)',
                        border: '1px solid var(--border-color)',
                        fontSize: 13,
                        lineHeight: 1.5
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                      padding: '8px 12px', backgroundColor: 'var(--bg-card-subtle)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: 12,
                      display: 'flex', alignItems: 'center', gap: 6,
                      border: '1px solid var(--border-color)'
                    }}>
                      <RefreshCw size={12} className="spin" />
                      Auditing actuarial response...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                <input
                  className="form-control"
                  placeholder="Ask a question about your shield..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                  style={{ fontSize: 13 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={sendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{ padding: '0 14px' }}
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
