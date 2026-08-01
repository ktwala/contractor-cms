import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as styles from '../styles/common';
import { Page, Card, CardHeader } from '../ui/layout';
import {
  fetchRemediationQueue, fetchQueueStats, triggerIssueDetection,
  triggerStatsRefresh, assignIssue, unassignIssue, fetchUsers,
} from '../features/workforce-stats/api';
import { ISSUE_TYPE_LABELS, getRemediationRoute } from '../features/workforce-stats/remediation-routes';
import { IssueDrilldownDrawer } from '../features/workforce-stats/components/IssueDrilldownDrawer';
import { useIssueDrilldown } from '../features/workforce-stats/hooks/useIssueDrilldown';

type Tab = 'all' | 'blockers' | 'managers' | 'assignments' | 'employments';

const TABS: { key: Tab; label: string; filter: Record<string, string> }[] = [
  { key: 'all', label: 'All Issues', filter: {} },
  { key: 'blockers', label: 'Export Blockers', filter: { blocksExport: 'true' } },
  { key: 'managers', label: 'Missing Managers', filter: { issueType: 'MISSING_MANAGER' } },
  { key: 'assignments', label: 'Assignments', filter: {} },
  { key: 'employments', label: 'Employments', filter: {} },
];

const ASSIGNMENT_ISSUE_TYPES = new Set(['MISSING_ORG_ASSIGNMENT', 'MISSING_COST_CENTER', 'EMPLOYEE_WITHOUT_ASSIGNMENT']);
const EMPLOYMENT_ISSUE_TYPES = new Set(['EMPLOYEE_WITHOUT_EMPLOYMENT', 'MISSING_LEGAL_ENTITY']);

export default function RemediationQueue() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { drilldownState, openDrilldown, closeDrilldown } = useIssueDrilldown();

  const [queueStats, setQueueStats] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recheckRunning, setRecheckRunning] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [legalEntityFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [sortBy, setSortBy] = useState('priority');

  const loadStats = useCallback(async () => {
    try { setQueueStats(await fetchQueueStats()); } catch { /* ignore */ }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchUsers();
      setUsers(Array.isArray(data) ? data : data?.items ?? []);
    } catch { /* ignore */ }
  }, []);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { sortBy, limit: '200' };
      const tabConfig = TABS.find((t) => t.key === activeTab);
      if (tabConfig) Object.assign(params, tabConfig.filter);
      if (legalEntityFilter) params.legalEntityId = legalEntityFilter;
      if (severityFilter) params.severity = severityFilter;
      if (assignedFilter) params.assignedUserId = assignedFilter;

      const data = await fetchRemediationQueue(params);
      let items = data?.items ?? [];

      if (activeTab === 'assignments') {
        items = items.filter((i: any) => ASSIGNMENT_ISSUE_TYPES.has(i.issueType));
      } else if (activeTab === 'employments') {
        items = items.filter((i: any) => EMPLOYMENT_ISSUE_TYPES.has(i.issueType));
      }

      setIssues(items);
      setTotal(data?.total ?? items.length);
    } catch { /* ignore */ }
    setLoading(false);
  }, [activeTab, legalEntityFilter, severityFilter, assignedFilter, sortBy]);

  useEffect(() => { loadStats(); loadUsers(); }, [loadStats, loadUsers]);
  useEffect(() => { loadIssues(); }, [loadIssues]);

  useEffect(() => {
    const drilldown = searchParams.get('drilldown');
    if (drilldown) {
      openDrilldown({ issueType: drilldown, title: ISSUE_TYPE_LABELS[drilldown] || drilldown });
    }
  }, [searchParams]);

  const handleRecheck = async () => {
    setRecheckRunning(true);
    try {
      await triggerIssueDetection();
      await triggerStatsRefresh();
      await Promise.all([loadStats(), loadIssues()]);
    } catch { /* ignore */ }
    setRecheckRunning(false);
  };

  const handleAssign = async (issueId: string, userId: string) => {
    try {
      if (userId) await assignIssue(issueId, userId);
      else await unassignIssue(issueId);
      await loadIssues();
    } catch { /* ignore */ }
  };

  const readinessPercent = queueStats
    ? (queueStats.openTotal > 0 ? Math.max(0, 100 - Math.round((queueStats.openBlockers / Math.max(queueStats.openTotal, 1)) * 100)) : 100)
    : 0;

  const selectStyle: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
    fontSize: 13, background: '#fff', color: '#334155',
  };

  return (
    <Page
      title="Workforce Remediation Queue"
      subtitle="Daily operating console — prioritize, assign, and resolve data quality issues."
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => openDrilldown({ groupBy: 'orgUnit', title: 'Issues by Org Unit' })}
            style={{ ...styles.buttonSecondary, fontSize: 13 }}
          >
            Group by Org Unit
          </button>
          <button
            onClick={handleRecheck}
            disabled={recheckRunning}
            style={{ ...styles.buttonPrimary, fontSize: 13, opacity: recheckRunning ? 0.6 : 1 }}
          >
            {recheckRunning ? 'Detecting...' : 'Run detection'}
          </button>
        </div>
      }
    >
      {/* Stats strip */}
      {queueStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { value: queueStats.openTotal, label: 'Open issues', color: queueStats.openTotal > 0 ? '#dc2626' : '#16a34a' },
            { value: queueStats.openBlockers, label: 'Critical blockers', color: queueStats.openBlockers > 0 ? '#dc2626' : '#16a34a' },
            { value: queueStats.resolvedToday, label: 'Resolved today', color: '#16a34a' },
            { value: queueStats.resolvedThisWeek, label: 'This week', color: '#2563eb' },
            { value: `${readinessPercent}%`, label: 'Readiness', color: readinessPercent >= 90 ? '#16a34a' : readinessPercent >= 70 ? '#ca8a04' : '#dc2626' },
          ].map((s, i) => (
            <Card key={i}>
              <div style={{ padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '2px solid #e2e8f0' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? '#4f46e5' : '#64748b',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid #4f46e5' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div style={{ padding: '10px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={selectStyle}>
            <option value="">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="ERROR">Error</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>
          <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)} style={selectStyle}>
            <option value="">All assignments</option>
            <option value="unassigned">Unassigned</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Sort:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
            <option value="priority">Priority score</option>
            <option value="age">Oldest first</option>
            <option value="severity">Severity</option>
          </select>
        </div>
      </Card>

      {/* Queue table */}
      <Card>
        <CardHeader title={`Queue (${issues.length})`} />
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading queue...</div>
        ) : issues.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>&#10003;</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#16a34a' }}>Queue is clear</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>No issues match your filters.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={{ ...styles.tableHeaderCell, width: 50 }}>Priority</th>
                  <th style={styles.tableHeaderCell}>Issue</th>
                  <th style={styles.tableHeaderCell}>Employee</th>
                  <th style={styles.tableHeaderCell}>Legal Entity</th>
                  <th style={styles.tableHeaderCell}>Org Unit</th>
                  <th style={styles.tableHeaderCell}>Severity</th>
                  <th style={styles.tableHeaderCell}>Export</th>
                  <th style={styles.tableHeaderCell}>Age</th>
                  <th style={styles.tableHeaderCell}>Assigned To</th>
                  <th style={styles.tableHeaderCell}>Action</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue: any) => (
                  <tr key={issue.id} style={styles.tableRow}>
                    <td style={{ ...styles.tableCell, textAlign: 'center' }}>
                      <PriorityBadge score={issue.priorityScore} />
                    </td>
                    <td style={{ ...styles.tableCell, maxWidth: 180 }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType}
                      </div>
                    </td>
                    <td style={styles.tableCell}>
                      {issue.employeeName ? (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{issue.employeeName}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{issue.employeeNo}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td style={styles.tableCell}>
                      <span style={{ fontSize: 12, color: '#475569' }}>{issue.legalEntityName || '—'}</span>
                    </td>
                    <td style={styles.tableCell}>
                      <span style={{ fontSize: 12, color: '#475569' }}>{issue.orgUnitName || '—'}</span>
                    </td>
                    <td style={styles.tableCell}>
                      <SeverityBadge severity={issue.severity} />
                    </td>
                    <td style={styles.tableCell}>
                      {issue.blocksExport ? (
                        <span style={{ padding: '1px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>
                          Blocked
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td style={styles.tableCell}>
                      <AgeIndicator hours={issue.issueAgeHours} days={issue.issueAgeDays} />
                    </td>
                    <td style={styles.tableCell}>
                      <select
                        value={issue.assignedUserId || ''}
                        onChange={(e) => handleAssign(issue.id, e.target.value)}
                        style={{
                          padding: '3px 8px', borderRadius: 5, border: '1px solid #e2e8f0',
                          fontSize: 11, background: issue.assignedUserId ? '#eef2ff' : '#fff',
                          color: issue.assignedUserId ? '#4338ca' : '#94a3b8',
                          maxWidth: 120,
                        }}
                      >
                        <option value="">Unassigned</option>
                        {users.map((u: any) => (
                          <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                        ))}
                      </select>
                    </td>
                    <td style={styles.tableCell}>
                      {issue.recommendedAction && (
                        <button
                          onClick={() => {
                            const route = getRemediationRoute(issue.issueType, issue.recommendedAction.params);
                            navigate(route);
                          }}
                          style={{
                            padding: '4px 12px', borderRadius: 6, border: '1px solid #6366f1',
                            background: '#eef2ff', color: '#4338ca', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {issue.recommendedAction.label}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <IssueDrilldownDrawer
        {...drilldownState}
        onClose={closeDrilldown}
        onRefreshNeeded={() => { loadStats(); loadIssues(); }}
      />
    </Page>
  );
}

function PriorityBadge({ score }: { score: number }) {
  let bg = '#f1f5f9'; let fg = '#475569';
  if (score >= 15) { bg = '#fee2e2'; fg = '#991b1b'; }
  else if (score >= 10) { bg = '#fed7aa'; fg = '#9a3412'; }
  else if (score >= 7) { bg = '#fef9c3'; fg = '#854d0e'; }
  return (
    <span style={{
      display: 'inline-block', minWidth: 28, padding: '2px 6px', borderRadius: 6,
      fontSize: 12, fontWeight: 700, textAlign: 'center', background: bg, color: fg,
    }}>
      {score}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cfg: Record<string, { bg: string; fg: string }> = {
    CRITICAL: { bg: '#fee2e2', fg: '#991b1b' },
    ERROR: { bg: '#fee2e2', fg: '#991b1b' },
    WARNING: { bg: '#fef9c3', fg: '#854d0e' },
    INFO: { bg: '#e0f2fe', fg: '#0c4a6e' },
  };
  const c = cfg[severity] || cfg.INFO;
  return (
    <span style={{ padding: '1px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: c.bg, color: c.fg }}>
      {severity}
    </span>
  );
}

function AgeIndicator({ hours, days }: { hours: number; days: number }) {
  let color = '#16a34a';
  if (hours > 72) color = '#dc2626';
  else if (hours > 24) color = '#ca8a04';

  const label = days === 0 ? `${hours}h` : `${days}d ${hours % 24}h`;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color }}>{label}</div>
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        {days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`}
      </div>
    </div>
  );
}
