import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner, Grid } from '../ui/layout';
import { useAccess } from '../hooks/useAccess';
import { classifyPageState } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageStateView } from '../ui/PageStateViews';

export default function PaymentBatches() {
  const { can } = useAccess();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [payruns, setPayruns] = useState<any[]>([]);
  const [selectedPayrunId, setSelectedPayrunId] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;
  const [confirmModal, setConfirmModal] = useState<{ batchId: string; note: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true); setLoadError(null);
      const params: any = { page, pageSize };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/payments/batches', { params });
      setBatches(res.data?.data ?? res.data?.items ?? res.data ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err) {
      setLoadError(err);
      setBatches([]);
    } finally { setLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { void loadData(); }, [loadData]);

  const loadPayruns = async () => {
    try {
      const res = await api.get('/payruns?limit=50');
      setPayruns((res.data?.items ?? res.data ?? []).filter((p: any) => ['APPROVED', 'IN_REVIEW', 'PAID', 'POSTED'].includes(p.status)));
    } catch {}
  };

  const createBatch = async () => {
    if (!selectedPayrunId) { setActionError('Select a payrun'); return; }
    try {
      setActionLoading(true); setActionMsg(null); setActionError(null);
      await api.post('/payments/batches', { payrunId: selectedPayrunId });
      setActionMsg('Payment batch created');
      setShowCreate(false);
      await loadData();
    } catch (e: any) {
      setActionError(e?.response?.data?.message ?? 'Failed to create batch');
    } finally { setActionLoading(false); }
  };

  const exportBatch = async (batchId: string) => {
    try {
      setActionLoading(true);
      await api.post(`/payments/batches/${batchId}/export`);
      setActionMsg('Batch exported');
      await loadData();
    } catch (e: any) { setActionError(e?.response?.data?.message ?? 'Export failed'); }
    finally { setActionLoading(false); }
  };

  const confirmPaid = async () => {
    if (!confirmModal) return;
    try {
      setActionLoading(true);
      await api.post(`/payments/batches/${confirmModal.batchId}/confirm-paid`, { confirmationNote: confirmModal.note || undefined });
      setActionMsg('Batch confirmed as paid');
      setConfirmModal(null);
      await loadData();
    } catch (e: any) { setActionError(e?.response?.data?.message ?? 'Confirmation failed'); }
    finally { setActionLoading(false); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount ?? 0);
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const statusBadge = (status: string): { bg: string; text: string } => {
    const m: Record<string, { bg: string; text: string }> = {
      PENDING: { bg: '#f1f5f9', text: '#475569' },
      GENERATED: { bg: '#eff6ff', text: '#2563eb' },
      SUBMITTED: { bg: '#fffbeb', text: '#d97706' },
      PROCESSED: { bg: '#f0fdf4', text: '#16a34a' },
      CONFIRMED_PAID: { bg: '#f0fdf4', text: '#059669' },
      FAILED: { bg: '#fef2f2', text: '#dc2626' },
      CANCELLED: { bg: '#f1f5f9', text: '#94a3b8' },
      completed: { bg: '#f0fdf4', text: '#16a34a' },
      approved: { bg: '#eff6ff', text: '#2563eb' },
      pending_approval: { bg: '#fffbeb', text: '#d97706' },
    };
    return m[status] ?? { bg: '#f1f5f9', text: '#475569' };
  };

  const pageState = classifyPageState({ loading, error: loadError, data: batches });
  usePageStateTelemetry('payroll.paymentBatches', 'payroll', pageState);
  const openBatches = batches.filter(b => !['CONFIRMED_PAID', 'PROCESSED', 'CANCELLED'].includes(b.status)).length;
  const totalPending = batches.filter(b => !['CONFIRMED_PAID', 'PROCESSED', 'CANCELLED'].includes(b.status)).reduce((s, b) => s + Number(b.netAmount ?? b.totalAmount ?? b.total_amount ?? 0), 0);
  const confirmedCount = batches.filter(b => ['CONFIRMED_PAID', 'PROCESSED'].includes(b.status)).length;

  return (
    <Page
      title="Payment Batches"
      subtitle="Manage payroll payment preparation, export, confirmation, and batch status."
      actions={can('payment_batch:create') ? <button style={styles.buttonPrimary} onClick={() => { setShowCreate(true); loadPayruns(); }}>Create Batch</button> : undefined}
    >
      {actionError && <Banner variant="error">{actionError}</Banner>}
      {actionMsg && <Banner variant="success">{actionMsg}</Banner>}

      {pageState.kind === 'loading' ? (
        <div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div>
      ) : pageState.kind !== 'ready' ? (
        <PageStateView
          state={pageState}
          page="payroll.paymentBatches"
          module="payroll"
          onRetry={loadData}
          emptyTitle="No payment batches found"
          emptyMessage="Create a batch from an approved payrun to get started."
        />
      ) : (
      <>
      <Grid cols="1fr 1fr 1fr 1fr" gap={12}>
        <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Total Batches</div><div style={{ fontSize: 22, fontWeight: 700 }}>{batches.length}</div></Card>
        <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Open Batches</div><div style={{ fontSize: 22, fontWeight: 700 }}>{openBatches}</div></Card>
        <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Total Pending</div><div style={{ fontSize: 22, fontWeight: 700 }}>{formatCurrency(totalPending)}</div></Card>
        <Card><div style={{ fontSize: 11, color: '#16a34a' }}>Confirmed Paid</div><div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{confirmedCount}</div></Card>
      </Grid>

      {/* Create batch panel */}
      {showCreate && (
        <Card>
          <CardHeader title="Create Payment Batch from Payrun" />
          <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 11, color: styles.colors.textMuted, display: 'block', marginBottom: 4 }}>Payrun (Approved)</label>
              <select value={selectedPayrunId} onChange={e => setSelectedPayrunId(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 300 }}>
                <option value="">— Select payrun —</option>
                {payruns.map(pr => <option key={pr.id} value={pr.id}>{pr.pay_group_name ?? pr.payGroupName ?? pr.id} ({pr.status})</option>)}
              </select>
            </div>
            <button style={styles.buttonPrimary} disabled={actionLoading || !selectedPayrunId} onClick={createBatch}>Create Batch</button>
            <button style={styles.buttonSecondary} onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', alignItems: 'center' }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 140 }}>
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="READY">Ready</option>
            <option value="GENERATED">Generated</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="PROCESSED">Processed</option>
            <option value="CONFIRMED_PAID">Confirmed Paid</option>
            <option value="FAILED">Failed</option>
          </select>
          <button style={styles.buttonSecondary} onClick={loadData}>Refresh</button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader title="All Batches" />
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Batch</th>
                <th style={styles.tableHeaderCell}>Status</th>
                <th style={styles.tableHeaderCell}>Payments</th>
                <th style={{ ...styles.tableHeaderCell, textAlign: 'right' as const }}>Amount</th>
                <th style={styles.tableHeaderCell}>Export</th>
                <th style={styles.tableHeaderCell}>Updated</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr></thead>
              <tbody>
                {batches.map((batch: any) => {
                  const st = statusBadge(batch.status);
                  return (
                    <tr key={batch.id} style={styles.tableRow}>
                      <td style={styles.tableCell}>
                        <Link to={`/payroll/payment-batches/${batch.id}`} style={{ fontWeight: 600, color: styles.colors.primary, textDecoration: 'none' }}>
                          {batch.batchCode ?? batch.reference ?? batch.id}
                        </Link>
                        {batch.payrunName && <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{batch.payrunName}</div>}
                      </td>
                      <td style={styles.tableCell}><span style={{ background: st.bg, color: st.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{batch.status}</span></td>
                      <td style={styles.tableCell}>{batch.employeeCount ?? batch.paymentCount ?? '—'}</td>
                      <td style={{ ...styles.tableCell, textAlign: 'right' as const, fontWeight: 600 }}>{formatCurrency(Number(batch.netAmount ?? batch.totalAmount ?? 0))}</td>
                      <td style={styles.tableCell}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{batch.exportStatus ?? '—'}</span></td>
                      <td style={styles.tableCell}><span style={{ fontSize: 11, color: styles.colors.textMuted }}>{formatDate(batch.updatedAt ?? batch.createdAt)}</span></td>
                      <td style={styles.tableCell}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Link to={`/payroll/payment-batches/${batch.id}`} style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px', textDecoration: 'none' }}>View</Link>
                          {can('payment_batch:export') && ['PENDING', 'READY', 'GENERATED'].includes(batch.status) && <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px' }} disabled={actionLoading} onClick={() => exportBatch(batch.id)}>Export</button>}
                          {can('payment_batch:confirm_paid') && ['GENERATED', 'SUBMITTED', 'READY'].includes(batch.status) && <button style={{ ...styles.buttonPrimary, fontSize: 11, padding: '3px 8px', background: '#16a34a' }} disabled={actionLoading} onClick={() => setConfirmModal({ batchId: batch.id, note: '' })}>Confirm Paid</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </Card>

      {total > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <span style={{ fontSize: 12, color: styles.colors.textMuted }}>Showing {(page-1)*pageSize+1}–{Math.min(page*pageSize, total)} of {total}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={styles.buttonSecondary} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
            <button style={styles.buttonSecondary} disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}

      </>
      )}

      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Confirm Payment</h3>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: styles.colors.textMuted }}>Confirmation Note</label>
            <textarea value={confirmModal.note} onChange={e => setConfirmModal({ ...confirmModal, note: e.target.value })} rows={3} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, resize: 'vertical' as const }} placeholder="e.g., bank confirmation reference..." />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={styles.buttonSecondary} onClick={() => setConfirmModal(null)}>Cancel</button>
              <button style={{ ...styles.buttonPrimary, background: '#16a34a' }} disabled={actionLoading} onClick={confirmPaid}>{actionLoading ? 'Confirming...' : 'Confirm Paid'}</button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
