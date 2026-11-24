import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, Shield, ArrowRight } from 'lucide-react';

export default function ContactPage({ onNavigate }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    organization: '',
    areaOfInterest: 'actuarial-science',
    enquiry: '',
    consent: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full name is required';
    if (!formData.email.trim() || !formData.email.includes('@')) errs.email = 'Valid email is required';
    if (!formData.enquiry.trim()) errs.enquiry = 'Please provide details on your enquiry';
    if (!formData.consent) errs.consent = 'Consent is required to process your enquiry';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    // Simulate server-side processing
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 600);
  };

  return (
    <div className="contact-page" style={{ padding: '40px 0 80px' }}>
      <section style={{ maxWidth: 840, marginBottom: 54 }}>
        <div className="hero-overline">CONSULTATIONS &amp; ENQUIRIES</div>
        <h1 style={{ 
          fontFamily: 'var(--font-serif)', 
          fontSize: 48, 
          fontWeight: 700, 
          color: 'var(--primary-text)', 
          lineHeight: 1.15,
          marginBottom: 16 
        }}>
          Let's start a conversation.
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Tell us about the quantitative challenge, risk structure, or financial advisory engagement you are evaluating.
        </p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr', gap: 48, alignItems: 'flex-start' }}>
        {/* Form Column */}
        <div className="card" style={{ padding: '36px' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                backgroundColor: 'var(--semantic-success-bg)',
                border: '1px solid var(--semantic-success-border)',
                color: 'var(--semantic-success-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <CheckCircle2 size={24} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 8 }}>
                Enquiry Successfully Received
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, maxWidth: 440, margin: '0 auto 24px' }}>
                Thank you for contacting IDCS. A member of our actuarial support team will review your specifications and follow up within one business day.
              </p>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSubmitted(false);
                  setFormData({
                    fullName: '',
                    email: '',
                    organization: '',
                    areaOfInterest: 'actuarial-science',
                    enquiry: '',
                    consent: true
                  });
                }}
              >
                Submit another enquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--primary-text)', marginBottom: 6 }}>
                    Full Name *
                  </label>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="e.g. Dr. Jane Kamau"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                  {errors.fullName && <div style={{ color: 'var(--semantic-danger-text)', fontSize: 11, marginTop: 4 }}>{errors.fullName}</div>}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--primary-text)', marginBottom: 6 }}>
                    Email Address *
                  </label>
                  <input 
                    type="email"
                    className="form-control"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  {errors.email && <div style={{ color: 'var(--semantic-danger-text)', fontSize: 11, marginTop: 4 }}>{errors.email}</div>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--primary-text)', marginBottom: 6 }}>
                    Organization / Firm
                  </label>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="Enterprise or institution name"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--primary-text)', marginBottom: 6 }}>
                    Practice Area of Interest *
                  </label>
                  <select 
                    className="form-control"
                    value={formData.areaOfInterest}
                    onChange={(e) => setFormData({ ...formData, areaOfInterest: e.target.value })}
                    style={{ backgroundColor: 'var(--bg-card-subtle)' }}
                  >
                    <option value="actuarial-science">Actuarial Science &amp; Valuation</option>
                    <option value="risk-and-insurance">Risk &amp; Insurance / Parametric Design</option>
                    <option value="financial-advisory">Financial Advisory &amp; Liquidity</option>
                    <option value="general-consultation">General Institutional Inquiry</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--primary-text)', marginBottom: 6 }}>
                  How can our team assist you? *
                </label>
                <textarea 
                  className="form-control"
                  rows={5}
                  placeholder="Describe the context of your inquiry, portfolio scope, or modeling requirements..."
                  value={formData.enquiry}
                  onChange={(e) => setFormData({ ...formData, enquiry: e.target.value })}
                />
                {errors.enquiry && <div style={{ color: 'var(--semantic-danger-text)', fontSize: 11, marginTop: 4 }}>{errors.enquiry}</div>}
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <input 
                  type="checkbox"
                  id="privacy-consent"
                  checked={formData.consent}
                  onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                  style={{ marginTop: 3, accentColor: 'var(--warm-stone)' }}
                />
                <label htmlFor="privacy-consent" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  I consent to IDCS collecting and processing my details in accordance with applicable data privacy regulations to respond to this consultation enquiry.
                </label>
              </div>
              {errors.consent && <div style={{ color: 'var(--semantic-danger-text)', fontSize: 11 }}>{errors.consent}</div>}

              <button 
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                {submitting ? 'Transmitting Enquiry...' : 'Submit Consultation Request'}
                {!submitting && <Send size={15} />}
              </button>
            </form>
          )}
        </div>

        {/* Sidebar Info Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ padding: '28px' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 16 }}>
              Direct Advisory Contacts
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ color: 'var(--warm-stone)', marginTop: 2 }}>
                  <Mail size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Support &amp; Advisory Desk</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary-text)' }}>support@idcs.co.ke</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ color: 'var(--warm-stone)', marginTop: 2 }}>
                  <Phone size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Telephone Consultations</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary-text)' }}>+254 (0) 20 790 4000</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ color: 'var(--warm-stone)', marginTop: 2 }}>
                  <MapPin size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Regional Head Office</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary-text)' }}>
                    Westlands Financial Centre, Tower B, Level 14<br />
                    Nairobi, Kenya
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ 
            padding: '24px', 
            backgroundColor: 'var(--bg-card-subtle)', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-color)' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warm-stone)', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
              <Shield size={16} />
              <span>Strict Client Confidentiality</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              All discussions, portfolio evaluations, and proprietary financial ledgers submitted for scoping are governed by mutual non-disclosure agreements prior to formal engagement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
