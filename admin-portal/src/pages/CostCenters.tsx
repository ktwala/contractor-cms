import { useEffect, useState } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner, Stack, Grid, ui } from '../ui/layout';
import { classifyError } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageBlockedView, PageErrorView } from '../ui/PageStateViews';
import { EmptyListState } from '../ui/empty-states';
import { fetchCostCenterStats, fetchIssueCounts } from '../features/workforce-stats/api';
import { StatCard, StatStrip } from '../features/workforce-stats/components/StatCard';
import { ReadinessBadge } from '../features/workforce-stats/components/ReadinessBadge';
import { IssueDrilldownDrawer } from '../features/workforce-stats/components/IssueDrilldownDrawer';
import { useIssueDrilldown } from '../features/workforce-stats/hooks/useIssueDrilldown';

type ApiError = { status?: number; message?: string }; // kept for sub-component compat

interface CostCenter {
  id: string;
  cost_center_code: string;
  cost_center_name: string;
  cost_type: string;
  gl_account?: string;
  description?: string;
}

interface CostCenterForm {
  costCenterCode: string;
  costCenterName: string;
  costType: string;
  glAccount: string;
  description: string;
}

export default function CostCenters() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [form, setForm] = useState<CostCenterForm>({
    costCenterCode: '',
    costCenterName: '',
    costType: 'department',
    glAccount: '',
    description: '',
  });
  const [ccStats, setCcStats] = useState<any[]>([]);
  const { drilldownState, openDrilldown, closeDrilldown } = useIssueDrilldown();
  const [missingCcCount, setMissingCcCount] = useState(0);

  const loadCostCenters = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.get('/api/enterprise/cost-centers');
      setCostCenters(response.data || []);
    } catch (err) {
      setCostCenters([]);
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCostCenters();
    fetchCostCenterStats().then(setCcStats).catch(() => {});
    fetchIssueCounts().then((c: any) => setMissingCcCount(c?.by_type?.MISSING_COST_CENTER ?? 0)).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!form.costCenterCode || !form.costCenterName) {
      setActionError('Please fill in all required fields');
      return;
    }

    try {
      setCreating(true);
      setActionError(null);
      await api.post('/api/enterprise/cost-centers', {
        cost_center_code: form.costCenterCode,
        cost_center_name: form.costCenterName,
        cost_type: form.costType,
        gl_account: form.glAccount || null,
        description: form.description || null,
      });
      closeModals();
      void loadCostCenters();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to create cost center');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingCenter || !form.costCenterCode || !form.costCenterName) {
      setActionError('Please fill in all required fields');
      return;
    }

    try {
      setUpdating(true);
      setActionError(null);
      await api.put(`/api/enterprise/cost-centers/${editingCenter.id}`, {
        cost_center_code: form.costCenterCode,
        cost_center_name: form.costCenterName,
        cost_type: form.costType,
        gl_account: form.glAccount || null,
        description: form.description || null,
      });
      closeModals();
      void loadCostCenters();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to update cost center');
    } finally {
      setUpdating(false);
    }
  };

  const openEditModal = (center: CostCenter) => {
    setEditingCenter(center);
    setForm({
      costCenterCode: center.cost_center_code,
      costCenterName: center.cost_center_name,
      costType: center.cost_type,
      glAccount: center.gl_account || '',
      description: center.description || '',
    });
  };

  const closeModals = () => {
    setShowModal(false);
    setEditingCenter(null);
    setForm({ costCenterCode: '', costCenterName: '', costType: 'department', glAccount: '', description: '' });
  };

  const handleDelete = async (costCenterId: string) => {
    if (!confirm('Are you sure you want to delete this cost center?')) return;

    try {
      setActionError(null);
      await api.delete(`/api/enterprise/cost-centers/${costCenterId}`);
      void loadCostCenters();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to delete cost center');
    }
  };

  const loadState = loadError ? classifyError(loadError) : null;
  const telemetryState = loading ? { kind: 'loading' as const } : loadState ?? { kind: 'ready' as const };
  usePageStateTelemetry('enterprise.costCenters', 'enterprise', telemetryState);

  if (loading) {
    return (
      <Page title="Cost Centers" subtitle="Manage departmental budgets and allocations">
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} />
          <p style={{ color: styles.colors.textSecondary }}>Loading cost centers...</p>
        </div>
        <style>{styles.spinKeyframes}</style>
      </Page>
    );
  }

  if (loadState && loadState.kind === 'blocked') {
    return (
      <Page title="Cost Centers" subtitle="Manage departmental budgets and allocations">
        <PageBlockedView code={loadState.code} message={loadState.message} page="enterprise.costCenters" module="enterprise" />
      </Page>
    );
  }
  if (loadState && loadState.kind === 'error') {
    return (
      <Page title="Cost Centers" subtitle="Manage departmental budgets and allocations">
        <PageErrorView message={loadState.message} retryable={loadState.retryable} onRetry={loadCostCenters} page="enterprise.costCenters" module="enterprise" />
      </Page>
    );
  }

  return (
    <Page
      title="Cost Centers"
      subtitle="Manage departmental budgets and allocations"
      actions={
        <button style={styles.buttonPrimary} onClick={() => setShowModal(true)} type="button">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Cost Center
        </button>
      }
    >
      <Stack gap={ui.space.lg}>
        {actionError && <Banner variant="error">{actionError}</Banner>}

        <StatStrip columns={5}>
          <StatCard
            label="Cost Centers"
            value={costCenters.length}
            color="#14b8a6"
          />
          <StatCard
            label="Active (In Use)"
            value={ccStats.filter((s: any) => s.isUsed).length}
            color="#22c55e"
          />
          <StatCard
            label="Unused"
            value={ccStats.filter((s: any) => !s.isUsed).length}
            color={ccStats.filter((s: any) => !s.isUsed).length > 0 ? '#f59e0b' : '#94a3b8'}
            onClick={missingCcCount > 0 ? () => openDrilldown({
              issueType: 'MISSING_COST_CENTER',
              title: 'Employees missing cost center',
              groupBy: 'orgUnit',
            }) : undefined}
            subtitle={missingCcCount > 0 ? `${missingCcCount} employees missing` : undefined}
          />
          <StatCard
            label="Total Employees"
            value={ccStats.reduce((sum: number, s: any) => sum + (s.employeesCount || 0), 0)}
            color="#6366f1"
          />
          <StatCard
            label="Types"
            value={new Set(costCenters.map((cc) => cc.cost_type)).size}
            color="#64748b"
          />
        </StatStrip>

        <Card>
          <CardHeader title="All Cost Centers" />
          <div style={{ padding: 0, overflow: 'hidden' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.tableHeaderCell}>Code</th>
                  <th style={styles.tableHeaderCell}>Name</th>
                  <th style={styles.tableHeaderCell}>Type</th>
                  <th style={styles.tableHeaderCell}>GL Account</th>
                  <th style={{ ...styles.tableHeaderCell, textAlign: 'right' }}>Employees</th>
                  <th style={{ ...styles.tableHeaderCell, textAlign: 'center' }}>Usage</th>
                  <th style={styles.tableHeaderCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {costCenters.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 0, verticalAlign: 'middle' }}>
                      <div style={{ padding: '2rem' }}>
                        <EmptyListState
                          title="No cost centers found"
                          description="Create a new cost center to start tracking budgets"
                          action={
                            <button style={styles.buttonPrimary} onClick={() => setShowModal(true)} type="button">
                              Add Cost Center
                            </button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ) : (
                  costCenters.map((cc, idx) => {
                    const stat = ccStats.find((s: any) => s.costCenterId === cc.id);
                    const usageBg = stat?.usageStatus === 'ACTIVE' ? '#dcfce7' : stat?.usageStatus === 'LOW_USAGE' ? '#fef9c3' : '#f1f5f9';
                    const usageFg = stat?.usageStatus === 'ACTIVE' ? '#166534' : stat?.usageStatus === 'LOW_USAGE' ? '#854d0e' : '#475569';
                    return (
                    <tr
                      key={cc.id}
                      className="cost-centers-row"
                      style={{
                        ...styles.tableRow,
                        borderBottom: idx === costCenters.length - 1 ? 'none' : undefined,
                      }}
                    >
                      <td style={{ ...styles.tableCell, fontFamily: 'monospace', fontSize: '0.8rem' }}>{cc.cost_center_code}</td>
                      <td style={{ ...styles.tableCell, fontWeight: 600 }}>{cc.cost_center_name}</td>
                      <td style={styles.tableCell}>
                        <span style={styles.badge('default')}>{cc.cost_type}</span>
                      </td>
                      <td style={{ ...styles.tableCell, fontFamily: 'monospace' }}>{cc.gl_account || '-'}</td>
                      <td style={{ ...styles.tableCell, textAlign: 'right' }}>{stat?.employeesCount ?? '—'}</td>
                      <td style={{ ...styles.tableCell, textAlign: 'center' }}>
                        {stat ? (
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: usageBg, color: usageFg }}>
                            {stat.usageStatus === 'ACTIVE' ? 'Active' : stat.usageStatus === 'LOW_USAGE' ? 'Low Usage' : 'Unused'}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={styles.tableCell}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            style={{ ...styles.buttonSecondary, padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                            onClick={() => openEditModal(cc)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            style={{ ...styles.buttonDanger, padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                            onClick={() => handleDelete(cc.id)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {(showModal || editingCenter) && (
          <div style={modalStyles.overlay} onClick={closeModals} role="dialog" aria-modal="true" aria-labelledby="cost-center-modal-title">
            <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
              <div style={modalStyles.header}>
                <h2 id="cost-center-modal-title" style={modalStyles.title}>
                  {editingCenter ? 'Edit Cost Center' : 'Add Cost Center'}
                </h2>
                <button style={modalStyles.closeBtn} onClick={closeModals} type="button" aria-label="Close">
                  ✕
                </button>
              </div>
              <div style={modalStyles.body}>
                <div style={modalStyles.row}>
                  <div style={modalStyles.field}>
                    <label style={modalStyles.label}>Cost Center Code *</label>
                    <input
                      type="text"
                      style={modalStyles.input}
                      placeholder="e.g. CC-005"
                      value={form.costCenterCode}
                      onChange={(e) => setForm({ ...form, costCenterCode: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div style={modalStyles.field}>
                    <label style={modalStyles.label}>Type</label>
                    <select
                      style={modalStyles.input}
                      value={form.costType}
                      onChange={(e) => setForm({ ...form, costType: e.target.value })}
                    >
                      <option value="department">Department</option>
                      <option value="project">Project</option>
                      <option value="location">Location</option>
                      <option value="product">Product</option>
                    </select>
                  </div>
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Cost Center Name *</label>
                  <input
                    type="text"
                    style={modalStyles.input}
                    placeholder="e.g. Operations Department"
                    value={form.costCenterName}
                    onChange={(e) => setForm({ ...form, costCenterName: e.target.value })}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>GL Account</label>
                  <input
                    type="text"
                    style={modalStyles.input}
                    placeholder="e.g. 5500"
                    value={form.glAccount}
                    onChange={(e) => setForm({ ...form, glAccount: e.target.value })}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Description</label>
                  <textarea
                    style={{ ...modalStyles.input, minHeight: '80px', resize: 'vertical' as const }}
                    placeholder="Brief description of this cost center..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>
              <div style={modalStyles.footer}>
                <button style={styles.buttonSecondary} onClick={closeModals} type="button">
                  Cancel
                </button>
                {editingCenter ? (
                  <button style={styles.buttonPrimary} onClick={handleUpdate} disabled={updating} type="button">
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                ) : (
                  <button style={styles.buttonPrimary} onClick={handleCreate} disabled={creating} type="button">
                    {creating ? 'Creating...' : 'Add Cost Center'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Stack>
      <style>{`.cost-centers-row:hover { background: ${styles.colors.background}; }`}</style>

      <IssueDrilldownDrawer
        open={drilldownState.open}
        onClose={closeDrilldown}
        issueType={drilldownState.issueType}
        title={drilldownState.title}
        groupBy={drilldownState.groupBy}
        onRefreshNeeded={() => {
          fetchCostCenterStats().then(setCcStats).catch(() => {});
          fetchIssueCounts().then((c: any) => setMissingCcCount(c?.by_type?.MISSING_COST_CENTER ?? 0)).catch(() => {});
        }}
      />
    </Page>
  );
}

const modalStyles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  container: {
    background: 'white',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '520px',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem',
    borderBottom: '1px solid #e2e8f0',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#1e293b',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.25rem',
    cursor: 'pointer',
    color: '#64748b',
  },
  body: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  row: {
    display: 'flex',
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    flex: 1,
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#374151',
  },
  input: {
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '0.875rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    padding: '1.5rem',
    borderTop: '1px solid #e2e8f0',
  },
};
