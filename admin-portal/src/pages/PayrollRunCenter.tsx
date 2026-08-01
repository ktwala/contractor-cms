import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import { Page, Card, CardHeader, Banner, Grid } from '../ui/layout';
import PayrollReadinessCard from '../components/payroll/PayrollReadinessCard';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#f1f5f9', text: '#475569' },
  SNAPSHOT: { bg: '#eff6ff', text: '#2563eb' },
  CALCULATING: { bg: '#fef3c7', text: '#d97706' },
  CALCULATED: { bg: '#dbeafe', text: '#1d4ed8' },
  IN_REVIEW: { bg: '#fef9c3', text: '#ca8a04' },
  APPROVED: { bg: '#dcfce7', text: '#16a34a' },
  PAID: { bg: '#d1fae5', text: '#059669' },
  POSTED: { bg: '#e0e7ff', text: '#4f46e5' },
  FINALIZED: { bg: '#f0fdf4', text: '#15803d' },
  CANCELLED: { bg: '#fef2f2', text: '#dc2626' },
  FAILED: { bg: '#fef2f2', text: '#dc2626' },
};

const RECON_COLORS: Record<string, { bg: string; text: string }> = {
  PASS: { bg: '#f0fdf4', text: '#16a34a' },
  WARNING: { bg: '#fffbeb', text: '#d97706' },
  FAIL: { bg: '#fef2f2', text: '#dc2626' },
  NOT_RUN: { bg: '#f1f5f9', text: '#94a3b8' },
};

const COMP_COLORS: Record<string, { bg: string; text: string }> = {
  Submitted: { bg: '#f0fdf4', text: '#16a34a' },
  Ready: { bg: '#eff6ff', text: '#2563eb' },
  Pending: { bg: '#fffbeb', text: '#d97706' },
  None: { bg: '#f1f5f9', text: '#94a3b8' },
  GENERATED: { bg: '#eff6ff', text: '#2563eb' },
  SUBMITTED: { bg: '#f0fdf4', text: '#16a34a' },
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
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PayrollRunCenter() {
  const navigate = useNavigate();
  const { can } = useAccess();

  const [summary, setSummary] = useState<any>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [payruns, setPayruns] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any[]>([]);
  const [compliance, setCompliance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sumRes, perRes, altRes, prRes, payRes, recRes, compRes] = await Promise.all([
        api.get('/run-center/summary').catch(() => ({ data: null })),
        api.get('/run-center/periods').catch(() => ({ data: { items: [] } })),
        api.get('/run-center/alerts').catch(() => ({ data: { items: [] } })),
        api.get('/run-center/payruns').catch(() => ({ data: { items: [] } })),
        api.get('/run-center/payments').catch(() => ({ data: { items: [] } })),
        api.get('/run-center/reconciliation').catch(() => ({ data: { items: [] } })),
        api.get('/run-center/compliance').catch(() => ({ data: { items: [] } })),
      ]);
      setSummary(sumRes.data);
      setPeriods(perRes.data?.items ?? []);
      setAlerts(altRes.data?.items ?? []);
      setPayruns(prRes.data?.items ?? []);
      setPayments(payRes.data?.items ?? []);
      setReconciliation(recRes.data?.items ?? []);
      setCompliance(compRes.data?.items ?? []);
    } catch (err: any) {
      const code = err?.response?.data?.code ?? '';
      if (code === 'PAYROLL_LEGAL_ENTITY_REQUIRED') {
        // Silently show empty state — run center sub-sections already handle individual failures
      } else {
        setError('Failed to load Run Center data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  if (loading) {
    return (
      <Page title="Run Center">
        <div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div>
        <style>{styles.spinKeyframes}</style>
      </Page>
    );
  }

  const s = summary ?? {};

  return (
    <Page
      title="Payroll Control Tower"
      subtitle="Unified operational cockpit — payruns, exceptions, payments, reconciliation, compliance."
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          {can('payrun:create') && (
            <button style={styles.buttonPrimary} onClick={() => navigate('/payroll/payruns/new')}>Create Payrun</button>
          )}
          <button style={styles.buttonSecondary} onClick={loadAll}>Refresh</button>
        </div>
      }
    >
      {error && <Banner variant="error">{error}</Banner>}

      {/* ── 0. Payroll Readiness ── */}
      <PayrollReadinessCard />

      {/* ── 1. Operational Summary Cards ── */}
      <Grid cols="1fr 1fr 1fr 1fr 1fr 1fr" gap={12}>
        <SummaryCard label="Active Payruns" value={s.activePayruns ?? 0} link="/payroll/payruns" />
        <SummaryCard label="Blocked Payruns" value={s.blockedPayruns ?? 0} color={s.blockedPayruns > 0 ? '#dc2626' : undefined} link="/payroll/exceptions" />
        <SummaryCard label="Payments Pending" value={s.paymentsPending ?? 0} color={s.paymentsPending > 0 ? '#d97706' : undefined} link="/payroll/payment-batches" />
        <SummaryCard label="Recon Issues" value={s.reconciliationIssues ?? 0} color={s.reconciliationIssues > 0 ? '#d97706' : undefined} link="/payroll/reconciliation" />
        <SummaryCard label="Compliance Pending" value={s.compliancePending ?? 0} color={s.compliancePending > 0 ? '#d97706' : undefined} link="/payroll/compliance" />
        <SummaryCard label="Checklist Tasks Open" value={s.checklistTasksOpen ?? 0} link="/payroll/checklist" />
      </Grid>

      {/* ── 2. Critical Alerts ── */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader title="Critical Alerts" right={<span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{alerts.length} alert(s)</span>} />
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {alerts.map((a: any, i: number) => (
              <div key={i} style={{ padding: '10px 16px', borderBottom: i < alerts.length - 1 ? `1px solid ${styles.colors.borderLight}` : undefined, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: 99, marginTop: 6, flexShrink: 0, background: a.severity === 'critical' ? '#dc2626' : '#d97706' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{a.description}</div>
                  {a.employeeName && <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Employee: {a.employeeName}</div>}
                  {a.payrunName && <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Payrun: {a.payrunName}</div>}
                </div>
                {a.link && <Link to={a.link} style={{ fontSize: 11, color: styles.colors.primary, textDecoration: 'none', whiteSpace: 'nowrap' }}>View →</Link>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── 3. Current Period Status ── */}
      {periods.length > 0 && (
        <Card>
          <CardHeader title="Current Period Status" right={<Link to="/payroll/calendars" style={{ fontSize: 12, color: styles.colors.primary, textDecoration: 'none' }}>All Calendars →</Link>} />
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Calendar</th>
                <th style={styles.tableHeaderCell}>Period</th>
                <th style={styles.tableHeaderCell}>Payrun</th>
                <th style={styles.tableHeaderCell}>Checklist</th>
                <th style={styles.tableHeaderCell}>Payment</th>
                <th style={styles.tableHeaderCell}>Reconciliation</th>
                <th style={styles.tableHeaderCell}>Compliance</th>
              </tr></thead>
              <tbody>
                {periods.map((p: any) => (
                  <tr key={p.calendarId} style={styles.tableRow}>
                    <td style={styles.tableCell}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{p.calendarName}</div>
                      <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{p.legalEntity} · {p.country}</div>
                    </td>
                    <td style={styles.tableCell}>
                      <div style={{ fontSize: 13 }}>{p.periodName}</div>
                      <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}</div>
                    </td>
                    <td style={styles.tableCell}>
                      {p.payrunId ? (
                        <Link to={`/payroll/payruns/${p.payrunId}`} style={{ textDecoration: 'none' }}>
                          <Chip label={p.payrunStatus} colors={STATUS_COLORS[p.payrunStatus]} />
                        </Link>
                      ) : <Chip label="No Payrun" />}
                    </td>
                    <td style={styles.tableCell}>
                      {p.checklistPct != null ? (
                        <Link to="/payroll/checklist" style={{ textDecoration: 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 48, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${p.checklistPct}%`, height: '100%', background: p.checklistPct === 100 ? '#16a34a' : '#3b82f6', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600 }}>{p.checklistPct}%</span>
                          </div>
                        </Link>
                      ) : <span style={{ fontSize: 11, color: styles.colors.textMuted }}>—</span>}
                    </td>
                    <td style={styles.tableCell}><Link to="/payroll/payment-batches" style={{ textDecoration: 'none' }}><Chip label={p.paymentStatus} colors={pmtColor(p.paymentStatus)} /></Link></td>
                    <td style={styles.tableCell}><Link to="/payroll/reconciliation" style={{ textDecoration: 'none' }}><Chip label={p.reconciliationStatus} colors={RECON_COLORS[p.reconciliationStatus] ?? RECON_COLORS.NOT_RUN} /></Link></td>
                    <td style={styles.tableCell}><Link to="/payroll/compliance" style={{ textDecoration: 'none' }}><Chip label={p.complianceStatus} colors={COMP_COLORS[p.complianceStatus] ?? COMP_COLORS.Pending} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── 4. Payroll Runs ── */}
      <Card>
        <CardHeader title="Active Payroll Runs" right={<Link to="/payroll/payruns" style={{ fontSize: 12, color: styles.colors.primary, textDecoration: 'none' }}>All Payruns →</Link>} />
        {payruns.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: styles.colors.textMuted }}>
            No active payruns.
            {can('payrun:create') && <div style={{ marginTop: 12 }}><button style={styles.buttonPrimary} onClick={() => navigate('/payroll/payruns/new')}>Create Payrun</button></div>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Payrun</th>
                <th style={styles.tableHeaderCell}>Period</th>
                <th style={styles.tableHeaderCell}>Status</th>
                <th style={styles.tableHeaderCell}>Exceptions</th>
                <th style={styles.tableHeaderCell}>Payment</th>
                <th style={styles.tableHeaderCell}>Reconciliation</th>
                <th style={styles.tableHeaderCell}>Compliance</th>
                <th style={styles.tableHeaderCell}>Action</th>
              </tr></thead>
              <tbody>
                {payruns.map((pr: any) => (
                  <tr key={pr.id} style={{ ...styles.tableRow, cursor: 'pointer' }} onClick={() => navigate(`/payroll/payruns/${pr.id}`)}>
                    <td style={styles.tableCell}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{pr.payGroupName ?? 'Payrun'}</div>
                      <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{pr.legalEntity ?? ''} · {pr.country ?? ''}</div>
                    </td>
                    <td style={styles.tableCell}><span style={{ fontSize: 12 }}>{fmtDate(pr.periodStart)} – {fmtDate(pr.periodEnd)}</span></td>
                    <td style={styles.tableCell}><Chip label={pr.status} colors={STATUS_COLORS[pr.status]} /></td>
                    <td style={styles.tableCell}>
                      {pr.exceptionCount > 0 ? (
                        <Link to={`/payroll/payruns/${pr.id}?tab=exceptions`} style={{ textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: pr.criticalExceptions > 0 ? '#dc2626' : '#d97706' }}>
                            {pr.exceptionCount}{pr.criticalExceptions > 0 ? ` (${pr.criticalExceptions} critical)` : ''}
                          </span>
                        </Link>
                      ) : <span style={{ fontSize: 11, color: '#16a34a' }}>None</span>}
                    </td>
                    <td style={styles.tableCell}>
                      {pr.paymentBatchId ? (
                        <Link to={`/payroll/payment-batches/${pr.paymentBatchId}`} style={{ textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                          <Chip label={pr.paymentStatus} colors={pmtColor(pr.paymentStatus)} />
                        </Link>
                      ) : <Chip label="No Batch" />}
                    </td>
                    <td style={styles.tableCell}><Chip label={pr.reconciliationStatus} colors={RECON_COLORS[pr.reconciliationStatus] ?? RECON_COLORS.NOT_RUN} /></td>
                    <td style={styles.tableCell}><Chip label={pr.complianceStatus} colors={COMP_COLORS[pr.complianceStatus] ?? COMP_COLORS.None} /></td>
                    <td style={styles.tableCell}>
                      <Link to={`/payroll/payruns/${pr.id}`} style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 11, padding: '3px 8px' }} onClick={e => e.stopPropagation()}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── 5. Payment Pipeline ── */}
      {payments.length > 0 && (
        <Card>
          <CardHeader title="Payment Pipeline" right={<Link to="/payroll/payment-batches" style={{ fontSize: 12, color: styles.colors.primary, textDecoration: 'none' }}>All Batches →</Link>} />
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Batch</th>
                <th style={styles.tableHeaderCell}>Payrun</th>
                <th style={styles.tableHeaderCell}>Employees</th>
                <th style={{ ...styles.tableHeaderCell, textAlign: 'right' as const }}>Amount</th>
                <th style={styles.tableHeaderCell}>Export</th>
                <th style={styles.tableHeaderCell}>Status</th>
              </tr></thead>
              <tbody>
                {payments.map((b: any) => (
                  <tr key={b.id} style={{ ...styles.tableRow, cursor: 'pointer' }} onClick={() => navigate(`/payroll/payment-batches/${b.id}`)}>
                    <td style={styles.tableCell}><span style={{ fontWeight: 500, fontSize: 12 }}>{b.reference}</span></td>
                    <td style={styles.tableCell}>{b.payrunName ? <Link to={`/payroll/payruns/${b.payrunId}`} style={{ color: styles.colors.primary, textDecoration: 'none', fontSize: 12 }} onClick={e => e.stopPropagation()}>{b.payrunName}</Link> : '—'}</td>
                    <td style={styles.tableCell}>{b.employeeCount}</td>
                    <td style={{ ...styles.tableCell, textAlign: 'right' as const, fontWeight: 600 }}>{fmt(b.totalAmount)}</td>
                    <td style={styles.tableCell}><Chip label={b.exportStatus} colors={b.exportStatus === 'Generated' ? { bg: '#f0fdf4', text: '#16a34a' } : { bg: '#f1f5f9', text: '#94a3b8' }} /></td>
                    <td style={styles.tableCell}><Chip label={b.status} colors={pmtColor(b.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── 6. Reconciliation Status ── */}
      {reconciliation.length > 0 && (
        <Card>
          <CardHeader title="Reconciliation Status" right={<Link to="/payroll/reconciliation" style={{ fontSize: 12, color: styles.colors.primary, textDecoration: 'none' }}>Full Reconciliation →</Link>} />
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Payrun</th>
                <th style={styles.tableHeaderCell}>Status</th>
                <th style={styles.tableHeaderCell}>Result</th>
                <th style={styles.tableHeaderCell}>Checks</th>
                <th style={styles.tableHeaderCell}>Reviewed</th>
                <th style={styles.tableHeaderCell}>Action</th>
              </tr></thead>
              <tbody>
                {reconciliation.map((r: any) => (
                  <tr key={r.payrunId} style={styles.tableRow}>
                    <td style={styles.tableCell}><Link to={`/payroll/payruns/${r.payrunId}`} style={{ color: styles.colors.primary, textDecoration: 'none', fontWeight: 500, fontSize: 13 }}>{r.payrunName}</Link></td>
                    <td style={styles.tableCell}><Chip label={r.status} colors={STATUS_COLORS[r.status]} /></td>
                    <td style={styles.tableCell}><Chip label={r.overallResult} colors={RECON_COLORS[r.overallResult] ?? RECON_COLORS.NOT_RUN} /></td>
                    <td style={styles.tableCell}><span style={{ fontSize: 12 }}>{r.passChecks}P / {r.warningChecks}W / {r.failedChecks}F</span></td>
                    <td style={styles.tableCell}><span style={{ fontSize: 11, color: r.reviewed ? '#16a34a' : styles.colors.textMuted }}>{r.reviewed ? 'Yes' : 'No'}</span></td>
                    <td style={styles.tableCell}><Link to={`/payroll/payruns/${r.payrunId}`} style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 11, padding: '3px 8px' }}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── 7. Compliance Status ── */}
      {compliance.length > 0 && (
        <Card>
          <CardHeader title="Compliance Status" right={<Link to="/payroll/compliance" style={{ fontSize: 12, color: styles.colors.primary, textDecoration: 'none' }}>Full Compliance →</Link>} />
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Report</th>
                <th style={styles.tableHeaderCell}>Country</th>
                <th style={styles.tableHeaderCell}>Period</th>
                <th style={styles.tableHeaderCell}>Status</th>
                <th style={styles.tableHeaderCell}>Submission</th>
                <th style={styles.tableHeaderCell}>Action</th>
              </tr></thead>
              <tbody>
                {compliance.map((c: any) => (
                  <tr key={c.id} style={styles.tableRow}>
                    <td style={styles.tableCell}><span style={{ fontWeight: 500, fontSize: 13 }}>{c.reportType}</span></td>
                    <td style={styles.tableCell}>{c.countryCode}</td>
                    <td style={styles.tableCell}>{c.periodName ?? '—'}</td>
                    <td style={styles.tableCell}><Chip label={c.status} colors={COMP_COLORS[c.status] ?? COMP_COLORS.Pending} /></td>
                    <td style={styles.tableCell}><Chip label={c.submissionStatus ?? 'NOT_SUBMITTED'} colors={subColor(c.submissionStatus)} /></td>
                    <td style={styles.tableCell}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Link to="/payroll/compliance" style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 11, padding: '3px 8px' }}>View</Link>
                        {c.payrunId && <Link to={`/payroll/payruns/${c.payrunId}`} style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 11, padding: '3px 8px' }}>Payrun</Link>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}

function SummaryCard({ label, value, color, link }: { label: string; value: number; color?: string; link?: string }) {
  const inner = (
    <Card>
      <div style={{ fontSize: 11, color: styles.colors.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? styles.colors.textPrimary }}>{value}</div>
    </Card>
  );
  if (link) return <Link to={link} style={{ textDecoration: 'none' }}>{inner}</Link>;
  return inner;
}

function pmtColor(status: string): { bg: string; text: string } {
  const m: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: '#f1f5f9', text: '#475569' },
    GENERATED: { bg: '#eff6ff', text: '#2563eb' },
    SUBMITTED: { bg: '#fffbeb', text: '#d97706' },
    PROCESSED: { bg: '#f0fdf4', text: '#16a34a' },
    CONFIRMED_PAID: { bg: '#f0fdf4', text: '#059669' },
    FAILED: { bg: '#fef2f2', text: '#dc2626' },
    'No Batch': { bg: '#f1f5f9', text: '#94a3b8' },
    'Batch Created': { bg: '#eff6ff', text: '#2563eb' },
    'Exported': { bg: '#fffbeb', text: '#d97706' },
  };
  return m[status] ?? { bg: '#f1f5f9', text: '#475569' };
}

function subColor(status: string): { bg: string; text: string } {
  const m: Record<string, { bg: string; text: string }> = {
    NOT_SUBMITTED: { bg: '#f1f5f9', text: '#94a3b8' },
    SUBMITTED: { bg: '#f0fdf4', text: '#16a34a' },
    ACCEPTED: { bg: '#f0fdf4', text: '#059669' },
    REJECTED: { bg: '#fef2f2', text: '#dc2626' },
  };
  return m[status] ?? { bg: '#f1f5f9', text: '#94a3b8' };
}
