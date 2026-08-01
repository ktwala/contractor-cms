import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner, Stack } from '../ui/layout';
import { classifyError } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageBlockedView, PageErrorView } from '../ui/PageStateViews';
import { useAccess } from '../hooks/useAccess';

type LegalEntity = { id: string; name: string; code: string };
type OrgUnit = { id: string; code: string; name: string };
type CostCenter = { id: string; cost_center_code: string; cost_center_name: string };
type Position = {
  id: string;
  position_code: string;
  title: string;
  default_cost_center?: { id: string; code: string; name: string } | null;
};

type Assignment = {
  id: string;
  org_unit_id: string;
  org_unit: { code: string; name: string };
  cost_center_id: string | null;
  cost_center: { code?: string; name?: string; cost_center_code?: string; cost_center_name?: string } | null;
  position_id?: string | null;
  position?: { id: string; code: string; title: string } | null;
  effective_from: string;
  effective_to: string | null;
};

type EmploymentWithAssignments = {
  id: string;
  employee_id: string;
  employee: { id: string; employee_no: string; first_name: string; last_name: string } | null;
  legal_entity: { id: string; code: string; name: string } | null;
  pay_group: { id: string; code: string; name: string } | null;
  job_title: string | null;
  effective_from: string;
  effective_to: string | null;
  assignments: Assignment[];
};

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
    borderRadius: 12,
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem',
    borderBottom: '1px solid #e2e8f0',
  },
  title: { fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', margin: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' },
  body: { padding: '1.5rem', display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
  label: { fontSize: '0.875rem', fontWeight: 500, color: '#374151' },
  input: {
    padding: '0.75rem',
    borderRadius: 8,
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
    padding: '1.5rem',
    borderTop: '1px solid #e2e8f0',
  },
};

export default function EmploymentAssignments() {
  const { can } = useAccess();
  const canWrite = can('employment:write');

  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [selectedLegalEntityId, setSelectedLegalEntityId] = useState<string>('');
  const [employments, setEmployments] = useState<EmploymentWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployment, setSelectedEmployment] = useState<EmploymentWithAssignments | null>(null);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [form, setForm] = useState({
    employment_id: '',
    org_unit_id: '',
    cost_center_id: '',
    position_id: '',
    effective_from: '',
    effective_to: '',
  });
  const [creating, setCreating] = useState(false);

  const loadLegalEntities = useCallback(async () => {
    try {
      const r = await api.get('/legal-entities', { params: { limit: 200 } });
      const items = r.data?.items ?? r.data ?? [];
      const list = Array.isArray(items) ? items : [];
      setLegalEntities(list);
      if (list.length > 0 && !selectedLegalEntityId) {
        setSelectedLegalEntityId(list[0].id);
      }
    } catch {
      setLegalEntities([]);
    }
  }, [selectedLegalEntityId]);

  const loadEmployments = useCallback(async () => {
    if (!selectedLegalEntityId) {
      setEmployments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const r = await api.get('/api/enterprise/employment-assignments/list', {
        params: { legal_entity_id: selectedLegalEntityId },
      });
      setEmployments(Array.isArray(r.data) ? r.data : []);
    } catch (err) {
      setEmployments([]);
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [selectedLegalEntityId]);

  const loadOrgUnits = useCallback(async (legalEntityId: string) => {
    if (!legalEntityId) {
      setOrgUnits([]);
      return;
    }
    try {
      const r = await api.get('/api/enterprise/org-units', { params: { legal_entity_id: legalEntityId } });
      setOrgUnits(Array.isArray(r.data) ? r.data : []);
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
      const data = r.data?.items ?? r.data ?? [];
      setCostCenters(Array.isArray(data) ? data : []);
    } catch {
      setCostCenters([]);
    }
  }, []);

  const loadPositions = useCallback(async (legalEntityId: string, orgUnitId: string) => {
    if (!legalEntityId || !orgUnitId) {
      setPositions([]);
      return;
    }
    try {
      const r = await api.get('/api/enterprise/positions', {
        params: { legal_entity_id: legalEntityId, org_unit_id: orgUnitId, status: 'ACTIVE' },
      });
      setPositions(Array.isArray(r.data) ? r.data : []);
    } catch {
      setPositions([]);
    }
  }, []);

  useEffect(() => {
    void loadLegalEntities();
  }, [loadLegalEntities]);

  useEffect(() => {
    void loadEmployments();
  }, [loadEmployments]);

  useEffect(() => {
    if (showAddModal && selectedEmployment && form.org_unit_id) {
      void loadPositions(selectedEmployment.legal_entity?.id ?? selectedLegalEntityId, form.org_unit_id);
    } else {
      setPositions([]);
    }
  }, [showAddModal, selectedEmployment, form.org_unit_id, selectedLegalEntityId, loadPositions]);

  // Auto-fill cost center from position's default when position is selected and cost center is empty
  useEffect(() => {
    if (form.position_id && !form.cost_center_id && positions.length > 0) {
      const pos = positions.find((p) => p.id === form.position_id);
      if (pos?.default_cost_center?.id) {
        setForm((prev) => ({ ...prev, cost_center_id: pos.default_cost_center!.id }));
      }
    }
  }, [form.position_id, form.cost_center_id, positions]);

  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  const openAddModal = (emp: EmploymentWithAssignments, existingAssignment?: Assignment) => {
    const today = new Date().toISOString().slice(0, 10);
    setSelectedEmployment(emp);
    setEditingAssignment(existingAssignment ?? null);

    if (existingAssignment) {
      setForm({
        employment_id: emp.id,
        org_unit_id: existingAssignment.org_unit_id,
        cost_center_id: existingAssignment.cost_center_id ?? '',
        position_id: existingAssignment.position_id ?? '',
        effective_from: existingAssignment.effective_from?.slice(0, 10) ?? today,
        effective_to: existingAssignment.effective_to?.slice(0, 10) ?? '',
      });
    } else {
      setForm({
        employment_id: emp.id,
        org_unit_id: '',
        cost_center_id: '',
        position_id: '',
        effective_from: today,
        effective_to: '',
      });
    }
    setPositions([]);
    void loadOrgUnits(emp.legal_entity?.id ?? selectedLegalEntityId);
    void loadCostCenters(emp.legal_entity?.id ?? selectedLegalEntityId);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!form.employment_id || !form.org_unit_id || !form.effective_from) {
      setActionError('Employment, org unit, and effective from are required.');
      return;
    }
    try {
      setCreating(true);
      setActionError(null);
      const payload = {
        employment_id: form.employment_id,
        org_unit_id: form.org_unit_id,
        cost_center_id: form.cost_center_id || null,
        position_id: form.position_id || null,
        effective_from: form.effective_from,
        effective_to: form.effective_to || null,
      };
      if (editingAssignment) {
        await api.patch(`/api/enterprise/employment-assignments/${editingAssignment.id}`, payload);
      } else {
        await api.post('/api/enterprise/employment-assignments', payload);
      }
      setShowAddModal(false);
      setSelectedEmployment(null);
      setEditingAssignment(null);
      void loadEmployments();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to save assignment');
    } finally {
      setCreating(false);
    }
  };

  const loadState = loadError ? classifyError(loadError) : null;
  const telemetryState = loading ? { kind: 'loading' as const } : loadState ?? { kind: 'ready' as const };
  usePageStateTelemetry('enterprise.employmentAssignments', 'enterprise', telemetryState);

  if (loading && employments.length === 0) {
    return (
      <Page title="Employment Assignments" subtitle="Effective-dated org + cost allocation for each employment.">
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} />
          <p style={{ color: styles.colors.textSecondary }}>Loading...</p>
        </div>
        <style>{styles.spinKeyframes}</style>
      </Page>
    );
  }

  if (loadState && loadState.kind === 'blocked') {
    return (
      <Page title="Employment Assignments" subtitle="Effective-dated org + cost allocation for each employment.">
        <PageBlockedView code={loadState.code} message={loadState.message} page="enterprise.employmentAssignments" module="enterprise" />
      </Page>
    );
  }
  if (loadState && loadState.kind === 'error') {
    return (
      <Page title="Employment Assignments" subtitle="Effective-dated org + cost allocation for each employment.">
        <PageErrorView message={loadState.message} retryable={loadState.retryable} onRetry={loadEmployments} page="enterprise.employmentAssignments" module="enterprise" />
      </Page>
    );
  }

  return (
    <Page
      title="Employment Assignments"
      subtitle="Effective-dated org + cost allocation for each employment."
      actions={
        <select
          value={selectedLegalEntityId}
          onChange={(e) => setSelectedLegalEntityId(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${styles.colors.border}`,
            fontSize: 14,
            minWidth: 220,
          }}
        >
          <option value="">Select legal entity...</option>
          {legalEntities.map((le) => (
            <option key={le.id} value={le.id}>
              {le.name} ({le.code})
            </option>
          ))}
        </select>
      }
    >
      {actionError && <Banner variant="error">{actionError}</Banner>}

      <Card>
        <CardHeader
          title="Employments & assignments"
          right={
            <span style={{ fontSize: 13, color: styles.colors.textMuted }}>
              Org unit (required) · Cost center (recommended) · No overlapping dates per employment
            </span>
          }
        />
        {!selectedLegalEntityId ? (
          <p style={{ color: styles.colors.textMuted, margin: 0, padding: 24 }}>
            Select a legal entity to view employments and their assignments.
          </p>
        ) : employments.length === 0 ? (
          <p style={{ color: styles.colors.textMuted, margin: 0, padding: 24 }}>
            No employments found for this legal entity. Create employments from the{' '}
            <Link to="/enterprise/employees" style={{ color: styles.colors.primary }}>
              Employees
            </Link>{' '}
            page.
          </p>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.tableHeaderCell}>Employee</th>
                  <th style={styles.tableHeaderCell}>Employment</th>
                  <th style={styles.tableHeaderCell}>Assignments (org unit · cost center)</th>
                  {canWrite && <th style={styles.tableHeaderCell}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {employments.map((emp) => (
                  <tr key={emp.id} style={styles.tableRow}>
                    <td style={styles.tableCell}>
                      {emp.employee ? (
                        <Link
                          to={`/enterprise/employees/${emp.employee_id}`}
                          style={{ color: styles.colors.primary, textDecoration: 'none', fontWeight: 500 }}
                        >
                          {emp.employee.first_name} {emp.employee.last_name}
                        </Link>
                      ) : (
                        '—'
                      )}
                      {emp.employee && (
                        <div style={{ fontSize: 12, color: styles.colors.textMuted }}>{emp.employee.employee_no}</div>
                      )}
                    </td>
                    <td style={styles.tableCell}>
                      <div>
                        {emp.effective_from} → {emp.effective_to ?? 'Current'}
                      </div>
                      {emp.job_title && (
                        <div style={{ fontSize: 12, color: styles.colors.textMuted }}>{emp.job_title}</div>
                      )}
                      {emp.pay_group && (
                        <div style={{ fontSize: 12, color: styles.colors.textMuted }}>{emp.pay_group.name}</div>
                      )}
                    </td>
                    <td style={styles.tableCell}>
                      {emp.assignments.length === 0 ? (
                        <span style={{ color: styles.colors.textMuted }}>No assignments</span>
                      ) : (
                        <Stack gap={8}>
                          {emp.assignments.map((a) => (
                            <div
                              key={a.id}
                              style={{
                                padding: '6px 10px',
                                background: '#f8fafc',
                                borderRadius: 6,
                                fontSize: 13,
                              }}
                            >
                              <strong>{a.org_unit?.name ?? a.org_unit?.code ?? '—'}</strong>
                              {a.cost_center &&
                                ` · ${a.cost_center.name ?? a.cost_center.cost_center_name ?? a.cost_center.code ?? a.cost_center.cost_center_code ?? '—'}`}
                              <span style={{ color: styles.colors.textMuted, marginLeft: 8 }}>
                                {a.effective_from} → {a.effective_to ?? 'Current'}
                              </span>
                            </div>
                          ))}
                        </Stack>
                      )}
                    </td>
                    {canWrite && (
                      <td style={styles.tableCell}>
                        {emp.assignments.length > 0 ? (
                          <Stack gap={6}>
                            {emp.assignments.map((a) => (
                              <button
                                key={a.id}
                                style={styles.buttonSecondary}
                                onClick={() => openAddModal(emp, a)}
                                type="button"
                              >
                                Edit assignment
                              </button>
                            ))}
                          </Stack>
                        ) : (
                          <button
                            style={styles.buttonSecondary}
                            onClick={() => openAddModal(emp)}
                            type="button"
                          >
                            Add assignment
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAddModal && selectedEmployment && (
        <div style={modalStyles.overlay} onClick={() => !creating && setShowAddModal(false)}>
          <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h2 style={modalStyles.title}>{editingAssignment ? 'Edit assignment' : 'Add assignment'}</h2>
              <button style={modalStyles.closeBtn} onClick={() => !creating && setShowAddModal(false)} type="button">
                ×
              </button>
            </div>
            <div style={modalStyles.body}>
              <div
                style={{
                  padding: 12,
                  background: '#f8fafc',
                  borderRadius: 8,
                  fontSize: 13,
                  color: styles.colors.textSecondary,
                }}
              >
                <strong>Employment:</strong>{' '}
                {selectedEmployment.employee
                  ? `${selectedEmployment.employee.first_name} ${selectedEmployment.employee.last_name} (${selectedEmployment.employee.employee_no})`
                  : selectedEmployment.id}
                {' · '}
                {selectedEmployment.effective_from} → {selectedEmployment.effective_to ?? 'Current'}
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Org unit (required)</label>
                <select
                  style={{ ...modalStyles.input, ...styles.formSelect }}
                  value={form.org_unit_id}
                  onChange={(e) => setForm((p) => ({ ...p, org_unit_id: e.target.value, position_id: '' }))}
                  disabled={creating}
                >
                  <option value="">Select org unit...</option>
                  {orgUnits.map((ou) => (
                    <option key={ou.id} value={ou.id}>
                      {ou.code} — {ou.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Position (optional)</label>
                <select
                  style={{ ...modalStyles.input, ...styles.formSelect }}
                  value={form.position_id}
                  onChange={(e) => setForm((p) => ({ ...p, position_id: e.target.value }))}
                  disabled={creating || !form.org_unit_id}
                >
                  <option value="">None</option>
                  {positions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.position_code} — {pos.title}
                    </option>
                  ))}
                </select>
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Cost center (optional)</label>
                <select
                  style={{ ...modalStyles.input, ...styles.formSelect }}
                  value={form.cost_center_id}
                  onChange={(e) => setForm((p) => ({ ...p, cost_center_id: e.target.value }))}
                  disabled={creating}
                >
                  <option value="">None</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.cost_center_code} — {cc.cost_center_name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Effective from</label>
                  <input
                    type="date"
                    style={modalStyles.input}
                    value={form.effective_from}
                    onChange={(e) => setForm((p) => ({ ...p, effective_from: e.target.value }))}
                    disabled={creating}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Effective to (optional)</label>
                  <input
                    type="date"
                    style={modalStyles.input}
                    value={form.effective_to}
                    onChange={(e) => setForm((p) => ({ ...p, effective_to: e.target.value }))}
                    disabled={creating}
                  />
                </div>
              </div>
            </div>
            <div style={modalStyles.footer}>
              <button
                style={styles.buttonSecondary}
                onClick={() => !creating && setShowAddModal(false)}
                disabled={creating}
                type="button"
              >
                Cancel
              </button>
              <button
                style={styles.buttonPrimary}
                onClick={handleSave}
                disabled={creating || !form.org_unit_id || !form.effective_from}
                type="button"
              >
                {creating
                  ? (editingAssignment ? 'Saving...' : 'Creating...')
                  : (editingAssignment ? 'Save changes' : 'Add assignment')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
