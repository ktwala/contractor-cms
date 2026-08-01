import React, { useState } from 'react';
import * as styles from '../styles/common';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export default function HelpSupport() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'faq' | 'contact' | 'tickets'>('faq');

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const faqs: FAQ[] = [
    { id: '1', question: 'How do I download my payslip?', answer: 'Navigate to the Payslips page and click the Download button next to your desired payslip.', category: 'Payslips' },
    { id: '2', question: 'When will my salary be paid?', answer: 'Salaries are typically paid on the 25th. Check the Pay Calendar for exact dates.', category: 'Payments' },
    { id: '3', question: 'How do I update my bank account?', answer: 'Go to Change Requests → Bank Account tab. Submit your new details for HR approval.', category: 'Account' },
    { id: '4', question: 'Where can I find my IRP5 tax certificate?', answer: 'Tax certificates are available on the Tax Certificates page, usually in March for the previous year.', category: 'Tax' },
    { id: '5', question: 'How do I reset my password?', answer: 'Go to Settings → Security tab and use the Change Password form.', category: 'Account' },
  ];

  const tickets = [
    { id: 'T-2025-001', subject: 'Query about payslip', status: 'resolved', created_at: '2025-12-15' },
    { id: 'T-2025-002', subject: 'Bank account update', status: 'in_progress', created_at: '2025-12-20' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setSubject(''); setMessage(''); setCategory('general');
    setTimeout(() => setSubmitted(false), 5000);
  };

  const filteredFAQs = faqs.filter(f =>
    f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Help & Support</h1>
        <p style={styles.pageSubtitle}>Get help with your payroll portal</p>
      </div>

      {/* Contact Cards */}
      <div style={styles.grid3}>
        {[
          { icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', title: 'Call Us', info: '+27 11 123 4500', sub: 'Mon - Fri, 8:00 - 17:00', color: styles.colors.gradientInfo },
          { icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', title: 'Email Us', info: 'payroll@company.com', sub: 'Response within 24 hours', color: styles.colors.gradientPrimary },
          { icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', title: 'Submit Ticket', info: 'Track your request', sub: 'Click to create', color: styles.colors.gradientSuccess },
        ].map((item, i) => (
          <div key={i} style={styles.card}>
            <div style={{ ...styles.flexStart, marginBottom: '1rem' }}>
              <div style={styles.iconContainer(item.color)}>
                <svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
              </div>
              <h3 style={{ fontWeight: 600, color: styles.colors.textPrimary }}>{item.title}</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: styles.colors.textMuted, marginBottom: '0.25rem' }}>{item.sub}</p>
            <p style={{ fontWeight: 600, color: styles.colors.primary }}>{item.info}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={styles.tabContainer}>
        {(['faq', 'contact', 'tickets'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={styles.tab(activeTab === tab)}>
            {tab === 'faq' ? 'FAQs' : tab === 'contact' ? 'Contact Support' : `My Tickets (${tickets.filter(t => t.status !== 'resolved').length})`}
          </button>
        ))}
      </div>

      {/* FAQ Tab */}
      {activeTab === 'faq' && (
        <div>
          <div style={{ ...styles.card, marginBottom: '1rem', padding: '0.75rem' }}>
            <div style={{ position: 'relative' }}>
              <svg width="20" height="20" fill="none" stroke={styles.colors.textMuted} viewBox="0 0 24 24" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...styles.formInput, paddingLeft: '2.75rem' }}
              />
            </div>
          </div>

          <div style={{ ...styles.card, padding: 0 }}>
            {filteredFAQs.length === 0 ? (
              <div style={styles.emptyState}>
                <h3 style={styles.emptyStateTitle}>No FAQs found</h3>
                <p style={styles.emptyStateText}>Try adjusting your search</p>
              </div>
            ) : (
              filteredFAQs.map((faq, i) => (
                <div key={faq.id} style={{ padding: '1.25rem', borderBottom: i < filteredFAQs.length - 1 ? `1px solid ${styles.colors.borderLight}` : 'none' }}>
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                    style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div>
                      <span style={styles.badge('info')}>{faq.category}</span>
                      <h3 style={{ fontWeight: 600, color: styles.colors.textPrimary, marginTop: '0.5rem' }}>{faq.question}</h3>
                    </div>
                    <svg width="20" height="20" fill="none" stroke={styles.colors.textMuted} viewBox="0 0 24 24" style={{ transform: expandedFAQ === faq.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedFAQ === faq.id && (
                    <p style={{ marginTop: '1rem', paddingLeft: '1rem', borderLeft: `2px solid ${styles.colors.primary}`, color: styles.colors.textSecondary, fontSize: '0.9rem' }}>
                      {faq.answer}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Contact Tab */}
      {activeTab === 'contact' && (
        <div style={{ maxWidth: '600px' }}>
          {submitted && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '12px', color: '#065f46', fontWeight: 500 }}>
              ✓ Ticket submitted! We'll respond within 24-48 hours.
            </div>
          )}
          <div style={styles.card}>
            <h2 style={{ ...styles.cardTitle, marginBottom: '1.5rem' }}>Submit a Ticket</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.formLabel}>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.formSelect} required>
                  <option value="general">General Inquiry</option>
                  <option value="payslip">Payslip Issue</option>
                  <option value="tax">Tax Certificate</option>
                  <option value="bank">Bank Account</option>
                  <option value="technical">Technical Issue</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.formLabel}>Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} style={styles.formInput} placeholder="Brief description" required />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={styles.formLabel}>Message</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} style={{ ...styles.formInput, resize: 'vertical' }} placeholder="Provide details..." required />
              </div>
              <button type="submit" style={{ ...styles.buttonPrimary, width: '100%', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Submit Ticket
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <div style={{ ...styles.card, padding: 0 }}>
          {tickets.length === 0 ? (
            <div style={styles.emptyState}>
              <h3 style={styles.emptyStateTitle}>No tickets yet</h3>
              <button onClick={() => setActiveTab('contact')} style={styles.buttonPrimary}>Create Your First Ticket</button>
            </div>
          ) : (
            tickets.map((ticket, i) => (
              <div key={ticket.id} style={{ padding: '1.25rem', borderBottom: i < tickets.length - 1 ? `1px solid ${styles.colors.borderLight}` : 'none', ...styles.flexBetween }}>
                <div>
                  <div style={{ ...styles.flexStart, marginBottom: '0.5rem' }}>
                    <span style={{ fontFamily: 'monospace', color: styles.colors.textMuted, fontSize: '0.8rem' }}>{ticket.id}</span>
                    <span style={styles.badge(ticket.status === 'resolved' ? 'success' : 'warning')}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 style={{ fontWeight: 600, color: styles.colors.textPrimary }}>{ticket.subject}</h3>
                  <p style={{ fontSize: '0.8rem', color: styles.colors.textMuted, marginTop: '0.25rem' }}>Created: {ticket.created_at}</p>
                </div>
                <button style={{ color: styles.colors.primary, background: 'none', border: 'none', fontWeight: 500, cursor: 'pointer' }}>View →</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
