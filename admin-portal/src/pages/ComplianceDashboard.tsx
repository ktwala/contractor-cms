import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner } from '../ui/layout';
import { classifyError } from '../utils/pageState';
import { PageBlockedView, PageErrorView } from '../ui/PageStateViews';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';

interface FilingCalendarEntry {
  return_id?: string;
  country_code: string;
  return_code: string;
  return_label: string;
  period_key: string;
  status: string;
  total_due: number;
  currency: string;
  filing_due_date: string;
  filing_authority: string;
  days_until_due: number;
  is_overdue: boolean;
}

interface ExposureSummary {
  total_statutory_liability: number;
  currency: string;
  by_item: Array<{ item_code: string; item_label: string; total: number }>;
  by_country: Array<{ country_code: string; total: number; currency: string }>;
}

interface WorkflowAlert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  return_id: string;
  return_code: string;
  country_code: string;
  period_key: string;
  days_until_due?: number;
}

interface DashboardData {
  filing_calendar: FilingCalendarEntry[];
  exposure: ExposureSummary;
  workflow_alerts: WorkflowAlert[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#f1f5f9', text: '#475569' },
  under_review: { bg: '#fef3c7', text: '#d97706' },
  approved: { bg: '#dbeafe', text: '#2563eb' },
  submitted: { bg: '#e0e7ff', text: '#4338ca' },
  acknowledged: { bg: '#f0fdf4', text: '#16a34a' },
  amended: { bg: '#fef3c7', text: '#b45309' },
  cancelled: { bg: '#fef2f2', text: '#dc2626' },
  not_generated: { bg: '#f1f5f9', text: '#94a3b8' },
};

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  critical: { bg: '#fef2f2', border: '#fca5a5', icon: '🔴' },
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: '🟡' },
  info: { bg: '#eff6ff', border: '#93c5fd', icon: '🔵' },
};

function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: c.bg, color: c.text, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function DaysChip({ days, isOverdue }: { days: number; isOverdue: boolean }) {
  if (isOverdue) {
    return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#fef2f2', color: '#dc2626' }}>{Math.abs(days)}d overdue</span>;
  }
  if (days <= 5) {
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#fef3c7', color: '#d97706' }}>{days}d left</span>;
  }
  return <span style={{ fontSize: 11, color: styles.colors.textMuted }}>{days}d left</span>;
}

export default function ComplianceDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const res = await api.get('/payroll/statutory/dashboard');
        setData(res.data?.data ?? null);
      } catch (err) {
        setLoadError(err);
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => { load(); }, []);

  const loadState = loadError ? classifyError(loadError) : null;
  usePageStateTelemetry('enterprise.complianceDashboard', 'enterprise', loadState ?? { kind: 'ready' });

  if (loading) {
    return <Page title="Compliance Dashboard"><div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div><style>{styles.spinKeyframes}</style></Page>;
  }

  if (loadError) {
    const state = classifyError(loadError);
    if (state.kind === 'blocked') {
      return <Page title="Compliance Dashboard"><PageBlockedView code={state.code} message={state.message} page="enterprise.complianceDashboard" module="enterprise" /></Page>;
    }
    return <Page title="Compliance Dashboard"><PageErrorView message={state.kind === 'error' ? state.message : 'An unexpected error occurred'} retryable={state.kind === 'error' ? state.retryable : false} onRetry={load} page="enterprise.complianceDashboard" module="enterprise" /></Page>;
  }

  if (!data) {
    return <Page title="Compliance Dashboard"><Banner variant="error">No compliance data available yet.</Banner></Page>;
  }

  const criticalAlerts = data.workflow_alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = data.workflow_alerts.filter((a) => a.severity === 'warning');
  const infoAlerts = data.workflow_alerts.filter((a) => a.severity === 'info');

  const summaryCardStyle: React.CSSProperties = {
    padding: 20, background: '#fff', borderRadius: 12,
    border: `1px solid ${styles.colors.border}`, textAlign: 'center',
  };

  return (
    <Page
      title="Compliance Dashboard"
      subtitle="Statutory filing status, exposure, and workflow alerts across all countries."
      actions={
        <Link to="/payroll/statutory-returns" style={{ ...styles.buttonPrimary, textDecoration: 'none' }}>
          View All Returns
        </Link>
      }
    >
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={summaryCardStyle}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb' }}>
            {fmtCurrency(data.exposure.total_statutory_liability, data.exposure.currency)}
          </div>
          <div style={{ fontSize: 12, color: styles.colors.textMuted, marginTop: 4 }}>Total Statutory Liability</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={{ fontSize: 28, fontWeight: 700, color: data.filing_calendar.length > 0 ? '#16a34a' : '#94a3b8' }}>
            {data.filing_calendar.length}
          </div>
          <div style={{ fontSize: 12, color: styles.colors.textMuted, marginTop: 4 }}>Active Filings</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={{ fontSize: 28, fontWeight: 700, color: criticalAlerts.length > 0 ? '#dc2626' : '#16a34a' }}>
            {criticalAlerts.length}
          </div>
          <div style={{ fontSize: 12, color: styles.colors.textMuted, marginTop: 4 }}>Critical Alerts</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={{ fontSize: 28, fontWeight: 700, color: warningAlerts.length > 0 ? '#d97706' : '#16a34a' }}>
            {warningAlerts.length}
          </div>
          <div style={{ fontSize: 12, color: styles.colors.textMuted, marginTop: 4 }}>Warnings</div>
        </div>
      </div>

      {/* Workflow Alerts */}
      {data.workflow_alerts.length > 0 && (
        <Card>
          <CardHeader title="Workflow Alerts" right={<span style={{ fontSize: 12, color: styles.colors.textMuted }}>{data.workflow_alerts.length} alert(s)</span>} />
          <div style={{ padding: '4px 16px 12px' }}>
            {data.workflow_alerts.map((alert, i) => {
              const sev = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', marginBottom: 6, borderRadius: 8, background: sev.bg, border: `1px solid ${sev.border}` }}>
                  <span style={{ fontSize: 14 }}>{sev.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{alert.message}</div>
                    <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{alert.country_code} · {alert.return_code}</div>
                  </div>
                  {alert.return_id && (
                    <Link to={`/payroll/statutory-returns/${alert.return_id}`} style={{ fontSize: 12, color: styles.colors.primary, textDecoration: 'none', fontWeight: 500 }}>
                      View
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filing Calendar */}
      <Card>
        <CardHeader title="Filing Calendar" />
        {data.filing_calendar.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: styles.colors.textMuted, fontSize: 13 }}>
            No filings found. Generate statutory returns from a payrun to populate the calendar.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px' }}>Country</th>
                  <th style={{ padding: '10px 16px' }}>Return</th>
                  <th style={{ padding: '10px 16px' }}>Period</th>
                  <th style={{ padding: '10px 16px' }}>Status</th>
                  <th style={{ padding: '10px 16px' }}>Authority</th>
                  <th style={{ padding: '10px 16px' }}>Due Date</th>
                  <th style={{ padding: '10px 16px' }}>Time Left</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Total Due</th>
                </tr>
              </thead>
              <tbody>
                {data.filing_calendar.map((entry, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      background: entry.is_overdue ? '#fef2f2' : undefined,
                      cursor: entry.return_id ? 'pointer' : undefined,
                    }}
                    onClick={() => {
                      if (entry.return_id) window.location.href = `/payroll/statutory-returns/${entry.return_id}`;
                    }}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: entry.country_code === 'ZA' ? '#dbeafe' : '#f0fdf4', color: entry.country_code === 'ZA' ? '#1d4ed8' : '#15803d' }}>
                        {entry.country_code}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{entry.return_code}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{entry.period_key}</td>
                    <td style={{ padding: '10px 16px' }}><StatusChip status={entry.status} /></td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: styles.colors.textMuted }}>{entry.filing_authority}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>{fmtDate(entry.filing_due_date)}</td>
                    <td style={{ padding: '10px 16px' }}><DaysChip days={entry.days_until_due} isOverdue={entry.is_overdue} /></td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtCurrency(entry.total_due, entry.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Exposure Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <CardHeader title="Exposure by Item" />
          <div style={{ padding: '8px 16px' }}>
            {data.exposure.by_item.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: styles.colors.textMuted, fontSize: 13 }}>No items</div>
            ) : (
              data.exposure.by_item.map((item) => (
                <div key={item.item_code} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
                  <div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#f1f5f9', color: '#475569', fontWeight: 600, marginRight: 8 }}>{item.item_code}</span>
                    {item.item_label}
                  </div>
                  <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCurrency(item.total, data.exposure.currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Exposure by Country" />
          <div style={{ padding: '8px 16px' }}>
            {data.exposure.by_country.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: styles.colors.textMuted, fontSize: 13 }}>No data</div>
            ) : (
              data.exposure.by_country.map((c) => (
                <div key={c.country_code} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8fafc', fontSize: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 6, background: c.country_code === 'ZA' ? '#dbeafe' : '#f0fdf4', color: c.country_code === 'ZA' ? '#1d4ed8' : '#15803d' }}>
                    {c.country_code}
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCurrency(c.total, c.currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </Page>
  );
}
