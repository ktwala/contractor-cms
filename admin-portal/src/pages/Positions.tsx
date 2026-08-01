import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner } from '../ui/layout';
import { classifyError } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageBlockedView, PageErrorView } from '../ui/PageStateViews';

interface Position {
  id: string;
  position_code: string;
  title: string;
  status: string;
  legal_entity_id: string;
  org_unit_id: string;
  org_unit: { id: string; code: string; name: string } | null;
  default_cost_center: { id: string; code: string; name: string } | null;
  current_occupant: { employee_id: string; employee_no: string; employee_name: string } | null;
  created_at: string;
  updated_at: string;
}

interface LegalEntity {
  id: string;
  code: string;
  name: string;
}

interface OrgUnit {
  id: string;
  code: string;
  name: string;
}

interface CostCenter {
  id: string;
  cost_center_code: string;
  cost_center_name: string;
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
    maxWidth: '480px',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #e2e8f0',
  },
  title: { fontSize: '1.125rem', fontWeight: 600, color: '#1e293b', margin: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' },
  body: { padding: '1.5rem', display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.375rem' },
  label: { fontSize: '0.875rem', fontWeight: 500, color: '#374151' },
  input: {
    padding: '0.625rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    padding: '1rem 1.5rem',
    borderTop: '1px solid #e2e8f0',
  },
};

export default function Positions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [filterLegalEntityId, setFilterLegalEntityId] = useState('');
  const [filterOrgUnitId, setFilterOrgUnitId] = useState('');
  const [filterOrgUnits, setFilterOrgUnits] = useState<OrgUnit[]>([]);
  const [filterStatus, setFilterStatus] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    legal_entity_id: '',
    org_unit_id: '',
    position_code: '',
    title: '',
    default_cost_center_id: '',
  });

  const loadLegalEntities = useCallback(async () => {
    try {
      const r = await api.get('/legal-entities?limit=200');
      const items = r.data?.items ?? r.data ?? [];
      setLegalEntities(Array.isArray(items) ? items : []);
    } catch {
      setLegalEntities([]);
    }
  }, []);

  const loadOrgUnits = useCallback(async (legalEntityId: string) => {
    if (!legalEntityId) {
      setOrgUnits([]);
      return;
    }
    try {
      const r = await api.get('/api/enterprise/org-units', { params: { legal_entity_id: legalEntityId } });
      const items = Array.isArray(r.data) ? r.data : r.data?.items ?? [];
      setOrgUnits(items);
    } catch {
      setOrgUnits([]);
    }
  }, []);

  const loadCostCenters = useCallback(async (legalEntityId: string) => {
    if (!legalEntityId) {
      setCostCenters([]);
      return;
    }
    try {
      const r = await api.get('/api/enterprise/cost-centers', { params: { legal_entity_id: legalEntityId } });
      const items = r.data?.items ?? r.data ?? [];
      setCostCenters(Array.isArray(items) ? items : []);
    } catch {
      setCostCenters([]);
    }
  }, []);

  const loadPositions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params: Record<string, string> = {};
      if (filterLegalEntityId) params.legal_entity_id = filterLegalEntityId;
      if (filterOrgUnitId) params.org_unit_id = filterOrgUnitId;
      if (filterStatus) params.status = filterStatus;
      const r = await api.get('/api/enterprise/positions', { params });
      setPositions(Array.isArray(r.data) ? r.data : []);
    } catch (err) {
      setPositions([]);
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [filterLegalEntityId, filterOrgUnitId, filterStatus]);

  useEffect(() => {
    void loadLegalEntities();
  }, [loadLegalEntities]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  useEffect(() => {
    void loadOrgUnits(form.legal_entity_id);
    void loadCostCenters(form.legal_entity_id);
  }, [form.legal_entity_id, loadOrgUnits, loadCostCenters]);

  useEffect(() => {
    if (!filterLegalEntityId) {
      setFilterOrgUnits([]);
      return;
    }
    api.get('/api/enterprise/org-units', { params: { legal_entity_id: filterLegalEntityId } })
      .then((r) => setFilterOrgUnits(Array.isArray(r.data) ? r.data : []))
      .catch(() => setFilterOrgUnits([]));
  }, [filterLegalEntityId]);

  const handleCreate = async () => {
    if (!form.legal_entity_id || !form.org_unit_id || !form.position_code?.trim() || !form.title?.trim()) {
      setActionError('Please fill in Legal Entity, Org Unit, Position Code, and Title.');
      return;
    }
    try {
      setCreating(true);
      setActionError(null);
      await api.post('/api/enterprise/positions', {
        legal_entity_id: form.legal_entity_id,
        org_unit_id: form.org_unit_id,
        position_code: form.position_code.trim(),
        title: form.title.trim(),
        default_cost_center_id: form.default_cost_center_id || null,
      });
      setShowCreateModal(false);
      setForm({ legal_entity_id: '', org_unit_id: '', position_code: '', title: '', default_cost_center_id: '' });
      void loadPositions();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to create position');
    } finally {
      setCreating(false);
    }
  };

  const handleFreeze = async (id: string) => {
    try {
      setActionError(null);
      await api.post(`/api/enterprise/positions/${id}/freeze`);
      void loadPositions();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to freeze position');
    }
  };

  const handleClose = async (id: string) => {
    if (!confirm('Close this position? It will no longer appear in active lists.')) return;
    try {
      setActionError(null);
      await api.post(`/api/enterprise/positions/${id}/close`);
      void loadPositions();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to close position');
    }
  };

  const orgUnitPath = (ou: { code: string; name: string } | null) => ou ? `${ou.name} (${ou.code})` : '—';

  const loadState = loadError ? classifyError(loadError) : null;
  const telemetryState = loading ? { kind: 'loading' as const } : loadState ?? { kind: 'ready' as const };
  usePageStateTelemetry('enterprise.positions', 'enterprise', telemetryState);

  if (loading && positions.length === 0) {
    return (
      <Page title="Positions" subtitle="Headcount slots in the organisation">
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} />
          <p style={{ color: styles.colors.textSecondary }}>Loading positions…</p>
        </div>
        <style>{styles.spinKeyframes}</style>
      </Page>
    );
  }

  if (loadState && loadState.kind === 'blocked') {
    return (
      <Page title="Positions" subtitle="Headcount slots in the organisation">
        <PageBlockedView code={loadState.code} message={loadState.message} page="enterprise.positions" module="enterprise" />
      </Page>
    );
  }
  if (loadState && loadState.kind === 'error') {
    return (
      <Page title="Positions" subtitle="Headcount slots in the organisation">
        <PageErrorView message={loadState.message} retryable={loadState.retryable} onRetry={loadPositions} page="enterprise.positions" module="enterprise" />
      </Page>
    );
  }

  return (
    <Page
      title="Positions"
      subtitle="Manage headcount slots (e.g. PAY-001 Payroll Officer). Vacant = ACTIVE with no occupant."
      actions={
        <button
          style={styles.buttonPrimary}
          onClick={() => {
            setForm({ legal_entity_id: filterLegalEntityId, org_unit_id: filterOrgUnitId, position_code: '', title: '', default_cost_center_id: '' });
            setShowCreateModal(true);
          }}
          type="button"
        >
          Create position
        </button>
      }
    >
      {actionError && <Banner variant="error">{actionError}</Banner>}

      <Card>
        <CardHeader title="Filters" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={modalStyles.field}>
            <label style={modalStyles.label}>Legal entity</label>
            <select
              style={{ ...modalStyles.input, ...styles.formSelect }}
              value={filterLegalEntityId}
              onChange={(e) => {
                setFilterLegalEntityId(e.target.value);
                setFilterOrgUnitId('');
              }}
            >
              <option value="">All</option>
              {legalEntities.map((le) => (
                <option key={le.id} value={le.id}>{le.name} ({le.code})</option>
              ))}
            </select>
          </div>
          <div style={modalStyles.field}>
            <label style={modalStyles.label}>Org unit</label>
            <select
              style={{ ...modalStyles.input, ...styles.formSelect }}
              value={filterOrgUnitId}
              onChange={(e) => setFilterOrgUnitId(e.target.value)}
            >
              <option value="">All</option>
              {filterOrgUnits.map((ou) => (
                <option key={ou.id} value={ou.id}>{ou.code} — {ou.name}</option>
              ))}
            </select>
          </div>
          <div style={modalStyles.field}>
            <label style={modalStyles.label}>Status</label>
            <select
              style={{ ...modalStyles.input, ...styles.formSelect }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="FROZEN">Frozen</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <button style={styles.buttonSecondary} onClick={() => void loadPositions()} type="button">
            Apply
          </button>
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: 24, borderBottom: `1px solid ${styles.colors.border}`, fontWeight: 600, fontSize: 16 }}>
          Positions
        </div>
        <div style={{ overflow: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Code</th>
                <th style={styles.tableHeaderCell}>Title</th>
                <th style={styles.tableHeaderCell}>Org unit</th>
                <th style={styles.tableHeaderCell}>Cost center</th>
                <th style={styles.tableHeaderCell}>Status</th>
                <th style={styles.tableHeaderCell}>Occupant</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...styles.emptyState, padding: '2rem' }}>
                    {filterLegalEntityId || filterOrgUnitId || filterStatus
                      ? 'No positions match the filters.'
                      : 'No positions yet. Create one to get started.'}
                  </td>
                </tr>
              ) : (
                positions.map((p) => (
                  <tr key={p.id} style={styles.tableRow}>
                    <td style={styles.tableCell}>{p.position_code}</td>
                    <td style={styles.tableCell}>{p.title}</td>
                    <td style={styles.tableCell}>{orgUnitPath(p.org_unit)}</td>
                    <td style={styles.tableCell}>
                      {p.default_cost_center ? `${p.default_cost_center.name} (${p.default_cost_center.code})` : '—'}
                    </td>
                    <td style={styles.tableCell}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '4px 8px',
                          borderRadius: 999,
                          background:
                            p.status === 'ACTIVE'
                              ? 'rgba(34,197,94,0.12)'
                              : p.status === 'FROZEN'
                                ? 'rgba(251,191,36,0.2)'
                                : 'rgba(148,163,184,0.2)',
                          color:
                            p.status === 'ACTIVE'
                              ? '#166534'
                              : p.status === 'FROZEN'
                                ? '#92400e'
                                : '#64748b',
                        }}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      {p.current_occupant ? (
                        p.current_occupant.employee_name
                      ) : (
                        <span
                          style={{
                            color: p.status === 'ACTIVE' ? '#ca8a04' : styles.colors.textMuted,
                            fontStyle: 'italic',
                            fontWeight: 500,
                          }}
                        >
                          Vacant
                        </span>
                      )}
                    </td>
                    <td style={styles.tableCell}>
                      {p.status === 'ACTIVE' && (
                        <>
                          <button
                            style={{ ...styles.buttonSecondary, padding: '4px 10px', fontSize: 12 }}
                            onClick={() => handleFreeze(p.id)}
                            type="button"
                          >
                            Freeze
                          </button>
                          {' '}
                          <button
                            style={{ ...styles.buttonSecondary, padding: '4px 10px', fontSize: 12 }}
                            onClick={() => handleClose(p.id)}
                            type="button"
                          >
                            Close
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showCreateModal && (
        <div style={modalStyles.overlay} onClick={() => !creating && setShowCreateModal(false)}>
          <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h2 style={modalStyles.title}>Create position</h2>
              <button style={modalStyles.closeBtn} onClick={() => !creating && setShowCreateModal(false)} type="button">×</button>
            </div>
            <div style={modalStyles.body}>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Legal entity *</label>
                <select
                  style={{ ...modalStyles.input, ...styles.formSelect }}
                  value={form.legal_entity_id}
                  onChange={(e) => setForm((f) => ({ ...f, legal_entity_id: e.target.value, org_unit_id: '' }))}
                  disabled={creating}
                >
                  <option value="">Select…</option>
                  {legalEntities.map((le) => (
                    <option key={le.id} value={le.id}>{le.name} ({le.code})</option>
                  ))}
                </select>
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Org unit *</label>
                <select
                  style={{ ...modalStyles.input, ...styles.formSelect }}
                  value={form.org_unit_id}
                  onChange={(e) => setForm((f) => ({ ...f, org_unit_id: e.target.value }))}
                  disabled={creating || !form.legal_entity_id}
                >
                  <option value="">Select…</option>
                  {orgUnits.map((ou) => (
                    <option key={ou.id} value={ou.id}>{ou.code} — {ou.name}</option>
                  ))}
                </select>
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Position code *</label>
                <input
                  style={modalStyles.input}
                  value={form.position_code}
                  onChange={(e) => setForm((f) => ({ ...f, position_code: e.target.value }))}
                  placeholder="e.g. PAY-001"
                  disabled={creating}
                />
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Title *</label>
                <input
                  style={modalStyles.input}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Payroll Officer"
                  disabled={creating}
                />
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Default cost center (optional)</label>
                <select
                  style={{ ...modalStyles.input, ...styles.formSelect }}
                  value={form.default_cost_center_id}
                  onChange={(e) => setForm((f) => ({ ...f, default_cost_center_id: e.target.value }))}
                  disabled={creating}
                >
                  <option value="">None</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>{cc.cost_center_code} — {cc.cost_center_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={modalStyles.footer}>
              <button style={styles.buttonSecondary} onClick={() => !creating && setShowCreateModal(false)} disabled={creating} type="button">Cancel</button>
              <button
                style={styles.buttonPrimary}
                onClick={handleCreate}
                disabled={creating || !form.legal_entity_id || !form.org_unit_id || !form.position_code?.trim() || !form.title?.trim()}
                type="button"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
