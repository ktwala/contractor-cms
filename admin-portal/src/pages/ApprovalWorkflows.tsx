import { useState } from 'react';
import * as styles from '../styles/common';

interface Workflow {
  id: string;
  name: string;
  type: 'leave' | 'expense' | 'payroll' | 'bank_change';
  steps: number;
  status: 'active' | 'draft';
  lastModified: string;
}

export default function ApprovalWorkflows() {
  const [workflows] = useState<Workflow[]>([
    { id: '1', name: 'Annual Leave Request', type: 'leave', steps: 2, status: 'active', lastModified: '2025-12-15' },
    { id: '2', name: 'Expense Claim Standard', type: 'expense', steps: 3, status: 'active', lastModified: '2025-12-10' },
    { id: '3', name: 'Payroll Correction', type: 'payroll', steps: 4, status: 'active', lastModified: '2025-11-20' },
    { id: '4', name: 'Bank Account Change', type: 'bank_change', steps: 3, status: 'active', lastModified: '2025-10-05' },
    { id: '5', name: 'Emergency Leave', type: 'leave', steps: 1, status: 'draft', lastModified: '2025-12-20' },
  ]);

  const typeLabels = { leave: 'Leave', expense: 'Expense', payroll: 'Payroll', bank_change: 'Bank Change' };
  const typeColors = { leave: 'info', expense: 'warning', payroll: 'success', bank_change: 'danger' } as const;

  return (
    <div style={styles.pageContainer}>
      <div style={{ ...styles.flexBetween, ...styles.pageHeader }}>
        <div>
          <h1 style={styles.pageTitle}>Approval Workflows</h1>
          <p style={styles.pageSubtitle}>Configure multi-step approval processes</p>
        </div>
        <button style={styles.buttonPrimary} disabled>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Workflow
        </button>
      </div>

      <div
        style={{
          background: styles.colors.info + '20',
          border: `1px solid ${styles.colors.info}`,
          color: styles.colors.textPrimary,
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
        }}
      >
        Workflow list is preview data; backend wiring in progress. Create and edit workflows coming soon.
      </div>

      {/* Stats */}
      <div style={styles.grid4}>
        {[
          { label: 'Total Workflows', value: workflows.length, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
          { label: 'Active', value: workflows.filter(w => w.status === 'active').length, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Draft', value: workflows.filter(w => w.status === 'draft').length, icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
          { label: 'Avg. Steps', value: (workflows.reduce((sum, w) => sum + w.steps, 0) / workflows.length).toFixed(1), icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
        ].map((stat, i) => (
          <div key={i} style={styles.card}>
            <div style={styles.flexStart}>
              <div style={styles.iconContainer(i === 0 ? styles.colors.gradientAdmin : i === 1 ? styles.colors.success : i === 2 ? '#f59e0b' : '#3b82f6')}>
                <svg width="22" height="22" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: styles.colors.textMuted }}>{stat.label}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: styles.colors.textPrimary }}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Workflows Table */}
      <h2 style={styles.sectionTitle}>All Workflows</h2>
      <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
        <table style={styles.table}>
          <thead><tr style={styles.tableHeader}>
            <th style={styles.tableHeaderCell}>Workflow Name</th>
            <th style={styles.tableHeaderCell}>Type</th>
            <th style={styles.tableHeaderCell}>Steps</th>
            <th style={styles.tableHeaderCell}>Status</th>
            <th style={styles.tableHeaderCell}>Last Modified</th>
            <th style={styles.tableHeaderCell}>Actions</th>
          </tr></thead>
          <tbody>
            {workflows.map((wf, idx) => (
              <tr key={wf.id} style={{ ...styles.tableRow, borderBottom: idx === workflows.length - 1 ? 'none' : undefined }}>
                <td style={{ ...styles.tableCell, fontWeight: 600 }}>{wf.name}</td>
                <td style={styles.tableCell}><span style={styles.badge(typeColors[wf.type])}>{typeLabels[wf.type]}</span></td>
                <td style={styles.tableCell}>{wf.steps} steps</td>
                <td style={styles.tableCell}><span style={styles.badge(wf.status === 'active' ? 'success' : 'default')}>{wf.status}</span></td>
                <td style={{ ...styles.tableCell, color: styles.colors.textMuted }}>{wf.lastModified}</td>
                <td style={styles.tableCell}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{ ...styles.buttonSecondary, padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>Edit</button>
                    <button style={{ ...styles.buttonSecondary, padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>View</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
