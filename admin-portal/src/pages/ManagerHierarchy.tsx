import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Stack, Banner, ui } from '../ui/layout';
import { ForbiddenEmptyState } from '../ui/empty-states';
import { useAccess } from '../hooks/useAccess';
import { fetchManagerHierarchyStats } from '../features/workforce-stats/api';
import { StatCard, StatStrip } from '../features/workforce-stats/components/StatCard';
import { ReadinessBar } from '../features/workforce-stats/components/ReadinessBadge';
import { IssueDrilldownDrawer } from '../features/workforce-stats/components/IssueDrilldownDrawer';
import { useIssueDrilldown } from '../features/workforce-stats/hooks/useIssueDrilldown';

type LegalEntity = { id: string; name: string; code: string };

type Summary = {
  employees_total: number;
  manager_assigned: number;
  missing_manager: number;
  cycles_detected: number;
  self_manager: number;
  orphan_managers: number;
  cross_entity_managers: number;
  cross_org_managers: number;
  max_depth: number;
  largest_span: number;
  status: 'READY' | 'READY_WITH_WARNINGS' | 'NOT_READY';
  errors: Array<{ code: string; severity: string; message: string }>;
  warnings: Array<{ code: string; severity: string; message: string }>;
};

type IssueRow = {
  employee_id: string;
  employee_no: string;
  first_name: string;
  last_name: string;
  manager_id: string | null;
  manager_name: string | null;
  legal_entity_id: string | null;
  legal_entity_name: string | null;
  org_unit_name: string | null;
  issues: Array<{ code: string; severity: string; message: string }>;
};

type TreeNode = {
  employee_id: string;
  employee_no: string;
  name: string;
  job_title: string | null;
  direct_reports_count: number;
  children?: TreeNode[];
  truncated?: boolean;
};

type ManagerRow = {
  employee_id: string;
  employee_no: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  legal_entity_name: string | null;
  direct_reports_count: number;
  team_size: number;
  span_warning: boolean;
  span_warning_label?: string;
};

type Tab = 'exceptions' | 'tree' | 'direct-reports' | 'simulation';

type SimulationStep = {
  level: number;
  resolution_type: string;
  approver_user_id?: string;
  approver_employee_id?: string;
  approver_name: string;
  reason_code: string;
  reason: string;
};

type SimulationAttempt = {
  resolution_type: string;
  status: 'RESOLVED' | 'FAILED' | 'SKIPPED' | 'NOT_USED';
  reason_code: string;
  reason: string;
};

type SimulationResult = {
  status: 'RESOLVED' | 'RESOLVED_WITH_FALLBACK' | 'UNRESOLVED';
  policy: string;
  requester: {
    employee_id: string;
    employee_no?: string;
    full_name: string;
    legal_entity_id?: string;
    org_unit_id?: string;
  };
  steps: SimulationStep[];
  attempts: SimulationAttempt[];
  meta?: {
    fallback_used: boolean;
    resolved_steps: number;
    generated_at: string;
  };
};

type PolicyOption = { code: string; label: string };
type RequestTypeOption = { code: string; label: string };
type FallbackRoleOption = { code: string; label: string };
type EmployeeSearchResult = { id: string; employee_no: string; first_name: string; last_name: string };

export default function ManagerHierarchy() {
  const { canAny } = useAccess();
  const canView = canAny(['employee:read', 'employment:read', 'hr:read', 'iam:legal_entities:manage']);
  const canWrite = canAny(['iam:legal_entities:manage', 'employment:write']);

  const [tab, setTab] = useState<Tab>('exceptions');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [filterLegalEntity, setFilterLegalEntity] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState('');

  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<IssueRow | null>(null);
  const [managerSearch, setManagerSearch] = useState('');
  const [managerResults, setManagerResults] = useState<Array<{ id: string; employee_no: string; first_name: string; last_name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [mgrStats, setMgrStats] = useState<any>(null);
  const { drilldownState, openDrilldown, closeDrilldown } = useIssueDrilldown();

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const r = await api.get('/v1/enterprise/manager-hierarchy/summary');
      setSummary(r.data);
    } catch {
      setError('Failed to load hierarchy summary');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLegalEntities = useCallback(async () => {
    try {
      const r = await api.get('/legal-entities', { params: { limit: 200 } });
      setLegalEntities(Array.isArray(r.data?.items ?? r.data) ? (r.data?.items ?? r.data) : []);
    } catch { /* ignore */ }
  }, []);

  const loadIssues = useCallback(async () => {
    try {
      setIssuesLoading(true);
      const params: Record<string, string> = {};
      if (filterLegalEntity) params.legal_entity_id = filterLegalEntity;
      if (filterStatus && filterStatus !== 'all') params.status = filterStatus;
      if (filterSearch) params.search = filterSearch;
      const r = await api.get('/v1/enterprise/manager-hierarchy/issues', { params });
      setIssues(Array.isArray(r.data) ? r.data : []);
    } catch {
      setError('Failed to load issues');
    } finally {
      setIssuesLoading(false);
    }
  }, [filterLegalEntity, filterStatus, filterSearch]);

  const loadTree = useCallback(async () => {
    try {
      setTreeLoading(true);
      const r = await api.get('/v1/enterprise/manager-hierarchy/tree');
      setTree(Array.isArray(r.data) ? r.data : []);
    } catch {
      setError('Failed to load tree');
    } finally {
      setTreeLoading(false);
    }
  }, []);

  const loadManagers = useCallback(async () => {
    try {
      setManagersLoading(true);
      const r = await api.get('/v1/enterprise/manager-hierarchy/managers');
      setManagers(Array.isArray(r.data) ? r.data : []);
    } catch {
      setError('Failed to load managers');
    } finally {
      setManagersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadLegalEntities();
    fetchManagerHierarchyStats().then(setMgrStats).catch(() => {});
  }, [loadSummary, loadLegalEntities]);

  useEffect(() => {
    if (tab === 'exceptions') void loadIssues();
    else if (tab === 'tree') void loadTree();
    else if (tab === 'direct-reports') void loadManagers();
  }, [tab, loadIssues, loadTree, loadManagers]);

  const searchManagers = useCallback(async (q: string) => {
    if (q.length < 2) { setManagerResults([]); return; }
    try {
      const r = await api.get('/employees', { params: { search: q, limit: 10 } });
      const items = r.data?.items ?? r.data ?? [];
      setManagerResults(
        (Array.isArray(items) ? items : []).map((e: Record<string, string>) => ({
          id: e.id,
          employee_no: e.employee_no ?? e.employeeNo,
          first_name: e.first_name ?? e.firstName,
          last_name: e.last_name ?? e.lastName,
        })),
      );
    } catch { setManagerResults([]); }
  }, []);

  const assignManager = useCallback(async (employeeId: string, managerId: string | null) => {
    try {
      setSaving(true);
      await api.patch(`/v1/enterprise/manager-hierarchy/employees/${employeeId}/manager`, { manager_id: managerId });
      setEditingEmployee(null);
      setManagerSearch('');
      setManagerResults([]);
      void loadSummary();
      void loadIssues();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to assign manager');
    } finally {
      setSaving(false);
    }
  }, [loadSummary, loadIssues]);

  if (!canView) {
    return (
      <Page title="Manager Hierarchy" subtitle="Review and manage reporting relationships.">
        <ForbiddenEmptyState feature="Manager Hierarchy" />
      </Page>
    );
  }

  if (loading && !summary) {
    return (
      <Page title="Manager Hierarchy" subtitle="Review and manage reporting relationships.">
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} />
          <p style={{ color: styles.colors.textSecondary }}>Loading hierarchy data...</p>
        </div>
        <style>{styles.spinKeyframes}</style>
      </Page>
    );
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; fg: string; label: string }> = {
      READY: { bg: '#dcfce7', fg: '#166534', label: 'Ready' },
      READY_WITH_WARNINGS: { bg: '#fef9c3', fg: '#854d0e', label: 'Ready with warnings' },
      NOT_READY: { bg: '#fee2e2', fg: '#991b1b', label: 'Not ready' },
    };
    const s = map[status] ?? map.NOT_READY;
    return (
      <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: s.bg, color: s.fg }}>
        {s.label}
      </span>
    );
  };

  return (
    <Page
      title="Manager Hierarchy"
      subtitle="Review reporting relationships, identify issues, and manage manager assignments."
      actions={summary ? statusBadge(summary.status) : null}
    >
      <Stack gap={ui.space.lg}>
        {error && <Banner variant="error">{error}</Banner>}

        {summary && <SummaryCards summary={summary} mgrStats={mgrStats} onMissingManagerClick={() => openDrilldown({
          issueType: 'MISSING_MANAGER',
          title: 'Employees missing manager',
          groupBy: 'legalEntity',
        })} />}

        {mgrStats && (
          <Card>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Manager Coverage</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: mgrStats.managerCoverage >= 90 ? '#16a34a' : mgrStats.managerCoverage >= 70 ? '#f59e0b' : '#dc2626' }}>
                  {mgrStats.managerCoverage}%
                </span>
              </div>
              <ReadinessBar
                percent={mgrStats.managerCoverage}
                status={mgrStats.managerCoverage >= 90 ? 'READY' : mgrStats.managerCoverage >= 70 ? 'WARNING' : 'BLOCKED'}
                height={8}
                showLabel={false}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginTop: 8 }}>
                <span>{mgrStats.withManager} of {mgrStats.activeEmployees} employees have a manager</span>
                <span>
                  {mgrStats.orgUnitsWithManager} of {mgrStats.orgUnitsTotal} org units have a confirmed manager
                  {mgrStats.pendingSuggestions > 0 && (
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}> · {mgrStats.pendingSuggestions} suggestion{mgrStats.pendingSuggestions !== 1 ? 's' : ''} pending</span>
                  )}
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={filterLegalEntity}
            onChange={(e) => setFilterLegalEntity(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 180 }}
          >
            <option value="">All legal entities</option>
            {legalEntities.map((le) => (
              <option key={le.id} value={le.id}>{le.name} ({le.code})</option>
            ))}
          </select>
          {tab === 'exceptions' && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 140 }}
            >
              <option value="all">All issues</option>
              <option value="errors">Errors only</option>
              <option value="warnings">Warnings only</option>
              <option value="clean">Clean only</option>
            </select>
          )}
          <input
            type="text"
            placeholder="Search employee..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 200 }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${styles.colors.border}` }}>
          {(['exceptions', 'tree', 'direct-reports', 'simulation'] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = {
              exceptions: 'Exceptions',
              tree: 'Reporting Tree',
              'direct-reports': 'Direct Reports',
              simulation: 'Approval Simulation',
            };
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? styles.colors.primary : styles.colors.textSecondary,
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t ? `2px solid ${styles.colors.primary}` : '2px solid transparent',
                  cursor: 'pointer',
                  marginBottom: -2,
                }}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === 'exceptions' && (
          <ExceptionsTab
            issues={issues}
            loading={issuesLoading}
            canWrite={canWrite}
            editingEmployee={editingEmployee}
            onEdit={setEditingEmployee}
            managerSearch={managerSearch}
            onManagerSearch={(q) => { setManagerSearch(q); void searchManagers(q); }}
            managerResults={managerResults}
            onAssignManager={assignManager}
            onRemoveManager={(empId) => void assignManager(empId, null)}
            saving={saving}
          />
        )}
        {tab === 'tree' && <TreeTab tree={tree} loading={treeLoading} />}
        {tab === 'direct-reports' && <DirectReportsTab managers={managers} loading={managersLoading} />}
        {tab === 'simulation' && <ApprovalSimulationTab legalEntities={legalEntities} onSwitchTab={setTab} />}
      </Stack>
      <style>{styles.spinKeyframes}</style>

      <IssueDrilldownDrawer
        open={drilldownState.open}
        onClose={closeDrilldown}
        issueType={drilldownState.issueType}
        title={drilldownState.title}
        groupBy={drilldownState.groupBy}
        onRefreshNeeded={() => {
          void loadSummary();
          fetchManagerHierarchyStats().then(setMgrStats).catch(() => {});
        }}
      />
    </Page>
  );
}

function SummaryCards({ summary, mgrStats, onMissingManagerClick }: { summary: Summary; mgrStats: any; onMissingManagerClick?: () => void }) {
  const metric = (label: string, value: number | string, opts?: { danger?: boolean; success?: boolean; info?: boolean; onClick?: () => void; subtitle?: string }) => (
    <div
      style={{
        padding: '14px 18px',
        background: opts?.danger && typeof value === 'number' && value > 0 ? '#fef2f2'
          : opts?.success ? '#f0fdf4'
          : opts?.info ? '#eff6ff'
          : '#f8fafc',
        borderRadius: 8, textAlign: 'center', flex: '1 1 120px', minWidth: 100,
        cursor: opts?.onClick ? 'pointer' : 'default', transition: 'box-shadow .15s',
      }}
      onClick={opts?.onClick}
      onMouseEnter={(e) => opts?.onClick && ((e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}
    >
      <div style={{
        fontSize: 22, fontWeight: 700,
        color: opts?.danger && typeof value === 'number' && value > 0 ? '#dc2626'
          : opts?.success ? '#16a34a'
          : opts?.info ? '#2563eb'
          : styles.colors.textPrimary,
      }}>{value}</div>
      <div style={{ fontSize: 11, color: styles.colors.textMuted, marginTop: 2 }}>{label}</div>
      {opts?.subtitle && <div style={{ fontSize: 10, color: styles.colors.textMuted, marginTop: 1 }}>{opts.subtitle}</div>}
    </div>
  );

  const topOfChain = mgrStats?.topOfChain ?? 0;
  const missingManager = mgrStats?.missingManager ?? summary.missing_manager;
  const hierarchyIssues = mgrStats?.hierarchyIssues ?? 0;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {metric('Employees', summary.employees_total)}
      {metric('With manager', `${summary.manager_assigned} / ${summary.employees_total}`, { success: summary.manager_assigned === summary.employees_total })}
      {metric('Without manager', summary.missing_manager, {
        danger: missingManager > 0,
        subtitle: topOfChain > 0 ? `${topOfChain} top-of-chain` : undefined,
      })}
      {metric('Hierarchy issues', hierarchyIssues, {
        danger: hierarchyIssues > 0,
        onClick: hierarchyIssues > 0 ? onMissingManagerClick : undefined,
      })}
      {metric('Top-of-chain', topOfChain, { info: topOfChain > 0 })}
      {metric('Cycles', summary.cycles_detected, { danger: true })}
      {metric('Self-managers', summary.self_manager, { danger: true })}
      {metric('Cross-org', summary.cross_org_managers)}
      {metric('Max depth', summary.max_depth)}
      {metric('Largest span', summary.largest_span)}
    </div>
  );
}

function ExceptionsTab({
  issues, loading, canWrite, editingEmployee, onEdit,
  managerSearch, onManagerSearch, managerResults, onAssignManager, onRemoveManager, saving,
}: {
  issues: IssueRow[];
  loading: boolean;
  canWrite: boolean;
  editingEmployee: IssueRow | null;
  onEdit: (e: IssueRow | null) => void;
  managerSearch: string;
  onManagerSearch: (q: string) => void;
  managerResults: Array<{ id: string; employee_no: string; first_name: string; last_name: string }>;
  onAssignManager: (empId: string, managerId: string | null) => void;
  onRemoveManager: (empId: string) => void;
  saving: boolean;
}) {
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <Card>
        <div style={{ padding: 32, textAlign: 'center', color: styles.colors.textMuted }}>
          No issues found. All employees have a clean hierarchy.
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Employee</th>
                <th style={styles.tableHeaderCell}>Current Manager</th>
                <th style={styles.tableHeaderCell}>Issues</th>
                <th style={styles.tableHeaderCell}>Legal Entity</th>
                <th style={styles.tableHeaderCell}>Org Unit</th>
                {canWrite && <th style={styles.tableHeaderCell}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {issues.map((row) => (
                <tr key={row.employee_id} style={styles.tableRow}>
                  <td style={styles.tableCell}>
                    <Link
                      to={`/enterprise/employees/${row.employee_id}`}
                      style={{ color: styles.colors.primary, textDecoration: 'none', fontWeight: 500 }}
                    >
                      {row.first_name} {row.last_name}
                    </Link>
                    <div style={{ fontSize: 12, color: styles.colors.textMuted }}>{row.employee_no}</div>
                  </td>
                  <td style={styles.tableCell}>
                    {row.manager_name ?? <span style={{ color: styles.colors.textMuted }}>None</span>}
                  </td>
                  <td style={styles.tableCell}>
                    {row.issues.map((issue, i) => (
                      <div key={i} style={{ fontSize: 12, marginBottom: 2 }}>
                        <span style={{
                          display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: issue.severity === 'ERROR' ? '#fee2e2' : '#fef9c3',
                          color: issue.severity === 'ERROR' ? '#991b1b' : '#854d0e',
                          marginRight: 6,
                        }}>
                          {issue.code}
                        </span>
                        {issue.message}
                      </div>
                    ))}
                  </td>
                  <td style={styles.tableCell}>
                    <span style={{ fontSize: 13 }}>{row.legal_entity_name ?? '—'}</span>
                  </td>
                  <td style={styles.tableCell}>
                    <span style={{ fontSize: 13 }}>{row.org_unit_name ?? '—'}</span>
                  </td>
                  {canWrite && (
                    <td style={styles.tableCell}>
                      <button
                        type="button"
                        style={{ ...styles.buttonSecondary, fontSize: 12 }}
                        onClick={() => onEdit(row)}
                      >
                        {row.manager_id ? 'Change' : 'Assign'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editingEmployee && (
        <ManagerAssignModal
          employee={editingEmployee}
          managerSearch={managerSearch}
          onManagerSearch={onManagerSearch}
          managerResults={managerResults}
          onAssign={(managerId) => void onAssignManager(editingEmployee.employee_id, managerId)}
          onRemove={() => void onRemoveManager(editingEmployee.employee_id)}
          onClose={() => onEdit(null)}
          saving={saving}
        />
      )}
    </>
  );
}

function ManagerAssignModal({
  employee, managerSearch, onManagerSearch, managerResults, onAssign, onRemove, onClose, saving,
}: {
  employee: IssueRow;
  managerSearch: string;
  onManagerSearch: (q: string) => void;
  managerResults: Array<{ id: string; employee_no: string; first_name: string; last_name: string }>;
  onAssign: (managerId: string) => void;
  onRemove: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={() => !saving && onClose()}
    >
      <div
        style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
            {employee.manager_id ? 'Change Manager' : 'Assign Manager'}
          </h2>
          <button type="button" onClick={() => !saving && onClose()} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>
            &times;
          </button>
        </div>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
            <strong>Employee:</strong> {employee.first_name} {employee.last_name} ({employee.employee_no})
            {employee.manager_name && (
              <div style={{ marginTop: 4 }}>
                <strong>Current manager:</strong> {employee.manager_name}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Search for manager</label>
            <input
              type="text"
              value={managerSearch}
              onChange={(e) => onManagerSearch(e.target.value)}
              placeholder="Type name or employee number..."
              disabled={saving}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {managerResults.length > 0 && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
              {managerResults
                .filter((m) => m.id !== employee.employee_id)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={saving}
                    onClick={() => onAssign(m.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                      border: 'none', borderBottom: '1px solid #f1f5f9', background: 'white',
                      cursor: 'pointer', fontSize: 13,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    <strong>{m.first_name} {m.last_name}</strong>
                    <span style={{ color: styles.colors.textMuted, marginLeft: 8 }}>{m.employee_no}</span>
                  </button>
                ))}
            </div>
          )}

          {employee.manager_id && (
            <button
              type="button"
              onClick={onRemove}
              disabled={saving}
              style={{ ...styles.buttonSecondary, color: '#dc2626', borderColor: '#fecaca', fontSize: 13 }}
            >
              Remove manager
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TreeTab({ tree, loading }: { tree: TreeNode[]; loading: boolean }) {
  if (loading) {
    return <div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div>;
  }

  if (tree.length === 0) {
    return (
      <Card>
        <div style={{ padding: 32, textAlign: 'center', color: styles.colors.textMuted }}>
          No hierarchy data found. Import employees and manager relationships first.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Reporting Tree" right={<span style={{ fontSize: 12, color: styles.colors.textMuted }}>{tree.length} root node(s)</span>} />
      <div style={{ padding: '0 16px 16px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}>
        {tree.map((node) => (
          <TreeNodeRow key={node.employee_id} node={node} depth={0} />
        ))}
      </div>
    </Card>
  );
}

function TreeNodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const indent = depth * 24;

  return (
    <>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', paddingLeft: indent, cursor: hasChildren ? 'pointer' : 'default' }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <span style={{ width: 16, textAlign: 'center', color: styles.colors.textMuted, fontSize: 12, flexShrink: 0 }}>
          {hasChildren ? (expanded ? '▼' : '▶') : '·'}
        </span>
        <Link to={`/enterprise/employees/${node.employee_id}`} style={{ color: styles.colors.primary, textDecoration: 'none', fontWeight: 500 }} onClick={(e) => e.stopPropagation()}>
          {node.name}
        </Link>
        <span style={{ color: styles.colors.textMuted, fontSize: 11 }}>{node.employee_no}</span>
        {node.job_title && <span style={{ color: styles.colors.textSecondary, fontSize: 11 }}>— {node.job_title}</span>}
        {node.direct_reports_count > 0 && (
          <span style={{ fontSize: 10, color: styles.colors.textMuted, background: '#f1f5f9', padding: '1px 6px', borderRadius: 8 }}>
            {node.direct_reports_count} report{node.direct_reports_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {expanded && node.children?.map((child) => (
        <TreeNodeRow key={child.employee_id} node={child} depth={depth + 1} />
      ))}
      {node.truncated && (
        <div style={{ paddingLeft: indent + 24, fontSize: 11, color: styles.colors.textMuted, fontStyle: 'italic' }}>
          (tree truncated)
        </div>
      )}
    </>
  );
}

function ApprovalSimulationTab({ legalEntities, onSwitchTab }: { legalEntities: LegalEntity[]; onSwitchTab: (t: Tab) => void }) {
  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestTypeOption[]>([]);
  const [fallbackRoles, setFallbackRoles] = useState<FallbackRoleOption[]>([]);

  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeResults, setEmployeeResults] = useState<EmployeeSearchResult[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchResult | null>(null);

  const [requestType, setRequestType] = useState('ACCESS_REQUEST');
  const [routingPolicy, setRoutingPolicy] = useState('MANAGER_SKIP_ORG_ROLE');
  const [legalEntityId, setLegalEntityId] = useState('');
  const [roleFallback, setRoleFallback] = useState('');

  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [pRes, rRes, fRes] = await Promise.all([
          api.get('/v1/enterprise/approval-routing/policies'),
          api.get('/v1/enterprise/approval-routing/request-types'),
          api.get('/v1/enterprise/approval-routing/fallback-roles'),
        ]);
        setPolicies(pRes.data?.items ?? []);
        setRequestTypes(rRes.data?.items ?? []);
        setFallbackRoles(fRes.data?.items ?? []);
      } catch { /* options will use defaults */ }
    };
    void loadOptions();
  }, []);

  const searchEmployees = useCallback(async (q: string) => {
    setEmployeeSearch(q);
    if (q.length < 2) { setEmployeeResults([]); return; }
    try {
      const r = await api.get('/employees', { params: { q, limit: 10 } });
      const items = r.data?.items ?? r.data ?? [];
      setEmployeeResults(
        (Array.isArray(items) ? items : []).map((e: Record<string, string>) => ({
          id: e.id,
          employee_no: e.employee_no ?? e.employeeNo,
          first_name: e.first_name ?? e.firstName,
          last_name: e.last_name ?? e.lastName,
        })),
      );
    } catch { setEmployeeResults([]); }
  }, []);

  const selectEmployee = (emp: EmployeeSearchResult) => {
    setSelectedEmployee(emp);
    setEmployeeSearch(`${emp.first_name} ${emp.last_name} (${emp.employee_no})`);
    setEmployeeResults([]);
  };

  const canRun = !!selectedEmployee && !!requestType && !!routingPolicy;

  const runSimulation = async () => {
    if (!selectedEmployee) return;
    setSimLoading(true);
    setSimError('');
    setResult(null);
    try {
      const res = await api.post('/v1/enterprise/approval-routing/simulate', {
        requester_employee_id: selectedEmployee.id,
        request_type: requestType,
        routing_policy: routingPolicy,
        legal_entity_id: legalEntityId || undefined,
        role_fallback: roleFallback || undefined,
      });
      setResult(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSimError(e?.response?.data?.message ?? 'Simulation failed');
    } finally {
      setSimLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; fg: string; label: string }> = {
      RESOLVED: { bg: '#dcfce7', fg: '#166534', label: 'Resolved' },
      RESOLVED_WITH_FALLBACK: { bg: '#fef9c3', fg: '#854d0e', label: 'Resolved with fallback' },
      UNRESOLVED: { bg: '#fee2e2', fg: '#991b1b', label: 'Unresolved' },
    };
    const s = map[status] ?? map.UNRESOLVED;
    return (
      <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: s.bg, color: s.fg }}>
        {s.label}
      </span>
    );
  };

  const resolutionLabel = (type: string) => {
    const map: Record<string, string> = {
      MANAGER: 'Direct Manager',
      SKIP_LEVEL_MANAGER: 'Skip-level Manager',
      ORG_UNIT_FALLBACK: 'Org Unit Fallback',
      ROLE_FALLBACK: 'Role Fallback',
    };
    return map[type] ?? type;
  };

  const attemptStatusStyle = (status: string): React.CSSProperties => {
    switch (status) {
      case 'RESOLVED': return { color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 };
      case 'FAILED': return { color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 };
      case 'SKIPPED': return { color: '#854d0e', background: '#fef9c3', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 };
      case 'NOT_USED': return { color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 };
      default: return {};
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${styles.colors.border}`, fontSize: 14,
    outline: 'none', boxSizing: 'border-box' as const,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4, color: styles.colors.textSecondary,
  };

  return (
    <Stack gap={ui.space.lg}>
      {/* Input card */}
      <Card>
        <CardHeader title="Run Approval Simulation" />
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Employee search */}
          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>Requester Employee</label>
            <input
              type="text"
              value={employeeSearch}
              onChange={(e) => { void searchEmployees(e.target.value); setSelectedEmployee(null); }}
              placeholder="Search employee by name or employee number"
              style={inputStyle}
            />
            {employeeResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: 'white', border: `1px solid ${styles.colors.border}`, borderRadius: 8,
                maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}>
                {employeeResults.map((e) => (
                  <button
                    key={e.id} type="button" onClick={() => selectEmployee(e)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                      border: 'none', borderBottom: '1px solid #f1f5f9', background: 'white',
                      cursor: 'pointer', fontSize: 13,
                    }}
                    onMouseEnter={(ev) => (ev.currentTarget.style.background = '#f0f9ff')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.background = 'white')}
                  >
                    <strong>{e.first_name} {e.last_name}</strong>
                    <span style={{ color: styles.colors.textMuted, marginLeft: 8 }}>{e.employee_no}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Request type */}
            <div>
              <label style={labelStyle}>Request Type</label>
              <select value={requestType} onChange={(e) => setRequestType(e.target.value)} style={inputStyle}>
                {(requestTypes.length > 0 ? requestTypes : [
                  { code: 'ACCESS_REQUEST', label: 'Access Request' },
                  { code: 'PROFILE_CHANGE', label: 'Employee Profile Change' },
                  { code: 'PAYROLL_ADJUSTMENT', label: 'Payroll Adjustment' },
                  { code: 'MANAGER_CERTIFICATION', label: 'Manager Certification' },
                ]).map((rt) => (
                  <option key={rt.code} value={rt.code}>{rt.label}</option>
                ))}
              </select>
            </div>

            {/* Routing policy */}
            <div>
              <label style={labelStyle}>Routing Policy</label>
              <select value={routingPolicy} onChange={(e) => setRoutingPolicy(e.target.value)} style={inputStyle}>
                {(policies.length > 0 ? policies : [
                  { code: 'MANAGER_ONLY', label: 'Manager Only' },
                  { code: 'MANAGER_SKIP', label: 'Manager → Skip-level' },
                  { code: 'MANAGER_ORG_ROLE', label: 'Manager → Org Fallback → Role' },
                  { code: 'MANAGER_SKIP_ORG_ROLE', label: 'Manager → Skip-level → Org Fallback → Role' },
                ]).map((p) => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Legal entity (optional) */}
            <div>
              <label style={labelStyle}>Legal Entity <span style={{ fontWeight: 400, color: styles.colors.textMuted }}>(optional)</span></label>
              <select value={legalEntityId} onChange={(e) => setLegalEntityId(e.target.value)} style={inputStyle}>
                <option value="">Auto-detect from employee</option>
                {legalEntities.map((le) => (
                  <option key={le.id} value={le.id}>{le.name} ({le.code})</option>
                ))}
              </select>
            </div>

            {/* Role fallback (optional) */}
            <div>
              <label style={labelStyle}>Role Fallback <span style={{ fontWeight: 400, color: styles.colors.textMuted }}>(optional)</span></label>
              <select value={roleFallback} onChange={(e) => setRoleFallback(e.target.value)} style={inputStyle}>
                <option value="">Auto-detect from request type</option>
                {(fallbackRoles.length > 0 ? fallbackRoles : [
                  { code: 'HR_ADMIN', label: 'HR Admin' },
                  { code: 'PAYROLL_APPROVER', label: 'Payroll Approver' },
                  { code: 'FINANCE_APPROVER', label: 'Finance Approver' },
                ]).map((fr) => (
                  <option key={fr.code} value={fr.code}>{fr.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <button
              type="button"
              disabled={!canRun || simLoading}
              onClick={() => void runSimulation()}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600,
                cursor: canRun && !simLoading ? 'pointer' : 'not-allowed',
                background: canRun && !simLoading ? styles.colors.primary : '#cbd5e1',
                color: 'white',
              }}
            >
              {simLoading ? 'Running Simulation...' : 'Run Simulation'}
            </button>
          </div>
        </div>
      </Card>

      {simError && <Banner variant="error">{simError}</Banner>}

      {/* Empty state before running */}
      {!result && !simLoading && !simError && (
        <Card>
          <div style={{ padding: 40, textAlign: 'center', color: styles.colors.textMuted }}>
            <div style={{ fontSize: 15, marginBottom: 6 }}>Run an approval simulation to see how the platform resolves approvers.</div>
            <div style={{ fontSize: 13 }}>
              Uses manager hierarchy, org-unit fallback, and role-based fallback policies.
            </div>
          </div>
        </Card>
      )}

      {simLoading && (
        <Card>
          <div style={{ ...styles.loadingContainer, padding: 40 }}>
            <div style={styles.loadingSpinner} />
            <p style={{ color: styles.colors.textSecondary, marginTop: 12 }}>
              Resolving manager chain and fallback approvers...
            </p>
          </div>
        </Card>
      )}

      {/* Result summary */}
      {result && (
        <>
          <Card>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: styles.colors.textPrimary }}>
                    Simulation Result
                  </h3>
                  <div style={{ fontSize: 13, color: styles.colors.textSecondary, lineHeight: 1.6 }}>
                    <div><strong>Requester:</strong> {result.requester.full_name}{result.requester.employee_no ? ` (${result.requester.employee_no})` : ''}</div>
                    <div><strong>Request type:</strong> {requestTypes.find((r) => r.code === requestType)?.label ?? requestType}</div>
                    <div><strong>Routing policy:</strong> {policies.find((p) => p.code === routingPolicy)?.label ?? routingPolicy}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {statusBadge(result.status)}
                  {result.meta && (
                    <div style={{ fontSize: 12, color: styles.colors.textMuted, marginTop: 6 }}>
                      {result.meta.resolved_steps} approver{result.meta.resolved_steps !== 1 ? 's' : ''} resolved
                      {result.meta.fallback_used && ' · Fallback used'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Resolved approval chain */}
          {result.steps.length > 0 && (
            <Card>
              <CardHeader title="Resolved Approval Chain" />
              <div style={{ padding: '0 20px 20px' }}>
                {result.steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, marginBottom: i < result.steps.length - 1 ? 0 : 0 }}>
                    {/* Timeline connector */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: styles.colors.primary, color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                      }}>
                        {step.level}
                      </div>
                      {i < result.steps.length - 1 && (
                        <div style={{ width: 2, flex: 1, background: '#e2e8f0', minHeight: 20 }} />
                      )}
                    </div>

                    {/* Step card */}
                    <div style={{
                      flex: 1, padding: 14, background: '#f8fafc', borderRadius: 8,
                      border: `1px solid ${styles.colors.border}`, marginBottom: 10,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: styles.colors.primary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        {resolutionLabel(step.resolution_type)}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: styles.colors.textPrimary, marginBottom: 2 }}>
                        {step.approver_name}
                      </div>
                      {step.approver_employee_id && (
                        <div style={{ fontSize: 12, color: styles.colors.textMuted, marginBottom: 2 }}>
                          Employee: {step.approver_employee_id.substring(0, 8)}...
                        </div>
                      )}
                      {step.approver_user_id && (
                        <div style={{ fontSize: 12, color: styles.colors.textMuted, marginBottom: 4 }}>
                          User: {step.approver_user_id.substring(0, 8)}...
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
                        {step.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Unresolved guidance */}
          {result.status === 'UNRESOLVED' && (
            <Card>
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: '#fee2e2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="18" height="18" fill="none" stroke="#dc2626" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#991b1b' }}>
                      Could not resolve an approval chain
                    </h4>
                    <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
                      {result.attempts.filter((a) => a.status === 'FAILED').map((a, i) => (
                        <li key={i}>{resolutionLabel(a.resolution_type)}: {a.reason}</li>
                      ))}
                    </ul>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Link
                        to={`/enterprise/employees/${result.requester.employee_id}`}
                        style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 12 }}
                      >
                        View Employee
                      </Link>
                      <button
                        type="button"
                        onClick={() => onSwitchTab('exceptions')}
                        style={{ ...styles.buttonSecondary, fontSize: 12 }}
                      >
                        Review Hierarchy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Resolution attempts */}
          <Card>
            <CardHeader title="Resolution Attempts" />
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.tableHeaderCell}>Resolution Type</th>
                    <th style={styles.tableHeaderCell}>Status</th>
                    <th style={styles.tableHeaderCell}>Reason Code</th>
                    <th style={styles.tableHeaderCell}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.attempts.map((a, i) => (
                    <tr key={i} style={styles.tableRow}>
                      <td style={styles.tableCell}>
                        <span style={{ fontWeight: 500 }}>{resolutionLabel(a.resolution_type)}</span>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={attemptStatusStyle(a.status)}>{a.status}</span>
                      </td>
                      <td style={styles.tableCell}>
                        <code style={{ fontSize: 11, color: styles.colors.textMuted, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                          {a.reason_code}
                        </code>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ fontSize: 13 }}>{a.reason}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </Stack>
  );
}

function DirectReportsTab({ managers, loading }: { managers: ManagerRow[]; loading: boolean }) {
  if (loading) {
    return <div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div>;
  }

  if (managers.length === 0) {
    return (
      <Card>
        <div style={{ padding: 32, textAlign: 'center', color: styles.colors.textMuted }}>
          No managers found. Assign manager relationships first.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Direct Reports by Manager" right={<span style={{ fontSize: 12, color: styles.colors.textMuted }}>{managers.length} manager(s)</span>} />
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.tableHeaderCell}>Manager</th>
              <th style={styles.tableHeaderCell}>Job Title</th>
              <th style={styles.tableHeaderCell}>Legal Entity</th>
              <th style={styles.tableHeaderCell}>Direct Reports</th>
              <th style={styles.tableHeaderCell}>Team Size</th>
              <th style={styles.tableHeaderCell}>Span Warning</th>
              <th style={styles.tableHeaderCell}>Action</th>
            </tr>
          </thead>
          <tbody>
            {managers.map((m) => (
              <tr key={m.employee_id} style={styles.tableRow}>
                <td style={styles.tableCell}>
                  <Link
                    to={`/enterprise/employees/${m.employee_id}`}
                    style={{ color: styles.colors.primary, textDecoration: 'none', fontWeight: 500 }}
                  >
                    {m.first_name} {m.last_name}
                  </Link>
                  <div style={{ fontSize: 12, color: styles.colors.textMuted }}>{m.employee_no}</div>
                </td>
                <td style={styles.tableCell}>{m.job_title ?? '—'}</td>
                <td style={styles.tableCell}>{m.legal_entity_name ?? '—'}</td>
                <td style={styles.tableCell}>
                  <span style={{ fontWeight: 600, color: m.span_warning ? '#dc2626' : styles.colors.textPrimary }}>
                    {m.direct_reports_count}
                  </span>
                </td>
                <td style={styles.tableCell}>
                  <span style={{ fontWeight: 600, color: styles.colors.textPrimary }}>
                    {m.team_size ?? m.direct_reports_count}
                  </span>
                </td>
                <td style={styles.tableCell}>
                  {(() => {
                    const label = m.span_warning_label ?? (m.span_warning ? 'OVER_THRESHOLD' : 'OK');
                    if (label === 'OVER_THRESHOLD') return <span style={{ color: '#dc2626', fontWeight: 600, fontSize: 12 }}>Over threshold</span>;
                    if (label === 'WATCH') return <span style={{ color: '#d97706', fontWeight: 600, fontSize: 12 }}>Watch</span>;
                    return <span style={{ color: '#16a34a', fontSize: 12 }}>OK</span>;
                  })()}
                </td>
                <td style={styles.tableCell}>
                  <Link
                    to={`/enterprise/employees/${m.employee_id}?tab=team`}
                    style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 12 }}
                  >
                    View team
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
