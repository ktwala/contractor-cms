import React, { useState } from 'react';
import * as styles from '../styles/common';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'preferences' | 'security' | 'notifications'>('preferences');
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('en');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [payslipAlerts, setPayslipAlerts] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState(false);

  const handleSavePreferences = () => {
    setPrefsSuccess(true);
    setTimeout(() => setPrefsSuccess(false), 3000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    setPasswordSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSuccess(false), 3000);
  };

  const tabs = [
    { id: 'preferences' as const, label: 'Preferences', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'security' as const, label: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { id: 'notifications' as const, label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  ];

  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      style={{
        width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
        background: enabled ? styles.colors.primary : '#cbd5e1',
        position: 'relative', transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: '22px', height: '22px', borderRadius: '50%', background: 'white',
        position: 'absolute', top: '2px', left: enabled ? '24px' : '2px',
        transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }} />
    </button>
  );

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Settings</h1>
        <p style={styles.pageSubtitle}>Manage your account preferences</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: `1px solid ${styles.colors.border}`, marginBottom: '1.5rem' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem',
              border: 'none', background: 'none', cursor: 'pointer', fontWeight: 500,
              color: activeTab === tab.id ? styles.colors.primary : styles.colors.textSecondary,
              borderBottom: activeTab === tab.id ? `2px solid ${styles.colors.primary}` : '2px solid transparent',
              marginBottom: '-1px', fontSize: '0.875rem',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div style={{ maxWidth: '600px' }}>
          {prefsSuccess && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '12px', color: '#065f46', fontWeight: 500 }}>
              ✓ Preferences saved successfully!
            </div>
          )}

          <div style={styles.card}>
            <h2 style={{ ...styles.cardTitle, marginBottom: '1.5rem' }}>Display Preferences</h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={styles.formLabel}>Theme</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {['light', 'dark', 'system'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    style={{
                      flex: 1, padding: '1rem', borderRadius: '10px', border: `2px solid ${theme === t ? styles.colors.primary : styles.colors.border}`,
                      background: theme === t ? '#e0e7ff' : 'white', cursor: 'pointer', fontWeight: 500,
                      color: theme === t ? styles.colors.primary : styles.colors.textSecondary, textTransform: 'capitalize',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={styles.formLabel}>Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} style={styles.formSelect}>
                <option value="en">English</option>
                <option value="af">Afrikaans</option>
                <option value="zu">Zulu</option>
              </select>
            </div>

            <button onClick={handleSavePreferences} style={{ ...styles.buttonPrimary, width: '100%', justifyContent: 'center' }}>
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div style={{ maxWidth: '600px' }}>
          {passwordSuccess && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '12px', color: '#065f46', fontWeight: 500 }}>
              ✓ Password changed successfully!
            </div>
          )}

          <div style={styles.card}>
            <h2 style={{ ...styles.cardTitle, marginBottom: '1.5rem' }}>Change Password</h2>

            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.formLabel}>Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={styles.formInput}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.formLabel}>New Password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={styles.formInput}
                  required
                  minLength={8}
                />
                <p style={{ fontSize: '0.75rem', color: styles.colors.textMuted, marginTop: '0.25rem' }}>
                  Minimum 8 characters
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={styles.formLabel}>Confirm New Password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.formInput}
                  required
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={showPasswords} onChange={() => setShowPasswords(!showPasswords)} />
                <span style={{ fontSize: '0.875rem', color: styles.colors.textSecondary }}>Show passwords</span>
              </label>

              <button type="submit" style={{ ...styles.buttonPrimary, width: '100%', justifyContent: 'center' }}>
                Change Password
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div style={{ maxWidth: '600px' }}>
          <div style={styles.card}>
            <h2 style={{ ...styles.cardTitle, marginBottom: '1.5rem' }}>Notification Preferences</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ ...styles.flexBetween }}>
                <div>
                  <h3 style={{ fontWeight: 600, color: styles.colors.textPrimary, marginBottom: '0.25rem' }}>Email Notifications</h3>
                  <p style={{ fontSize: '0.875rem', color: styles.colors.textMuted }}>Receive updates via email</p>
                </div>
                <Toggle enabled={emailNotifications} onChange={() => setEmailNotifications(!emailNotifications)} />
              </div>

              <div style={{ ...styles.flexBetween }}>
                <div>
                  <h3 style={{ fontWeight: 600, color: styles.colors.textPrimary, marginBottom: '0.25rem' }}>Push Notifications</h3>
                  <p style={{ fontSize: '0.875rem', color: styles.colors.textMuted }}>Receive browser notifications</p>
                </div>
                <Toggle enabled={pushNotifications} onChange={() => setPushNotifications(!pushNotifications)} />
              </div>

              <div style={{ ...styles.flexBetween }}>
                <div>
                  <h3 style={{ fontWeight: 600, color: styles.colors.textPrimary, marginBottom: '0.25rem' }}>Payslip Alerts</h3>
                  <p style={{ fontSize: '0.875rem', color: styles.colors.textMuted }}>Get notified when new payslips are available</p>
                </div>
                <Toggle enabled={payslipAlerts} onChange={() => setPayslipAlerts(!payslipAlerts)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
