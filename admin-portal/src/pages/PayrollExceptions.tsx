import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner, Grid } from '../ui/layout';
import { useAccess } from '../hooks/useAccess';

const SEV_COLORS: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: '#fef2f2', text: '#dc2626' },
  HIGH: { bg: '#fff7ed', text: '#ea580c' },
  MEDIUM: { bg: '#fffbeb', text: '#d97706' },
  LOW: { bg: '#f0fdf4', text: '#16a34a' },
};
const STAT_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: '#fef2f2', text: '#dc2626' },
  ASSIGNED: { bg: '#eff6ff', text: '#2563eb' },
  RESOLVED: { bg: '#f0fdf4', text: '#16a34a' },
  DISMISSED: { bg: '#f1f5f9', text: '#94a3b8' },
};

export default function PayrollExceptions() {
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [filters, setFilters] = useState({ severity: '', status: '', blockingOnly: false, myAssignedOnly: false });
  const { can } = useAccess();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const params: any = {};
      if (filters.severity) params.severity = filters.severity;
      if (filters.status) params.status = filters.status;
      if (filters.blockingOnly) params.blockingOnly = 'true';
      if (filters.myAssignedOnly) params.myAssignedOnly = 'true';
      params.page = page;
      params.pageSize = pageSize;
      const res = await api.get('/payrun-exceptions', { params });
      setItems(res.data?.items ?? []);
      setSummary(res.data?.summary ?? null);
      setTotal(res.data?.total ?? items.length);
    } catch (err: any) {
      const code = err?.response?.data?.code ?? '';
      if (code === 'PAYROLL_LEGAL_ENTITY_REQUIRED') {
        setItems([]);
      } else {
        setError('Failed to load exceptions');
      }
    } finally { setLoading(false); }
  }, [filters, page]);

  useEffect(() => { void load(); }, [load]);

  const [resolveModal, setResolveModal] = useState<{ id: string; note: string; type: string } | null>(null);
  const [dismissModal, setDismissModal] = useState<{ id: string; reason: string } | null>(null);

  const resolveExc = async () => {
    if (!resolveModal?.note) return;
    try {
      setActionLoading(true);
      await api.post(`/payrun-exceptions/${resolveModal.id}/resolve`, { resolutionType: resolveModal.type || 'DATA_FIXED', resolutionNote: resolveModal.note });
      setActionMsg('Exception resolved');
      setResolveModal(null);
      await load();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed'); }
    finally { setActionLoading(false); }
  };

  const dismissExc = async () => {
    if (!dismissModal?.reason) return;
    try {
      setActionLoading(true);
      await api.post(`/payrun-exceptions/${dismissModal.id}/dismiss`, { dismissalReason: dismissModal.reason });
      setActionMsg('Exception dismissed');
      setDismissModal(null);
      await load();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed'); }
    finally { setActionLoading(false); }
  };

  return (
    <Page
      title="Payroll Exceptions"
      subtitle="Monitor and resolve payroll issues across payruns, periods, entities, and countries."
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.buttonSecondary} onClick={() => setFilters(f => ({ ...f, myAssignedOnly: !f.myAssignedOnly }))}>{filters.myAssignedOnly ? '✓ My Work' : 'My Work'}</button>
          <button style={styles.buttonSecondary} onClick={() => setFilters(f => ({ ...f, blockingOnly: !f.blockingOnly }))}>{filters.blockingOnly ? '✓ Blocking Only' : 'Blocking Only'}</button>
          <button style={styles.buttonSecondary} onClick={load}>Refresh</button>
        </div>
      }
    >
      {error && <Banner variant="error">{error}</Banner>}
      {actionMsg && <Banner variant="success">{actionMsg}</Banner>}

      {/* Summary cards */}
      {summary && (
        <Grid cols="1fr 1fr 1fr 1fr 1fr 1fr" gap={12}>
          <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Open</div><div style={{ fontSize: 22, fontWeight: 700 }}>{summary.openTotal}</div></Card>
          <Card><div style={{ fontSize: 11, color: '#dc2626' }}>Critical</div><div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{summary.criticalOpen}</div></Card>
          <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Blocks Submit</div><div style={{ fontSize: 22, fontWeight: 700, color: summary.blockingSubmissionCount > 0 ? '#dc2626' : '#16a34a' }}>{summary.blockingSubmissionCount}</div></Card>
          <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Blocks Payment</div><div style={{ fontSize: 22, fontWeight: 700, color: summary.blockingPaymentCount > 0 ? '#dc2626' : '#16a34a' }}>{summary.blockingPaymentCount}</div></Card>
          <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Assigned to Me</div><div style={{ fontSize: 22, fontWeight: 700 }}>{summary.assignedToMeCount}</div></Card>
          <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Blocked Payruns</div><div style={{ fontSize: 22, fontWeight: 700, color: summary.blockedPayrunsCount > 0 ? '#dc2626' : '#16a34a' }}>{summary.blockedPayrunsCount}</div></Card>
        </Grid>
      )}

      {/* Filters */}
      <Card>
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 120 }} value={filters.severity} onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}>
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 120 }} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">Open + Assigned</option>
            <option value="OPEN">Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
          {(filters.severity || filters.status || filters.blockingOnly || filters.myAssignedOnly) && (
            <button style={{ ...styles.buttonSecondary, fontSize: 11 }} onClick={() => setFilters({ severity: '', status: '', blockingOnly: false, myAssignedOnly: false })}>Clear Filters</button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader title="Exceptions Queue" right={<span style={{ fontSize: 12, color: styles.colors.textMuted }}>{items.length} exception(s)</span>} />
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' }}><div style={styles.loadingSpinner} /></div>
        ) : items.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: styles.colors.textMuted }}>
            {(filters.severity || filters.status || filters.blockingOnly || filters.myAssignedOnly)
              ? 'No exceptions match the current filters.'
              : 'All visible payruns in your scope are currently free of open payroll exceptions.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Severity</th>
                <th style={styles.tableHeaderCell}>Exception</th>
                <th style={styles.tableHeaderCell}>Employee</th>
                <th style={styles.tableHeaderCell}>Payrun</th>
                <th style={styles.tableHeaderCell}>Pay Group</th>
                <th style={styles.tableHeaderCell}>Blockers</th>
                <th style={styles.tableHeaderCell}>Status</th>
                <th style={styles.tableHeaderCell}>Detected</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr></thead>
              <tbody>
                {items.map((exc: any) => {
                  const sevC = SEV_COLORS[exc.severity] ?? SEV_COLORS.MEDIUM;
                  const stC = STAT_COLORS[exc.status] ?? STAT_COLORS.OPEN;
                  return (
                    <tr key={exc.id} style={styles.tableRow}>
                      <td style={styles.tableCell}><span style={{ background: sevC.bg, color: sevC.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const }}>{exc.severity}</span></td>
                      <td style={styles.tableCell}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{exc.title}</div>
                        <div style={{ fontSize: 11, color: styles.colors.textMuted, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{exc.description}</div>
                      </td>
                      <td style={styles.tableCell}><span style={{ fontSize: 12 }}>{exc.employeeName ?? '—'}</span></td>
                      <td style={styles.tableCell}>
                        <Link to={`/payroll/payruns/${exc.payrunId}?tab=exceptions`} style={{ color: styles.colors.primary, textDecoration: 'none', fontSize: 12 }}>
                          {exc.payrunName ?? exc.payrunId}
                        </Link>
                        {exc.payrunStatus && <div style={{ fontSize: 10, color: styles.colors.textMuted }}>{exc.payrunStatus}</div>}
                      </td>
                      <td style={styles.tableCell}><span style={{ fontSize: 12 }}>{exc.payGroupName ?? '—'}</span><div style={{ fontSize: 10, color: styles.colors.textMuted }}>{exc.legalEntityName ?? ''}</div></td>
                      <td style={styles.tableCell}>
                        {exc.blocksSubmission && <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 6px', borderRadius: 4, fontSize: 10, marginRight: 4 }}>Submit</span>}
                        {exc.blocksPayment && <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>Payment</span>}
                        {!exc.blocksSubmission && !exc.blocksPayment && <span style={{ fontSize: 11, color: styles.colors.textMuted }}>—</span>}
                      </td>
                      <td style={styles.tableCell}><span style={{ background: stC.bg, color: stC.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{exc.status}</span></td>
                      <td style={styles.tableCell}><span style={{ fontSize: 11, color: styles.colors.textMuted }}>{new Date(exc.detectedAt).toLocaleDateString()}</span></td>
                      <td style={styles.tableCell}>
                        {['OPEN', 'ASSIGNED'].includes(exc.status) && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {can('payroll:exceptions:resolve') && <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px' }} disabled={actionLoading} onClick={() => setResolveModal({ id: exc.id, note: '', type: 'DATA_FIXED' })}>Resolve</button>}
                            {can('payroll:exceptions:dismiss') && <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px', color: '#94a3b8' }} disabled={actionLoading} onClick={() => setDismissModal({ id: exc.id, reason: '' })}>Dismiss</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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

      {resolveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Resolve Exception</h3>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: styles.colors.textMuted }}>Resolution Type</label>
            <select value={resolveModal.type} onChange={e => setResolveModal({ ...resolveModal, type: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, marginBottom: 12 }}>
              <option value="DATA_FIXED">Data Fixed</option>
              <option value="ACCEPTED_WITH_JUSTIFICATION">Accepted with Justification</option>
              <option value="NOT_APPLICABLE">Not Applicable</option>
              <option value="MANUAL_OVERRIDE_APPROVED">Manual Override Approved</option>
            </select>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: styles.colors.textMuted }}>Resolution Note *</label>
            <textarea value={resolveModal.note} onChange={e => setResolveModal({ ...resolveModal, note: e.target.value })} rows={3} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, resize: 'vertical' as const }} placeholder="Describe what was fixed..." />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={styles.buttonSecondary} onClick={() => setResolveModal(null)}>Cancel</button>
              <button style={styles.buttonPrimary} disabled={!resolveModal.note.trim() || actionLoading} onClick={resolveExc}>{actionLoading ? 'Resolving...' : 'Resolve'}</button>
            </div>
          </div>
        </div>
      )}

      {dismissModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Dismiss Exception</h3>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: styles.colors.textMuted }}>Dismissal Reason *</label>
            <textarea value={dismissModal.reason} onChange={e => setDismissModal({ ...dismissModal, reason: e.target.value })} rows={3} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, resize: 'vertical' as const }} placeholder="Explain why this exception is being dismissed..." />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={styles.buttonSecondary} onClick={() => setDismissModal(null)}>Cancel</button>
              <button style={{ ...styles.buttonPrimary, background: '#94a3b8' }} disabled={!dismissModal.reason.trim() || actionLoading} onClick={dismissExc}>{actionLoading ? 'Dismissing...' : 'Dismiss'}</button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
