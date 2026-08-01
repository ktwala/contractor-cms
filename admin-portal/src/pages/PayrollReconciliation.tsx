import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner, Grid } from '../ui/layout';
import { classifyPageState } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageStateView } from '../ui/PageStateViews';

const RESULT_COLORS: Record<string, { bg: string; text: string }> = {
  PASS: { bg: '#f0fdf4', text: '#16a34a' },
  WARNING: { bg: '#fffbeb', text: '#d97706' },
  FAIL: { bg: '#fef2f2', text: '#dc2626' },
  NOT_RUN: { bg: '#f1f5f9', text: '#94a3b8' },
};

export default function PayrollReconciliation() {
  const [payruns, setPayruns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPayrun, setSelectedPayrun] = useState<any>(null);
  const [reconDetail, setReconDetail] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true); setLoadError(null);
      const res = await api.get('/payruns?limit=50');
      const items = (res.data?.items ?? res.data ?? []).filter((p: any) =>
        ['CALCULATED', 'IN_REVIEW', 'APPROVED', 'PAID', 'POSTED', 'FINALIZED'].includes(p.status));
      const enriched = await Promise.all(items.map(async (pr: any) => {
        try {
          const rRes = await api.get(`/payruns/${pr.id}/reconciliation`);
          return { ...pr, reconciliation: rRes.data };
        } catch { return { ...pr, reconciliation: null }; }
      }));
      setPayruns(enriched);
    } catch (err) {
      setLoadError(err);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runReconciliation = async (payrunId: string) => {
    try {
      setActionLoading(true); setActionMsg(null); setActionError(null);
      const res = await api.post(`/payruns/${payrunId}/reconciliation/run`);
      setActionMsg('Reconciliation completed');
      setReconDetail(res.data);
      await load();
    } catch (e: any) { setActionError(e?.response?.data?.message ?? 'Reconciliation failed'); }
    finally { setActionLoading(false); }
  };

  const reviewReconciliation = async (payrunId: string) => {
    const note = prompt('Review note (optional):');
    try {
      setActionLoading(true);
      await api.post(`/payruns/${payrunId}/reconciliation/review`, { reviewNote: note ?? '' });
      setActionMsg('Reconciliation reviewed');
      await load();
    } catch (e: any) { setActionError(e?.response?.data?.message ?? 'Review failed'); }
    finally { setActionLoading(false); }
  };

  const selectPayrun = async (pr: any) => {
    setSelectedPayrun(pr);
    if (pr.reconciliation) {
      setReconDetail(pr.reconciliation);
    } else {
      try {
        const res = await api.get(`/payruns/${pr.id}/reconciliation`);
        setReconDetail(res.data);
      } catch { setReconDetail(null); }
    }
  };

  const fmt = (v: any) => v != null ? Number(v).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' }) : '—';

  const pageState = classifyPageState({ loading, error: loadError, data: payruns });
  usePageStateTelemetry('payroll.reconciliation', 'payroll', pageState);
  const passCount = payruns.filter(p => p.reconciliation?.overallResult === 'PASS').length;
  const warnCount = payruns.filter(p => p.reconciliation?.overallResult === 'WARNING').length;
  const failCount = payruns.filter(p => p.reconciliation?.overallResult === 'FAIL').length;
  const notRunCount = payruns.filter(p => !p.reconciliation).length;

  return (
    <Page
      title="Payroll Reconciliation"
      subtitle="Validate payroll totals, payment outputs, and statutory consistency across runs."
      actions={<button style={styles.buttonSecondary} onClick={load}>Refresh</button>}
    >
      {actionError && <Banner variant="error">{actionError}</Banner>}
      {actionMsg && <Banner variant="success">{actionMsg}</Banner>}

      {pageState.kind === 'loading' ? (
        <div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div>
      ) : pageState.kind !== 'ready' ? (
        <PageStateView
          state={pageState}
          page="payroll.reconciliation"
          module="payroll"
          emptyTitle="No calculated or completed payruns found."
          emptyMessage="Run a payroll calculation first to see reconciliation data here."
        />
      ) : (
        <>
          <Grid cols="1fr 1fr 1fr 1fr" gap={12}>
            <Card><div style={{ fontSize: 11, color: '#16a34a' }}>Pass</div><div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{passCount}</div></Card>
            <Card><div style={{ fontSize: 11, color: '#d97706' }}>Warnings</div><div style={{ fontSize: 22, fontWeight: 700, color: '#d97706' }}>{warnCount}</div></Card>
            <Card><div style={{ fontSize: 11, color: '#dc2626' }}>Failed</div><div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{failCount}</div></Card>
            <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Not Run</div><div style={{ fontSize: 22, fontWeight: 700 }}>{notRunCount}</div></Card>
          </Grid>

          <Card>
            <CardHeader title="Payrun Reconciliations" />
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead><tr style={styles.tableHeader}>
                  <th style={styles.tableHeaderCell}>Payrun</th>
                  <th style={styles.tableHeaderCell}>Status</th>
                  <th style={styles.tableHeaderCell}>Reconciliation</th>
                  <th style={styles.tableHeaderCell}>Checks</th>
                  <th style={styles.tableHeaderCell}>Reviewed</th>
                  <th style={styles.tableHeaderCell}>Actions</th>
                </tr></thead>
                <tbody>
                  {payruns.map((pr: any) => {
                    const recon = pr.reconciliation;
                    const rc = RESULT_COLORS[recon?.overallResult] ?? RESULT_COLORS.NOT_RUN;
                    return (
                      <tr key={pr.id} style={{ ...styles.tableRow, background: selectedPayrun?.id === pr.id ? '#eff6ff' : undefined, cursor: 'pointer' }} onClick={() => selectPayrun(pr)}>
                        <td style={styles.tableCell}>
                          <div style={{ fontWeight: 500 }}>{pr.pay_group_name ?? pr.payGroupName ?? pr.id}</div>
                          <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{pr.period_start ? new Date(pr.period_start).toLocaleDateString() : ''} – {pr.period_end ? new Date(pr.period_end).toLocaleDateString() : ''}</div>
                        </td>
                        <td style={styles.tableCell}><span style={{ fontSize: 11, fontWeight: 600 }}>{pr.status}</span></td>
                        <td style={styles.tableCell}><span style={{ background: rc.bg, color: rc.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{recon?.overallResult ?? 'NOT RUN'}</span></td>
                        <td style={styles.tableCell}><span style={{ fontSize: 12 }}>{recon ? `${recon.passCount ?? 0}P / ${recon.warningCount ?? 0}W / ${recon.failCount ?? 0}F` : '—'}</span></td>
                        <td style={styles.tableCell}><span style={{ fontSize: 11, color: styles.colors.textMuted }}>{recon?.reviewedAt ? new Date(recon.reviewedAt).toLocaleDateString() : '—'}</span></td>
                        <td style={styles.tableCell}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px' }} disabled={actionLoading} onClick={e => { e.stopPropagation(); runReconciliation(pr.id); }}>Run</button>
                            {recon && !recon.reviewedAt && (
                              <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px' }} disabled={actionLoading} onClick={e => { e.stopPropagation(); reviewReconciliation(pr.id); }}>Review</button>
                            )}
                            <Link to={`/payroll/payruns/${pr.id}`} style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>Open</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Detail panel */}
      {selectedPayrun && reconDetail && reconDetail.checks && (
        <Card>
          <CardHeader title={`Reconciliation Detail — ${selectedPayrun.pay_group_name ?? selectedPayrun.id}`} right={
            reconDetail.reviewedAt ? <span style={{ fontSize: 12, color: '#16a34a' }}>Reviewed {new Date(reconDetail.reviewedAt).toLocaleDateString()}</span> : <span style={{ fontSize: 12, color: styles.colors.textMuted }}>Not reviewed</span>
          } />
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Check</th>
                <th style={styles.tableHeaderCell}>Type</th>
                <th style={styles.tableHeaderCell}>Result</th>
                <th style={styles.tableHeaderCell}>Expected</th>
                <th style={styles.tableHeaderCell}>Actual</th>
                <th style={styles.tableHeaderCell}>Variance</th>
                <th style={styles.tableHeaderCell}>Message</th>
              </tr></thead>
              <tbody>
                {reconDetail.checks.map((chk: any, i: number) => {
                  const rc = RESULT_COLORS[chk.status] ?? RESULT_COLORS.NOT_RUN;
                  return (
                    <tr key={i} style={styles.tableRow}>
                      <td style={styles.tableCell}><span style={{ fontWeight: 500, fontSize: 12 }}>{chk.checkCode}</span></td>
                      <td style={styles.tableCell}><span style={{ fontSize: 11 }}>{chk.checkType}</span></td>
                      <td style={styles.tableCell}><span style={{ background: rc.bg, color: rc.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{chk.status}</span></td>
                      <td style={styles.tableCell}>{chk.expectedValue != null ? fmt(chk.expectedValue) : '—'}</td>
                      <td style={styles.tableCell}>{chk.actualValue != null ? fmt(chk.actualValue) : '—'}</td>
                      <td style={styles.tableCell}><span style={{ color: chk.variance && chk.variance !== 0 ? '#dc2626' : '#16a34a' }}>{chk.variance != null ? fmt(chk.variance) : '—'}</span></td>
                      <td style={styles.tableCell}><span style={{ fontSize: 11, color: styles.colors.textMuted }}>{chk.message}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}
