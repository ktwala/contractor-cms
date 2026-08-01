import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import { Page, Card, CardHeader, Banner, EmptyState, Stack } from '../ui/layout';
import { fetchHrExportStats, fetchWorkforceIssues } from '../features/workforce-stats/api';
import { StatCard, StatStrip } from '../features/workforce-stats/components/StatCard';
import { ReadinessBadge, ReadinessBar } from '../features/workforce-stats/components/ReadinessBadge';
import { IssueBadge } from '../features/workforce-stats/components/IssueBadge';
import { IssueDrilldownDrawer } from '../features/workforce-stats/components/IssueDrilldownDrawer';
import { useIssueDrilldown } from '../features/workforce-stats/hooks/useIssueDrilldown';
import { getRemediationRoute, ISSUE_TYPE_LABELS } from '../features/workforce-stats/remediation-routes';

interface HrEmployee {
  employee_id: string;
  employee_no: string;
  first_name: string;
  last_name: string;
  status: string;
  updated_at: string;
  manager_employee_no?: string | null;
  current_employment?: {
    employment_id: string;
    legal_entity_id: string;
    pay_group_id: string;
    effective_from: string;
    effective_to?: string | null;
    updated_at?: string;
  } | null;
}

export default function HrExportValidation() {
  const { can } = useAccess();
  const hasHrRead = can('hr:read');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [items, setItems] = useState<HrEmployee[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [changedSince, setChangedSince] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 16);
  });
  const [showRaw, setShowRaw] = useState(false);
  const navigate = useNavigate();
  const [exportStats, setExportStats] = useState<any>(null);
  const [blockerIssues, setBlockerIssues] = useState<any[]>([]);
  const { drilldownState, openDrilldown, closeDrilldown } = useIssueDrilldown();

  useEffect(() => {
    fetchHrExportStats().then(setExportStats).catch(() => {});
    fetchWorkforceIssues({ entityType: 'HR_EXPORT', blocksExport: 'true', resolved: 'false', limit: '20' })
      .then((d: any) => setBlockerIssues(d?.items ?? []))
      .catch(() => {});
  }, []);

  const fetchPayload = useCallback(async () => {
    if (!hasHrRead) {
      setForbidden(true);
      return;
    }
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const params = new URLSearchParams();
      if (changedSince) params.set('changed_since', new Date(changedSince).toISOString());
      params.set('limit', '100');
      params.set('include', 'current_employment,manager');
      const res = await api.get(`/hr/employees?${params.toString()}`);
      setRawResponse(res.data);
      setItems(res.data?.items ?? []);
      setAsOf(res.data?.as_of ?? null);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      if (err?.response?.status === 403) {
        setForbidden(true);
        setError(null);
      } else {
        setForbidden(false);
        setError(err?.response?.data?.message ?? 'Failed to fetch HR export');
      }
      setRawResponse(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [hasHrRead, changedSince]);

  useEffect(() => {
    fetchPayload();
  }, [fetchPayload]);

  if (!hasHrRead && !loading) {
    return (
      <Page
        title="HR Export (IGA Preview)"
        subtitle="Preview the IGA-ready employee payload"
      >
        <EmptyState
          title="You need hr:read permission"
          description={
            <span>
              You need <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>hr:read</code> to view this page.
              {' '}Log in as <strong>tenantadmin@demo.payroll</strong> or <strong>iga@demo.payroll</strong> to see the IGA-ready export preview.
            </span>
          }
        />
      </Page>
    );
  }

  return (
    <Page
      title="HR Export (IGA Preview)"
      subtitle={
        <>
          Preview the <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>/v1/hr/employees?changed_since=...</code> payload. This is the authoritative source feeding IGA.
        </>
      }
    >
      <Stack gap={16}>
        {/* Export Readiness Summary */}
        {exportStats && (
          <>
            <StatStrip columns={4}>
              <StatCard
                label="Export Ready"
                value={exportStats.exportReady}
                subtitle={`of ${exportStats.totalActiveEmployees} active`}
                color="#22c55e"
              />
              <StatCard
                label="Blocked"
                value={exportStats.exportBlocked}
                color={exportStats.exportBlocked > 0 ? '#ef4444' : '#94a3b8'}
                onClick={exportStats.exportBlocked > 0 ? () => openDrilldown({
                  issueType: 'EMPLOYEE_EXPORT_BLOCKED',
                  title: 'Export blocked employees',
                  groupBy: 'legalEntity',
                }) : undefined}
              />
              <StatCard
                label="Readiness"
                value={`${exportStats.readinessPercent}%`}
                color={exportStats.readinessPercent >= 90 ? '#22c55e' : exportStats.readinessPercent >= 70 ? '#f59e0b' : '#ef4444'}
                badge={
                  <ReadinessBadge
                    status={exportStats.readinessPercent >= 90 ? 'READY' : exportStats.readinessPercent >= 70 ? 'WARNING' : 'BLOCKED'}
                  />
                }
              />
              <StatCard
                label="Active Employees"
                value={exportStats.totalActiveEmployees}
                color="#6366f1"
              />
            </StatStrip>

            {/* Blocker breakdown */}
            {blockerIssues.length > 0 && (
              <Card>
                <CardHeader
                  title="Export Blockers"
                  subtitle={`${blockerIssues.length} employee(s) blocked from IGA export`}
                  right={<IssueBadge count={blockerIssues.length} severity="error" label="blockers" />}
                />
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeader}>
                        <th style={styles.tableHeaderCell}>Employee</th>
                        <th style={styles.tableHeaderCell}>Issue</th>
                        <th style={styles.tableHeaderCell}>Severity</th>
                        <th style={styles.tableHeaderCell}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockerIssues.map((issue: any) => (
                        <tr key={issue.id} style={styles.tableRow}>
                          <td style={{ ...styles.tableCell, fontWeight: 500 }}>{issue.title?.split('(')[0]?.trim() || '—'}</td>
                          <td style={{ ...styles.tableCell, fontSize: 12, color: '#64748b' }}>{issue.title}</td>
                          <td style={styles.tableCell}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              background: issue.severity === 'ERROR' ? '#fee2e2' : issue.severity === 'CRITICAL' ? '#fee2e2' : '#fef9c3',
                              color: issue.severity === 'ERROR' || issue.severity === 'CRITICAL' ? '#991b1b' : '#854d0e',
                            }}>
                              {issue.severity}
                            </span>
                          </td>
                          <td style={styles.tableCell}>
                            {issue.recommendedAction ? (
                              <button
                                onClick={() => {
                                  const route = getRemediationRoute(issue.issueType, issue.recommendedAction?.params);
                                  navigate(route);
                                }}
                                style={{
                                  padding: '4px 10px', borderRadius: 6, border: '1px solid #6366f1',
                                  background: '#eef2ff', color: '#4338ca', fontSize: 11, fontWeight: 600,
                                  cursor: 'pointer', whiteSpace: 'nowrap',
                                }}
                              >
                                {issue.recommendedAction.label}
                              </button>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}

        <Card>
          <CardHeader title="Query" subtitle="Employees or employments updated after this time. Leave empty for full list." />
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={styles.formLabel}>changed_since (ISO)</label>
              <input
                type="datetime-local"
                style={{ ...styles.formInput, fontFamily: 'monospace' }}
                value={changedSince}
                onChange={(e) => setChangedSince(e.target.value || '')}
              />
            </div>
            <button style={styles.buttonPrimary} onClick={fetchPayload} disabled={loading} type="button">
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </Card>

        {forbidden && <Banner variant="error">403 — Permission denied. Need hr:read.</Banner>}
        {error && !forbidden && <Banner variant="error">{error}</Banner>}

        {!forbidden && !error && (
          <Card>
            <CardHeader
              title="Export preview"
              subtitle={asOf ? `as_of: ${new Date(asOf).toISOString()}` : undefined}
              right={
                <button style={styles.buttonSecondary} onClick={() => setShowRaw((p) => !p)} type="button">
                  {showRaw ? 'Hide JSON' : 'Show raw JSON'}
                </button>
              }
            />

            {showRaw && rawResponse != null && (
              <pre
                style={{
                  background: '#1e293b',
                  color: '#e2e8f0',
                  padding: 16,
                  borderRadius: 8,
                  overflow: 'auto',
                  maxHeight: 400,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {JSON.stringify(rawResponse, null, 2)}
              </pre>
            )}

            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.tableHeaderCell}>employee_no</th>
                  <th style={styles.tableHeaderCell}>updated_at</th>
                  <th style={styles.tableHeaderCell}>manager_employee_no</th>
                  <th style={styles.tableHeaderCell}>effective_from</th>
                  <th style={styles.tableHeaderCell}>effective_to</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: styles.colors.textMuted }}>
                      No employees in delta (or full list empty).
                    </td>
                  </tr>
                ) : (
                  items.map((emp) => {
                    const empData = emp.current_employment;
                    return (
                      <tr key={emp.employee_id} style={styles.tableRow}>
                        <td style={{ ...styles.tableCell, fontFamily: 'monospace' }}>{emp.employee_no}</td>
                        <td style={styles.tableCell}>{emp.updated_at ? new Date(emp.updated_at).toLocaleString() : '—'}</td>
                        <td style={{ ...styles.tableCell, fontFamily: 'monospace' }}>{emp.manager_employee_no ?? '—'}</td>
                        <td style={styles.tableCell}>{empData?.effective_from ? new Date(empData.effective_from).toLocaleDateString() : '—'}</td>
                        <td style={styles.tableCell}>{empData?.effective_to ? new Date(empData.effective_to).toLocaleDateString() : 'Current'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <p style={{ color: styles.colors.textMuted, fontSize: 13, marginTop: 16, marginBottom: 0 }}>
              {items.length} row(s). Use this payload to verify IGA sync — joiner, mover, leaver, rehire, manager change.
            </p>
          </Card>
        )}
      </Stack>

      <IssueDrilldownDrawer
        open={drilldownState.open}
        onClose={closeDrilldown}
        issueType={drilldownState.issueType}
        title={drilldownState.title}
        groupBy={drilldownState.groupBy}
        onRefreshNeeded={() => {
          fetchHrExportStats().then(setExportStats).catch(() => {});
          fetchWorkforceIssues({ entityType: 'HR_EXPORT', blocksExport: 'true', resolved: 'false', limit: '20' })
            .then((d: any) => setBlockerIssues(d?.items ?? []))
            .catch(() => {});
        }}
      />
    </Page>
  );
}
