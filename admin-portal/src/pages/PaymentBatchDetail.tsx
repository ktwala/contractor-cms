import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner, Grid } from '../ui/layout';
import { useAccess } from '../hooks/useAccess';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#f1f5f9', text: '#475569' },
  READY: { bg: '#eff6ff', text: '#2563eb' },
  GENERATED: { bg: '#dbeafe', text: '#1d4ed8' },
  SUBMITTED: { bg: '#fffbeb', text: '#d97706' },
  PROCESSED: { bg: '#f0fdf4', text: '#16a34a' },
  CONFIRMED_PAID: { bg: '#dcfce7', text: '#059669' },
  FAILED: { bg: '#fef2f2', text: '#dc2626' },
  CANCELLED: { bg: '#fef2f2', text: '#dc2626' },
};

const EXPORT_COLORS: Record<string, { bg: string; text: string }> = {
  NOT_GENERATED: { bg: '#f1f5f9', text: '#94a3b8' },
  GENERATED: { bg: '#f0fdf4', text: '#16a34a' },
  FAILED: { bg: '#fef2f2', text: '#dc2626' },
};

function Chip({ label, colors }: { label: string; colors?: { bg: string; text: string } }) {
  const c = colors ?? { bg: '#f1f5f9', text: '#475569' };
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: c.bg, color: c.text }}>{label}</span>;
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PaymentBatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAccess();

  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ note: string } | null>(null);

  const loadBatch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/payments/batches/${id}`);
      setBatch(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load payment batch. Please try again.');
      setBatch(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadBatch(); }, [loadBatch]);

  const handleExport = async () => {
    setActionLoading('export');
    setActionMsg(null);
    try {
      await api.post(`/payments/batches/${id}/export`);
      setActionMsg({ type: 'success', text: 'Payment batch exported successfully.' });
      await loadBatch();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Export failed';
      setActionMsg({ type: 'error', text: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmPaid = async () => {
    if (!confirmModal) return;
    setActionLoading('confirm');
    setActionMsg(null);
    try {
      await api.post(`/payments/batches/${id}/confirm-paid`, { confirmationNote: confirmModal.note || undefined });
      setActionMsg({ type: 'success', text: 'Payment batch confirmed as paid.' });
      setConfirmModal(null);
      await loadBatch();
    } catch (err: any) {
      const blockers = err?.response?.data?.blockers;
      const msg = blockers
        ? `Cannot confirm: ${blockers.map((b: any) => b.type).join(', ')}`
        : err?.response?.data?.message || 'Confirm paid failed';
      setActionMsg({ type: 'error', text: msg });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Page title="Payment Batch">
        <div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div>
        <style>{styles.spinKeyframes}</style>
      </Page>
    );
  }

  if (error || !batch) {
    return (
      <Page title="Payment Batch">
        <Banner variant="error">{error || 'Payment batch not found.'}</Banner>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button style={styles.buttonPrimary} onClick={loadBatch}>Retry</button>
          <button style={styles.buttonSecondary} onClick={() => navigate('/payroll/payment-batches')}>Back to Batches</button>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title={batch.batchCode}
      subtitle="Payment batch details, lines, and confirmation status"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.buttonSecondary} onClick={() => navigate('/payroll/payment-batches')}>← Back</button>
          {batch.payrun?.id && <Link to={`/payroll/payruns/${batch.payrun.id}`} style={{ ...styles.buttonSecondary, textDecoration: 'none' }}>Open Payrun</Link>}
          {can('payment_batch:export') && ['READY', 'PENDING'].includes(batch.status) && (
            <button style={styles.buttonSecondary} onClick={handleExport} disabled={actionLoading === 'export'}>
              {actionLoading === 'export' ? 'Exporting...' : 'Export Batch'}
            </button>
          )}
          {can('payment_batch:confirm_paid') && ['GENERATED', 'SUBMITTED', 'READY'].includes(batch.status) && (
            <button style={styles.buttonPrimary} onClick={() => setConfirmModal({ note: '' })} disabled={actionLoading === 'confirm'}>
              {actionLoading === 'confirm' ? 'Confirming...' : 'Confirm Paid'}
            </button>
          )}
        </div>
      }
    >
      {actionMsg && <Banner variant={actionMsg.type === 'success' ? 'success' : 'error'}>{actionMsg.text}</Banner>}

      {/* Summary */}
      <Grid cols="1fr 1fr 1fr 1fr" gap={12}>
        <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Status</div><div style={{ marginTop: 4 }}><Chip label={batch.status} colors={STATUS_COLORS[batch.status]} /></div></Card>
        <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Net Amount</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{fmt(batch.netAmount)}</div></Card>
        <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Employees</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{batch.employeeCount}</div></Card>
        <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Export Status</div><div style={{ marginTop: 4 }}><Chip label={batch.exportStatus} colors={EXPORT_COLORS[batch.exportStatus]} /></div></Card>
      </Grid>

      {/* Batch Info */}
      <Card>
        <CardHeader title="Batch Information" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, padding: '0 0 8px 0' }}>
          <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Batch Code</div><div style={{ fontWeight: 500, fontSize: 13, marginTop: 2 }}>{batch.batchCode}</div></div>
          <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Country</div><div style={{ fontWeight: 500, fontSize: 13, marginTop: 2 }}>{batch.countryCode ?? '—'}</div></div>
          <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Currency</div><div style={{ fontWeight: 500, fontSize: 13, marginTop: 2 }}>{batch.currencyCode}</div></div>
          <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Legal Entity</div><div style={{ fontWeight: 500, fontSize: 13, marginTop: 2 }}>{batch.legalEntityName ?? '—'}</div></div>
          <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Pay Group</div><div style={{ fontWeight: 500, fontSize: 13, marginTop: 2 }}>{batch.payGroupName ?? '—'}</div></div>
          <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Linked Payrun</div><div style={{ fontWeight: 500, fontSize: 13, marginTop: 2 }}>{batch.payrun ? <Link to={`/payroll/payruns/${batch.payrun.id}`} style={{ color: styles.colors.primary, textDecoration: 'none' }}>{batch.payrun.name} ({batch.payrun.status})</Link> : '—'}</div></div>
          {batch.exportGeneratedAt && <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Exported At</div><div style={{ fontSize: 13, marginTop: 2 }}>{fmtDate(batch.exportGeneratedAt)}</div></div>}
          {batch.confirmedPaidAt && <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Confirmed Paid At</div><div style={{ fontSize: 13, marginTop: 2 }}>{fmtDate(batch.confirmedPaidAt)}</div></div>}
          {batch.confirmationNote && <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Confirmation Note</div><div style={{ fontSize: 13, marginTop: 2 }}>{batch.confirmationNote}</div></div>}
        </div>
      </Card>

      {/* Payment Lines */}
      <Card>
        <CardHeader title={`Payment Lines (${batch.lines?.length ?? 0})`} />
        {(!batch.lines || batch.lines.length === 0) ? (
          <div style={{ padding: 24, textAlign: 'center', color: styles.colors.textMuted }}>No payment lines found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Employee</th>
                <th style={styles.tableHeaderCell}>Bank</th>
                <th style={styles.tableHeaderCell}>Account</th>
                <th style={{ ...styles.tableHeaderCell, textAlign: 'right' as const }}>Amount</th>
                <th style={styles.tableHeaderCell}>Status</th>
              </tr></thead>
              <tbody>
                {batch.lines.map((line: any) => (
                  <tr key={line.id} style={styles.tableRow}>
                    <td style={styles.tableCell}><span style={{ fontWeight: 500, fontSize: 12 }}>{line.employeeName ?? line.employeeId}</span></td>
                    <td style={styles.tableCell}><span style={{ fontSize: 12 }}>{line.bankName ?? '—'}</span></td>
                    <td style={styles.tableCell}><span style={{ fontSize: 12, fontFamily: 'monospace' }}>{line.accountNumberMasked ?? '—'}</span></td>
                    <td style={{ ...styles.tableCell, textAlign: 'right' as const, fontWeight: 600 }}>{fmt(line.amount)}</td>
                    <td style={styles.tableCell}><Chip label={line.status} colors={STATUS_COLORS[line.status] ?? { bg: '#f1f5f9', text: '#475569' }} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan={3} style={{ ...styles.tableCell, textAlign: 'right' as const, fontWeight: 600 }}>Total:</td>
                  <td style={{ ...styles.tableCell, textAlign: 'right' as const, fontWeight: 700 }}>{fmt(batch.netAmount)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Confirm Payment</h3>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: styles.colors.textMuted }}>Confirmation Note (optional)</label>
            <textarea value={confirmModal.note} onChange={e => setConfirmModal({ ...confirmModal, note: e.target.value })} rows={3} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, resize: 'vertical' as const }} placeholder="e.g., bank confirmation reference..." />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={styles.buttonSecondary} onClick={() => setConfirmModal(null)}>Cancel</button>
              <button style={{ ...styles.buttonPrimary, background: '#16a34a' }} disabled={actionLoading === 'confirm'} onClick={handleConfirmPaid}>{actionLoading === 'confirm' ? 'Confirming...' : 'Confirm Paid'}</button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
