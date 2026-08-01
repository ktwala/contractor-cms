import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import type { EmployeeProfile } from '../types';
import * as styles from '../styles/common';

export default function Profile() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get('/self-service/profile');
      setProfile(response.data);
    } catch (error) {
      console.error('Failed to load profile:', error);
      // Demo data
      setProfile({
        id: '1',
        employee_number: 'EMP001',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@company.com',
        phone: '+27 82 123 4567',
        job_title: 'Senior Software Engineer',
        department: 'Engineering',
        hire_date: '2022-03-15',
        employment_status: 'Active',
        pay_frequency: 'Monthly',
        currency: 'ZAR',
        bank_accounts: [
          { id: '1', bank_name: 'FNB', account_number_masked: '****1234', account_type: 'Cheque', is_primary: true }
        ],
        leave_balances: [
          { leave_type: 'Annual', entitled: 21, taken: 6, pending: 0, available: 15, unit: 'days' },
          { leave_type: 'Sick', entitled: 10, taken: 2, pending: 0, available: 8, unit: 'days' },
          { leave_type: 'Family', entitled: 3, taken: 0, pending: 0, available: 3, unit: 'days' },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={{ color: styles.colors.textSecondary }}>Loading profile...</p>
        </div>
        <style>{styles.spinKeyframes}</style>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={styles.pageContainer}>
        <div style={{ ...styles.card, ...styles.emptyState }}>
          <p style={styles.emptyStateText}>Failed to load profile</p>
        </div>
      </div>
    );
  }

  const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div style={{ ...styles.card, marginBottom: '1.5rem' }}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>
          <div style={styles.iconContainerSmall('#f1f5f9')}>{icon}</div>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <label style={styles.formLabel}>{label}</label>
      <p style={{ color: styles.colors.textPrimary, fontWeight: 500 }}>{value || 'Not provided'}</p>
    </div>
  );

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>My Profile</h1>
        <p style={styles.pageSubtitle}>Your personal and employment information</p>
      </div>

      {/* Personal Information */}
      <Section
        icon={<svg width="18" height="18" fill="none" stroke="#64748b" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
        title="Personal Information"
      >
        <div style={styles.grid2}>
          <Field label="Full Name" value={`${profile.first_name} ${profile.last_name}`} />
          <Field label="Employee Number" value={profile.employee_number} />
          <Field
            label="Email"
            value={
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="16" height="16" fill="none" stroke="#64748b" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {profile.email}
              </span>
            }
          />
          <Field
            label="Phone"
            value={
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="16" height="16" fill="none" stroke="#64748b" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                {profile.phone}
              </span>
            }
          />
        </div>
      </Section>

      {/* Employment Details */}
      <Section
        icon={<svg width="18" height="18" fill="none" stroke="#64748b" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
        title="Employment Details"
      >
        <div style={styles.grid2}>
          <Field label="Job Title" value={profile.job_title} />
          <Field label="Department" value={profile.department} />
          <Field
            label="Hire Date"
            value={
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="16" height="16" fill="none" stroke="#64748b" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {format(new Date(profile.hire_date), 'dd MMM yyyy')}
              </span>
            }
          />
          <Field
            label="Employment Status"
            value={<span style={styles.badge('success')}>{profile.employment_status}</span>}
          />
          <Field label="Pay Frequency" value={profile.pay_frequency} />
          <Field label="Currency" value={profile.currency} />
        </div>
      </Section>

      {/* Bank Accounts */}
      <Section
        icon={<svg width="18" height="18" fill="none" stroke="#64748b" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
        title="Bank Accounts"
      >
        {profile.bank_accounts.length === 0 ? (
          <p style={{ color: styles.colors.textSecondary }}>No bank accounts on file</p>
        ) : (
          <div style={styles.grid2}>
            {profile.bank_accounts.map((account) => (
              <div key={account.id} style={{
                padding: '1rem',
                background: styles.colors.background,
                borderRadius: '12px',
                border: `1px solid ${styles.colors.border}`
              }}>
                <div style={{ ...styles.flexBetween, marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 600, color: styles.colors.textPrimary }}>{account.bank_name}</span>
                  {account.is_primary && <span style={styles.badge('info')}>Primary</span>}
                </div>
                <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ color: styles.colors.textMuted }}>Account: </span>
                    <span style={{ fontFamily: 'monospace', color: styles.colors.textPrimary }}>{account.account_number_masked}</span>
                  </div>
                  <div>
                    <span style={{ color: styles.colors.textMuted }}>Type: </span>
                    <span style={{ color: styles.colors.textPrimary }}>{account.account_type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Leave Balances */}
      <Section
        icon={<svg width="18" height="18" fill="none" stroke="#64748b" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        title="Leave Balances"
      >
        <div style={styles.grid3}>
          {profile.leave_balances.map((leave) => (
            <div key={leave.leave_type} style={{
              padding: '1.25rem',
              background: styles.colors.background,
              borderRadius: '12px',
              border: `1px solid ${styles.colors.border}`
            }}>
              <h3 style={{ fontWeight: 600, color: styles.colors.textPrimary, marginBottom: '1rem' }}>{leave.leave_type}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div style={styles.flexBetween}>
                  <span style={{ color: styles.colors.textMuted }}>Entitled:</span>
                  <span style={{ fontWeight: 500 }}>{leave.entitled} {leave.unit}</span>
                </div>
                <div style={styles.flexBetween}>
                  <span style={{ color: styles.colors.textMuted }}>Taken:</span>
                  <span style={{ fontWeight: 500 }}>{leave.taken} {leave.unit}</span>
                </div>
                <div style={styles.flexBetween}>
                  <span style={{ color: styles.colors.textMuted }}>Pending:</span>
                  <span style={{ fontWeight: 500 }}>{leave.pending} {leave.unit}</span>
                </div>
                <div style={{
                  ...styles.flexBetween,
                  borderTop: `1px solid ${styles.colors.border}`,
                  paddingTop: '0.75rem',
                  marginTop: '0.5rem'
                }}>
                  <span style={{ fontWeight: 600, color: styles.colors.textPrimary }}>Available:</span>
                  <span style={{ fontWeight: 700, color: styles.colors.success, fontSize: '1.125rem' }}>
                    {leave.available} {leave.unit}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <style>{styles.spinKeyframes}</style>
    </div>
  );
}
