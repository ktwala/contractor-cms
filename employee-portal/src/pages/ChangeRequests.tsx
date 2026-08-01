import React, { useState } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';

export default function ChangeRequests() {
  const [activeTab, setActiveTab] = useState<'contact' | 'bank'>('contact');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [bankName, setBankName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState('CHEQUE');
  const [accountHolderName, setAccountHolderName] = useState('');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/self-service/change-requests/contact', { email, phone, address_line1: address });
      setSubmitted(true);
    } catch (error) {
      alert('Failed to submit change request');
    } finally {
      setLoading(false);
    }
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/self-service/change-requests/bank-account', { bank_name: bankName, branch_code: branchCode, account_number: accountNumber, account_type: accountType, account_holder_name: accountHolderName });
      setSubmitted(true);
    } catch (error) {
      alert('Failed to submit change request');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={styles.pageContainer}>
        <div style={{ maxWidth: '500px', margin: '4rem auto' }}>
          <div style={{ ...styles.card, textAlign: 'center', padding: '3rem' }}>
            <div style={{ width: '64px', height: '64px', background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <svg width="32" height="32" fill="none" stroke="#10b981" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: styles.colors.textPrimary, marginBottom: '0.5rem' }}>Request Submitted!</h2>
            <p style={{ color: styles.colors.textSecondary, marginBottom: '1.5rem' }}>You'll be notified once it's reviewed by your manager.</p>
            <button onClick={() => setSubmitted(false)} style={styles.buttonPrimary}>Submit Another Request</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Change Requests</h1>
        <p style={styles.pageSubtitle}>Request updates to your personal information</p>
      </div>

      {/* Warning Banner */}
      <div style={{ padding: '1rem 1.25rem', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem' }}>
        <svg width="20" height="20" fill="none" stroke="#d97706" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '2px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <h4 style={{ fontWeight: 600, color: '#92400e', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Manager Approval Required</h4>
          <p style={{ fontSize: '0.8rem', color: '#92400e' }}>All changes require approval for security reasons.</p>
        </div>
      </div>

      <div style={{ maxWidth: '600px' }}>
        <div style={styles.card}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${styles.colors.border}`, marginBottom: '1.5rem' }}>
            {[
              { id: 'contact' as const, label: 'Contact Info', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
              { id: 'bank' as const, label: 'Bank Account', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem',
                  border: 'none', background: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem',
                  color: activeTab === tab.id ? styles.colors.primary : styles.colors.textSecondary,
                  borderBottom: activeTab === tab.id ? `2px solid ${styles.colors.primary}` : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Contact Form */}
          {activeTab === 'contact' && (
            <form onSubmit={handleContactSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.formLabel}>Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.formInput} placeholder="you@example.com" required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.formLabel}>Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={styles.formInput} placeholder="+27 12 345 6789" />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={styles.formLabel}>Address</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} style={{ ...styles.formInput, resize: 'vertical' }} placeholder="Street address" />
              </div>
              <button type="submit" disabled={loading} style={{ ...styles.buttonPrimary, width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          )}

          {/* Bank Form */}
          {activeTab === 'bank' && (
            <form onSubmit={handleBankSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.formLabel}>Bank Name</label>
                <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} style={styles.formInput} placeholder="e.g., Standard Bank" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={styles.formLabel}>Branch Code</label>
                  <input type="text" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} style={styles.formInput} placeholder="250655" required />
                </div>
                <div>
                  <label style={styles.formLabel}>Account Type</label>
                  <select value={accountType} onChange={(e) => setAccountType(e.target.value)} style={styles.formSelect}>
                    <option value="CHEQUE">Cheque</option>
                    <option value="SAVINGS">Savings</option>
                    <option value="CURRENT">Current</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.formLabel}>Account Number</label>
                <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} style={styles.formInput} placeholder="Full account number" required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.formLabel}>Account Holder Name</label>
                <input type="text" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} style={styles.formInput} placeholder="Name as per bank account" />
              </div>
              <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '10px', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#991b1b' }}>
                <strong>Important:</strong> Ensure all details are correct before submitting.
              </div>
              <button type="submit" disabled={loading} style={{ ...styles.buttonPrimary, width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
