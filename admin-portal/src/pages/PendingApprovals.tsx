import { useEffect, useState } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';
import { PageHeader, Card, CardHeader, CardBody, Banner, EmptyState } from '../components/layout';
import { spacing } from '../styles/tokens';

interface ApprovalRequest {
  id: string;
  request_type: string;
  entity_type: string;
  entity_id: string;
  request_data: any;
  total_amount?: number;
  reason: string;
  status: string;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

export default function PendingApprovals() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/enterprise/approval-requests/pending');
      setApprovals(response.data || []);
    } catch (err: any) {
      const status = err?.response?.status;
      const isDemoSafe = status === 404 || status === 501 || status === 403;
      console.error('Pending approvals request failed:', status, err?.response?.data ?? err?.message);
      setApprovals([]);
      // Demo-safe: no red error for missing/forbidden endpoint; show calm empty state
      if (!isDemoSafe) {
        setError('Failed to load pending approvals.');
      } else {
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const typeLabels: Record<string, string> = {
    leave: 'Leave Request',
    expense: 'Expense Claim',
    bank_change: 'Bank Change',
    payroll: 'Payroll Correction',
    salary: 'Salary Change',
    termination: 'Termination',
  };
  const urgencyColors = { low: 'default', medium: 'warning', high: 'danger' } as const;

  if (loading) {
    return (
      <>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={{ color: styles.colors.textSecondary }}>Loading pending approvals...</p>
        </div>
        <style>{styles.spinKeyframes}</style>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Pending Approvals" subtitle="Review and process approval requests" />

      {error && <Banner variant="error">{error}</Banner>}

      {/* Stats */}
      <div style={{ ...styles.grid4, marginBottom: spacing.blockGap }}>
        {[
          { label: 'Pending', value: approvals.length, color: '#f59e0b' },
          { label: 'High Priority', value: approvals.filter(a => a.priority === 'high').length, color: styles.colors.danger },
          { label: 'Payroll', value: approvals.filter(a => a.request_type === 'payroll' || a.request_type === 'salary').length, color: styles.colors.info },
          { label: 'Financial', value: approvals.filter(a => a.total_amount).length, color: styles.colors.success },
        ].map((stat, i) => (
          <Card key={i} style={{ borderLeft: `4px solid ${stat.color}` }}>
            <CardBody>
              <p style={{ fontSize: '0.75rem', color: styles.colors.textMuted, marginBottom: '0.25rem' }}>{stat.label}</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 700, color: styles.colors.textPrimary }}>{stat.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Approvals List */}
      <Card>
        <CardHeader>All Pending Requests</CardHeader>
        <CardBody>
      {approvals.length === 0 ? (
        <EmptyState
          title="No pending approvals"
          message="There are no items to review. Approvals may not be enabled for this tenant."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.cardGap }}>
          {approvals.map((approval) => (
            <Card key={approval.id}>
              <CardBody>
              <div style={styles.flexBetween}>
                <div style={styles.flexStart}>
                  <div style={styles.iconContainer(approval.priority === 'high' ? styles.colors.danger : approval.priority === 'medium' ? '#f59e0b' : styles.colors.gradientAdmin)}>
                    <svg width="22" height="22" fill="none" stroke="white" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ ...styles.flexStart, marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, color: styles.colors.textPrimary }}>{typeLabels[approval.request_type] || approval.request_type}</span>
                      <span style={styles.badge(urgencyColors[approval.priority] || 'default')}>{approval.priority}</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: styles.colors.textSecondary, marginBottom: '0.25rem' }}>{approval.reason}</p>
                    <p style={{ fontSize: '0.75rem', color: styles.colors.textMuted }}>Submitted: {new Date(approval.created_at).toLocaleDateString()}</p>
                    {approval.total_amount && <p style={{ fontSize: '0.875rem', fontWeight: 600, color: styles.colors.textPrimary, marginTop: '0.25rem' }}>R {approval.total_amount.toLocaleString()}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button style={{ ...styles.buttonPrimary, background: styles.colors.success, padding: '0.5rem 1rem' }} type="button">Approve</button>
                  <button style={{ ...styles.buttonDanger, padding: '0.5rem 1rem' }} type="button">Reject</button>
                  <button style={{ ...styles.buttonSecondary, padding: '0.5rem 1rem' }} type="button">Details</button>
                </div>
              </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
        </CardBody>
      </Card>
    </>
  );
}
