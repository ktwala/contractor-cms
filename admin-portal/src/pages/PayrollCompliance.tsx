import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import { Page, Card, CardHeader, Banner, Grid } from '../ui/layout';
import { classifyPageState } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageStateView } from '../ui/PageStateViews';

const REPORT_TYPES = [
  { value: 'EMP201', label: 'EMP201 (ZA Monthly)', country: 'ZA' },
  { value: 'IRP5', label: 'IRP5 (ZA Annual)', country: 'ZA' },
  { value: 'EMP501', label: 'EMP501 (ZA Annual)', country: 'ZA' },
  { value: 'PAYE_RETURN_LS', label: 'PAYE Return (LS Monthly)', country: 'LS' },
  { value: 'EMPLOYEE_TAX_CERTIFICATE_LS', label: 'Tax Certificate (LS Annual)', country: 'LS' },
  { value: 'SOCIAL_CONTRIBUTION_REPORT_LS', label: 'Social Contributions (LS)', country: 'LS' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#f1f5f9', text: '#475569' },
  GENERATED: { bg: '#eff6ff', text: '#2563eb' },
  REVIEWED: { bg: '#fffbeb', text: '#d97706' },
  APPROVED_FOR_SUBMISSION: { bg: '#f0fdf4', text: '#16a34a' },
  SUBMITTED: { bg: '#f0fdf4', text: '#16a34a' },
  FAILED: { bg: '#fef2f2', text: '#dc2626' },
};

const SUB_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  NOT_SUBMITTED: { bg: '#f1f5f9', text: '#94a3b8' },
  SUBMITTED: { bg: '#f0fdf4', text: '#16a34a' },
  ACCEPTED: { bg: '#f0fdf4', text: '#059669' },
  REJECTED: { bg: '#fef2f2', text: '#dc2626' },
};

export default function PayrollCompliance() {
  const { can } = useAccess();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [genPayrunId, setGenPayrunId] = useState('');
  const [genReportType, setGenReportType] = useState('EMP201');
  const [payruns, setPayruns] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [submitModal, setSubmitModal] = useState<{ id: string; ref: string } | null>(null);
  const [statusModal, setStatusModal] = useState<{ id: string; status: string; ref: string } | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  const load = useCallback(async () => {
    try {
      setLoading(true); setLoadError(null);
      const params: any = { page, pageSize };
      if (filterCountry) params.countryCode = filterCountry;
      if (filterType) params.reportType = filterType;
      const res = await api.get('/payroll/compliance/reports', { params });
      setReports(res.data?.items ?? res.data ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err) {
      setLoadError(err);
      setReports([]);
    } finally { setLoading(false); }
  }, [filterCountry, filterType, page]);

  useEffect(() => { void load(); }, [load]);

  const loadPayruns = async () => {
    try {
      const res = await api.get('/payruns?limit=50');
      setPayruns(res.data?.items ?? res.data ?? []);
    } catch {}
  };

  const generateReport = async () => {
    if (!genPayrunId) { setActionError('Select a payrun'); return; }
    try {
      setActionLoading(true); setActionMsg(null); setActionError(null);
      await api.post('/payroll/compliance/reports/generate', { payrunId: genPayrunId, reportType: genReportType });
      setActionMsg(`${genReportType} report generated`);
      setShowGenerate(false);
      await load();
    } catch (e: any) { setActionError(e?.response?.data?.message ?? 'Generation failed'); }
    finally { setActionLoading(false); }
  };

  const submitReport = async () => {
    if (!submitModal?.ref) return;
    try {
      setActionLoading(true);
      await api.post(`/payroll/compliance/reports/${submitModal.id}/submit`, { submissionReference: submitModal.ref });
      setActionMsg('Report submitted');
      setSubmitModal(null);
      await load();
    } catch (e: any) { setActionError(e?.response?.data?.message ?? 'Submission failed'); }
    finally { setActionLoading(false); }
  };

  const updateReportStatus = async () => {
    if (!statusModal) return;
    try {
      setActionLoading(true);
      await api.post(`/payroll/compliance/reports/${statusModal.id}/update-status`, {
        status: statusModal.status,
        authorityReference: statusModal.ref || undefined,
      });
      setActionMsg(`Report marked as ${statusModal.status}`);
      setStatusModal(null);
      await load();
    } catch (e: any) { setActionError(e?.response?.data?.message ?? 'Status update failed'); }
    finally { setActionLoading(false); }
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';
  const fmtCurrency = (v: any) => v != null ? Number(v).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' }) : '—';

  const pendingCount = reports.filter(r => r.status === 'GENERATED' || r.status === 'REVIEWED').length;
  const readyCount = reports.filter(r => r.status === 'APPROVED_FOR_SUBMISSION').length;
  const submittedCount = reports.filter(r => r.submissionStatus === 'SUBMITTED' || r.submissionStatus === 'ACCEPTED').length;
  const failedCount = reports.filter(r => r.status === 'FAILED' || r.submissionStatus === 'REJECTED').length;

  const pageState = classifyPageState({ loading, error: loadError, data: reports });
  usePageStateTelemetry('payroll.compliance', 'payroll', pageState);

  return (
    <Page
      title="Payroll Compliance"
      subtitle="Generate, review, and submit statutory payroll reports for each country and period."
      actions={
        can('compliance:write') ? <button style={styles.buttonPrimary} onClick={() => { setShowGenerate(true); loadPayruns(); }}>Generate Report</button> : undefined
      }
    >
      {actionError && <Banner variant="error">{actionError}</Banner>}
      {actionMsg && <Banner variant="success">{actionMsg}</Banner>}

      {pageState.kind === 'loading' ? (
        <div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div>
      ) : pageState.kind !== 'ready' ? (
        <PageStateView
          state={pageState}
          page="payroll.compliance"
          module="payroll"
          onRetry={load}
          emptyTitle="No compliance reports found"
          emptyMessage="Generate a report to get started."
        />
      ) : (
      <>
      <Grid cols="1fr 1fr 1fr 1fr" gap={12}>
        <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Pending</div><div style={{ fontSize: 22, fontWeight: 700 }}>{pendingCount}</div></Card>
        <Card><div style={{ fontSize: 11, color: '#16a34a' }}>Ready to Submit</div><div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{readyCount}</div></Card>
        <Card><div style={{ fontSize: 11, color: '#2563eb' }}>Submitted</div><div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>{submittedCount}</div></Card>
        <Card><div style={{ fontSize: 11, color: '#dc2626' }}>Failed</div><div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{failedCount}</div></Card>
      </Grid>

      {/* Generate modal */}
      {showGenerate && (
        <Card>
          <CardHeader title="Generate Compliance Report" />
          <div style={{ padding: '16px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: styles.colors.textMuted, display: 'block', marginBottom: 4 }}>Report Type</label>
              <select value={genReportType} onChange={e => setGenReportType(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 200 }}>
                {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: styles.colors.textMuted, display: 'block', marginBottom: 4 }}>Payrun</label>
              <select value={genPayrunId} onChange={e => setGenPayrunId(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 250 }}>
                <option value="">— Select payrun —</option>
                {payruns.map(pr => <option key={pr.id} value={pr.id}>{pr.pay_group_name ?? pr.payGroupName ?? pr.id} ({pr.status})</option>)}
              </select>
            </div>
            <button style={styles.buttonPrimary} disabled={actionLoading || !genPayrunId} onClick={generateReport}>Generate</button>
            <button style={styles.buttonSecondary} onClick={() => setShowGenerate(false)}>Cancel</button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 120 }} value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
            <option value="">All Countries</option>
            <option value="ZA">South Africa</option>
            <option value="LS">Lesotho</option>
          </select>
          <select style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 150 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Report Types</option>
            {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button style={styles.buttonSecondary} onClick={load}>Refresh</button>
        </div>
      </Card>

      {/* Reports table */}
      <Card>
        <CardHeader title="Compliance Reports" right={<span style={{ fontSize: 12, color: styles.colors.textMuted }}>{reports.length} report(s)</span>} />
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Report Type</th>
                <th style={styles.tableHeaderCell}>Country</th>
                <th style={styles.tableHeaderCell}>Legal Entity</th>
                <th style={styles.tableHeaderCell}>Period</th>
                <th style={styles.tableHeaderCell}>Status</th>
                <th style={styles.tableHeaderCell}>Submission</th>
                <th style={styles.tableHeaderCell}>Generated</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr></thead>
              <tbody>
                {reports.map((rpt: any) => {
                  const sc = STATUS_COLORS[rpt.status] ?? STATUS_COLORS.DRAFT;
                  const subSc = SUB_STATUS_COLORS[rpt.submissionStatus] ?? SUB_STATUS_COLORS.NOT_SUBMITTED;
                  return (
                    <tr key={rpt.id} style={{ ...styles.tableRow, cursor: 'pointer' }} onClick={() => setSelectedReport(rpt)}>
                      <td style={styles.tableCell}><span style={{ fontWeight: 500, fontSize: 12 }}>{REPORT_TYPES.find(t => t.value === rpt.reportType)?.label ?? rpt.reportType}</span></td>
                      <td style={styles.tableCell}>{rpt.countryCode}</td>
                      <td style={styles.tableCell}><span style={{ fontSize: 12 }}>{rpt.legalEntityName ?? '—'}</span></td>
                      <td style={styles.tableCell}><span style={{ fontSize: 12 }}>{rpt.periodName ?? '—'}</span></td>
                      <td style={styles.tableCell}><span style={{ background: sc.bg, color: sc.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{rpt.status}</span></td>
                      <td style={styles.tableCell}><span style={{ background: subSc.bg, color: subSc.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{rpt.submissionStatus ?? 'NOT_SUBMITTED'}</span></td>
                      <td style={styles.tableCell}><span style={{ fontSize: 11, color: styles.colors.textMuted }}>{fmt(rpt.generatedAt)}</span></td>
                      <td style={styles.tableCell}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {can('compliance:write') && ['GENERATED', 'REVIEWED', 'APPROVED_FOR_SUBMISSION'].includes(rpt.status) && (!rpt.submissionStatus || rpt.submissionStatus === 'NOT_SUBMITTED') && (
                            <button style={{ ...styles.buttonPrimary, fontSize: 11, padding: '3px 8px', background: '#16a34a' }} disabled={actionLoading} onClick={e => { e.stopPropagation(); setSubmitModal({ id: rpt.id, ref: '' }); }}>Submit</button>
                          )}
                          {can('compliance:write') && rpt.submissionStatus === 'SUBMITTED' && (
                            <>
                              <button style={{ ...styles.buttonPrimary, fontSize: 11, padding: '3px 8px', background: '#059669' }} disabled={actionLoading} onClick={e => { e.stopPropagation(); setStatusModal({ id: rpt.id, status: 'ACCEPTED', ref: '' }); }}>Accept</button>
                              <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px', color: '#dc2626' }} disabled={actionLoading} onClick={e => { e.stopPropagation(); setStatusModal({ id: rpt.id, status: 'REJECTED', ref: '' }); }}>Reject</button>
                            </>
                          )}
                          {can('compliance:write') && rpt.submissionStatus === 'REJECTED' && (
                            <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px' }} disabled={actionLoading} onClick={e => { e.stopPropagation(); setSubmitModal({ id: rpt.id, ref: '' }); }}>Resubmit</button>
                          )}
                          <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px' }} onClick={e => { e.stopPropagation(); setSelectedReport(rpt); }}>View</button>
                          {rpt.payrunId && <Link to={`/payroll/payruns/${rpt.payrunId}`} style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>Payrun</Link>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </Card>

      {/* Detail panel */}
      {selectedReport && (
        <Card>
          <CardHeader title={`${selectedReport.reportType} — ${selectedReport.periodName ?? selectedReport.id}`} right={<button style={styles.buttonSecondary} onClick={() => setSelectedReport(null)}>Close</button>} />
          <div style={{ padding: 16 }}>
            <Grid cols="1fr 1fr 1fr" gap={12}>
              <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Country</div><div style={{ fontWeight: 500 }}>{selectedReport.countryCode}</div></div>
              <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Legal Entity</div><div style={{ fontWeight: 500 }}>{selectedReport.legalEntityName ?? '—'}</div></div>
              <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Payrun</div><div style={{ fontWeight: 500 }}>{selectedReport.payrunId ? <Link to={`/payroll/payruns/${selectedReport.payrunId}`} style={{ color: styles.colors.primary }}>{selectedReport.payrunId}</Link> : '—'}</div></div>
            </Grid>
            {selectedReport.totals && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Totals</div>
                <Grid cols="1fr 1fr 1fr 1fr" gap={8}>
                  {selectedReport.totals.paye != null && <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>PAYE</div><div style={{ fontWeight: 600 }}>{fmtCurrency(selectedReport.totals.paye)}</div></div>}
                  {selectedReport.totals.uif != null && <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>UIF</div><div style={{ fontWeight: 600 }}>{fmtCurrency(selectedReport.totals.uif)}</div></div>}
                  {selectedReport.totals.sdl != null && <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>SDL</div><div style={{ fontWeight: 600 }}>{fmtCurrency(selectedReport.totals.sdl)}</div></div>}
                  {selectedReport.totals.totalLiability != null && <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Total Liability</div><div style={{ fontWeight: 700 }}>{fmtCurrency(selectedReport.totals.totalLiability)}</div></div>}
                </Grid>
              </div>
            )}
            {selectedReport.submissionReference && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Submission Reference</div>
                <div style={{ fontWeight: 500, fontFamily: 'monospace' }}>{selectedReport.submissionReference}</div>
              </div>
            )}
          </div>
        </Card>
      )}
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

      {submitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Submit Compliance Report</h3>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: styles.colors.textMuted }}>Submission Reference *</label>
            <input value={submitModal.ref} onChange={e => setSubmitModal({ ...submitModal, ref: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13 }} placeholder="e.g., SARS reference number" />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={styles.buttonSecondary} onClick={() => setSubmitModal(null)}>Cancel</button>
              <button style={styles.buttonPrimary} disabled={!submitModal.ref.trim() || actionLoading} onClick={submitReport}>{actionLoading ? 'Submitting...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}

      {statusModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Mark Report as {statusModal.status}</h3>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: styles.colors.textMuted }}>Authority Reference (optional)</label>
            <input value={statusModal.ref} onChange={e => setStatusModal({ ...statusModal, ref: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13 }} placeholder="e.g., SARS12345" />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={styles.buttonSecondary} onClick={() => setStatusModal(null)}>Cancel</button>
              <button style={{ ...styles.buttonPrimary, background: statusModal.status === 'ACCEPTED' ? '#059669' : '#dc2626' }} disabled={actionLoading} onClick={updateReportStatus}>{actionLoading ? 'Updating...' : `Confirm ${statusModal.status}`}</button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
