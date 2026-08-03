import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import { Page, Card, CardHeader, TabsBar, Tab, Banner, Stack, Grid } from '../ui/layout';
import { fetchTeamSummary, fetchDirectReports, fetchTeamTree } from '../features/workforce-stats/api';

interface Employee {
  id: string;
  employee_no: string;
  first_name: string;
  last_name: string;
  email?: string;
  status: string;
  hire_date: string;
  termination_date?: string | null;
  department?: string | null;
  job_title?: string | null;
  manager_id?: string | null;
  manager_employee_no?: string | null;
  manager_name?: string | null;
}

interface AssignmentInfo {
  org_unit_id: string;
  org_unit: { id: string; code: string; name: string };
  cost_center_id: string | null;
  cost_center: { id: string; code: string; name: string } | null;
  position_id: string | null;
  position: { id: string; code: string; title: string } | null;
  effective_from: string;
  effective_to: string | null;
}

interface Employment {
  id: string;
  employee_id: string;
  legal_entity_id: string;
  pay_group_id: string | null;
  country: string;
  job_title?: string | null;
  cost_center?: string | null;
  employment_type: string;
  effective_from: string;
  effective_to?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  current_assignment?: AssignmentInfo | null;
  next_assignment?: AssignmentInfo | null;
}

interface LegalEntity {
  id: string;
  code: string;
  name: string;
  country: string;
}

interface PayGroup {
  id: string;
  code?: string;
  name: string;
  legal_entity_id: string;
}

interface OrgUnit {
  id: string;
  legal_entity_id: string;
  code: string;
  name: string;
  parent_org_unit_id: string | null;
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
    maxWidth: '640px',
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
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
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

const statusStyles = {
  statusActive: {
    background: '#dcfce7',
    color: '#166534',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  },
  statusTerminated: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  },
  statusOther: {
    background: '#f1f5f9',
    color: '#64748b',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  },
};

function TeamTreeNode({ node, depth }: { node: any; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ marginLeft: depth * 24, borderLeft: depth > 0 ? '2px solid #e2e8f0' : 'none', paddingLeft: depth > 0 ? 12 : 0 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: hasChildren ? 'pointer' : 'default' }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren && (
          <span style={{ fontSize: 10, color: styles.colors.textMuted, width: 12 }}>{expanded ? '▼' : '▶'}</span>
        )}
        {!hasChildren && <span style={{ width: 12 }} />}
        <Link
          to={`/enterprise/employees/${node.employeeId}`}
          style={{ color: styles.colors.primary, textDecoration: 'none', fontWeight: 500, fontSize: 13 }}
          onClick={(e) => e.stopPropagation()}
        >
          {node.name}
        </Link>
        <span style={{ fontSize: 11, color: styles.colors.textMuted }}>{node.jobTitle ?? ''}</span>
        {node.directReportsCount > 0 && (
          <span style={{ fontSize: 11, color: styles.colors.textSecondary, background: '#f1f5f9', padding: '1px 6px', borderRadius: 999 }}>
            {node.directReportsCount} reports · {node.teamSize} team
          </span>
        )}
      </div>
      {expanded && hasChildren && node.children.map((child: any) => (
        <TeamTreeNode key={child.employeeId} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function EmployeeDetail() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { can, canAny } = useAccess();
  const canWriteEmployee = can('employee:write');

  const [searchParams] = useSearchParams();

  const tabDefs = useMemo(() => {
    const defs: { key: string; label: string; badge?: string; visible: boolean }[] = [
      { key: 'overview', label: 'Overview', visible: canAny(['employee:read', 'employment:read']) },
      { key: 'employment', label: 'Employment', visible: can('employment:read') },
      { key: 'team', label: 'Team', visible: can('employee:read') },
      { key: 'lifecycle', label: 'Lifecycle', visible: can('employee:write') },
      { key: 'comp', label: 'Compensation', badge: 'Preview', visible: can('compensation:read') },
      { key: 'banktax', label: 'Bank & Tax', badge: 'Preview', visible: canAny(['bank_account:read', 'tax_profile:read']) },
      { key: 'activity', label: 'Activity', badge: 'Preview', visible: can('audit:events:read') },
    ];
    return defs.filter((t) => t.visible).map(({ badge, visible, ...t }) => ({ ...t, badge }));
  }, [can, canAny]);

  const initialTab = searchParams.get('tab') ?? 'overview';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  useEffect(() => {
    if (tabDefs.length === 0) return;
    if (!tabDefs.some((t) => t.key === activeTab)) {
      setActiveTab(tabDefs[0].key);
    }
  }, [tabDefs, activeTab]);

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [employments, setEmployments] = useState<Employment[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [forbiddenAccess, setForbiddenAccess] = useState(false);

  const [showAddEmployment, setShowAddEmployment] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [showMoverModal, setShowMoverModal] = useState(false);
  const [moverForm, setMoverForm] = useState({
    org_unit_id: '',
    cost_center_id: '',
    job_title: '',
    effective_from: '',
    notes: '',
  });
  const [moverSubmitting, setMoverSubmitting] = useState(false);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminationDate, setTerminationDate] = useState('');
  const [terminating, setTerminating] = useState(false);

  const [rehireOpen, setRehireOpen] = useState(false);
  const [rehireForm, setRehireForm] = useState({
    rehire_date: '',
    legal_entity_id: '',
    pay_group_id: '',
    org_unit_id: '',
    country: '',
    job_title: '',
    cost_center: '',
    employment_type: 'PERMANENT',
  });
  const [rehiring, setRehiring] = useState(false);

  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');
  const [managerSearchResults, setManagerSearchResults] = useState<Employee[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [savingManager, setSavingManager] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    hire_date: '',
    department: '',
    job_title: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Team tab state
  const [teamSummary, setTeamSummary] = useState<any>(null);
  const [directReports, setDirectReports] = useState<any[]>([]);
  const [teamTree, setTeamTree] = useState<any>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  const loadTeamData = useCallback(async () => {
    if (!employeeId) return;
    try {
      setTeamLoading(true);
      setTeamError(null);
      const [summary, reports, tree] = await Promise.all([
        fetchTeamSummary(employeeId),
        fetchDirectReports(employeeId),
        fetchTeamTree(employeeId, 3),
      ]);
      setTeamSummary(summary);
      setDirectReports(reports?.directReports ?? []);
      setTeamTree(tree?.node ?? null);
    } catch {
      setTeamError('Failed to load team data');
    } finally {
      setTeamLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (activeTab === 'team') void loadTeamData();
  }, [activeTab, loadTeamData]);

  const currentEmployment = useMemo(() => {
    const open = employments.find((e) => !e.effective_to);
    if (open) return open;
    return [...employments].sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0];
  }, [employments]);

  const [form, setForm] = useState({
    legal_entity_id: '',
    pay_group_id: '',
    org_unit_id: '',
    country: '',
    job_title: '',
    cost_center: '',
    employment_type: 'PERMANENT',
    effective_from: '',
    effective_to: '',
    notes: '',
  });

  const loadEmployee = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      setError(null);

      const [empRes, empHistRes, leRes, pgRes] = await Promise.all([
        api.get(`/employees/${employeeId}`),
        api.get(`/employees/${employeeId}/employments`),
        api.get('/legal-entities?limit=200'),
        api.get('/pay-groups?limit=200'),
      ]);

      const empData = empRes.data;
      const histItems: Employment[] = empHistRes.data?.items ?? empHistRes.data ?? [];

      setEmployee(empData);
      setEmployments(Array.isArray(histItems) ? histItems : []);

      const leItems = leRes.data?.items ?? leRes.data ?? [];
      const pgItems = pgRes.data?.items ?? pgRes.data ?? [];
      setLegalEntities(Array.isArray(leItems) ? leItems : []);
      setPayGroups(Array.isArray(pgItems) ? pgItems : []);

      const ce = histItems.find((e) => !e.effective_to) || histItems[0];
      const today = new Date().toISOString().slice(0, 10);

      setForm((prev) => ({
        ...prev,
        legal_entity_id: ce?.legal_entity_id ?? '',
        pay_group_id: ce?.pay_group_id ?? '',
        org_unit_id: '',
        country: ce?.country ?? '',
        job_title: ce?.job_title ?? empData?.job_title ?? '',
        cost_center: ce?.cost_center ?? '',
        employment_type: ce?.employment_type ?? 'PERMANENT',
        effective_from: today,
        effective_to: '',
        notes: '',
      }));
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      const status = err?.response?.status;
      if (status === 403) {
        setForbiddenAccess(true);
        setError(null);
      } else {
        setForbiddenAccess(false);
        setError(err?.response?.data?.message ?? 'Failed to load employee detail');
      }
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

  const legalEntityById = useMemo(() => {
    const m = new Map<string, LegalEntity>();
    legalEntities.forEach((le) => m.set(le.id, le));
    return m;
  }, [legalEntities]);

  const payGroupById = useMemo(() => {
    const m = new Map<string, PayGroup>();
    payGroups.forEach((pg) => m.set(pg.id, pg));
    return m;
  }, [payGroups]);

  const payGroupsForSelectedEntity = useMemo(() => {
    if (!form.legal_entity_id) return payGroups;
    return payGroups.filter((pg) => pg.legal_entity_id === form.legal_entity_id);
  }, [payGroups, form.legal_entity_id]);

  const payGroupsForRehireEntity = useMemo(() => {
    if (!rehireForm.legal_entity_id) return payGroups;
    return payGroups.filter((pg) => pg.legal_entity_id === rehireForm.legal_entity_id);
  }, [payGroups, rehireForm.legal_entity_id]);

  const onChange = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const onSelectLegalEntity = (leId: string) => {
    const le = legalEntityById.get(leId);
    setForm((p) => ({
      ...p,
      legal_entity_id: leId,
      country: le?.country ?? p.country,
      pay_group_id: '',
      org_unit_id: '',
    }));
  };

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

  useEffect(() => {
    void loadOrgUnits(form.legal_entity_id);
  }, [form.legal_entity_id, loadOrgUnits]);

  useEffect(() => {
    void loadOrgUnits(rehireForm.legal_entity_id);
  }, [rehireForm.legal_entity_id, loadOrgUnits]);

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

  const openMoverModal = () => {
    if (!currentEmployment) return;
    const today = new Date().toISOString().slice(0, 10);
    setMoverForm({
      org_unit_id: '',
      cost_center_id: '',
      job_title: currentEmployment.job_title ?? '',
      effective_from: today,
      notes: '',
    });
    void loadOrgUnits(currentEmployment.legal_entity_id);
    void loadCostCenters(currentEmployment.legal_entity_id);
    setShowMoverModal(true);
  };

  const submitMoverChange = async () => {
    if (!employeeId || !currentEmployment || !moverForm.org_unit_id || !moverForm.effective_from) return;

    try {
      setMoverSubmitting(true);
      setError(null);

      await api.post(`/employees/${employeeId}/employments`, {
        legal_entity_id: currentEmployment.legal_entity_id,
        pay_group_id: currentEmployment.pay_group_id || undefined,
        country: currentEmployment.country,
        org_unit_id: moverForm.org_unit_id,
        cost_center_id: moverForm.cost_center_id || undefined,
        job_title: moverForm.job_title || undefined,
        employment_type: currentEmployment.employment_type ?? 'PERMANENT',
        effective_from: moverForm.effective_from,
        notes: moverForm.notes || undefined,
      });

      const hist = await api.get(`/employees/${employeeId}/employments`);
      const items = hist.data?.items ?? hist.data ?? [];
      setEmployments(Array.isArray(items) ? items : []);
      setShowMoverModal(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to record transfer');
    } finally {
      setMoverSubmitting(false);
    }
  };

  const submitEmploymentChange = async () => {
    if (!employeeId) return;

    try {
      setSubmitting(true);
      setError(null);

      await api.post(`/employees/${employeeId}/employments`, {
        legal_entity_id: form.legal_entity_id,
        pay_group_id: form.pay_group_id || undefined,
        org_unit_id: form.org_unit_id,
        country: form.country,
        job_title: form.job_title || undefined,
        cost_center: form.cost_center || undefined,
        employment_type: form.employment_type,
        effective_from: form.effective_from,
        effective_to: form.effective_to || undefined,
        notes: form.notes || undefined,
      });

      const hist = await api.get(`/employees/${employeeId}/employments`);
      const items = hist.data?.items ?? hist.data ?? [];
      setEmployments(Array.isArray(items) ? items : []);
      setShowAddEmployment(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to add employment change');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTerminate = async () => {
    if (!employeeId || !terminationDate) return;
    try {
      setTerminating(true);
      setError(null);
      await api.patch(`/employees/${employeeId}`, {
        status: 'TERMINATED',
        termination_date: terminationDate,
      });
      setTerminateOpen(false);
      setTerminationDate('');
      await loadEmployee();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to terminate employee');
    } finally {
      setTerminating(false);
    }
  };

  const handleRehire = async () => {
    if (!employeeId || !rehireForm.rehire_date || !rehireForm.legal_entity_id || !rehireForm.country) return;
    try {
      setRehiring(true);
      setError(null);
      await api.patch(`/employees/${employeeId}`, {
        status: 'ACTIVE',
        termination_date: null,
      });
      await api.post(`/employees/${employeeId}/employments`, {
        legal_entity_id: rehireForm.legal_entity_id,
        pay_group_id: rehireForm.pay_group_id || undefined,
        org_unit_id: rehireForm.org_unit_id,
        country: rehireForm.country,
        job_title: rehireForm.job_title || undefined,
        cost_center: rehireForm.cost_center || undefined,
        employment_type: rehireForm.employment_type,
        effective_from: rehireForm.rehire_date,
      });
      setRehireOpen(false);
      setRehireForm({
        rehire_date: '',
        legal_entity_id: '',
        pay_group_id: '',
        org_unit_id: '',
        country: '',
        job_title: '',
        cost_center: '',
        employment_type: 'PERMANENT',
      });
      await loadEmployee();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to rehire employee');
    } finally {
      setRehiring(false);
    }
  };

  const searchManagers = async () => {
    if (!managerSearch.trim()) return;
    try {
      const res = await api.get(`/employees?limit=20&q=${encodeURIComponent(managerSearch)}`);
      const items = res.data?.items ?? res.data ?? [];
      setManagerSearchResults(Array.isArray(items) ? items.filter((e: Employee) => e.id !== employeeId) : []);
    } catch {
      setManagerSearchResults([]);
    }
  };

  const handleSaveManager = async () => {
    if (!employeeId || !selectedManagerId) return;
    try {
      setSavingManager(true);
      setError(null);
      await api.patch(`/employees/${employeeId}`, { manager_id: selectedManagerId });
      setManagerModalOpen(false);
      setManagerSearch('');
      setManagerSearchResults([]);
      setSelectedManagerId(null);
      await loadEmployee();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to update manager');
    } finally {
      setSavingManager(false);
    }
  };

  const handleClearManager = async () => {
    if (!employeeId) return;
    try {
      setSavingManager(true);
      setError(null);
      await api.patch(`/employees/${employeeId}`, { manager_id: null });
      setManagerModalOpen(false);
      await loadEmployee();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to clear manager');
    } finally {
      setSavingManager(false);
    }
  };

  const openEditModal = () => {
    if (!employee) return;
    setEditForm({
      first_name: employee.first_name ?? '',
      last_name: employee.last_name ?? '',
      email: employee.email ?? '',
      hire_date: employee.hire_date ? new Date(employee.hire_date).toISOString().slice(0, 10) : '',
      department: employee.department ?? '',
      job_title: employee.job_title ?? '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!employeeId || !editForm.first_name?.trim() || !editForm.last_name?.trim() || !editForm.hire_date) return;
    try {
      setSavingEdit(true);
      setError(null);
      await api.patch(`/employees/${employeeId}`, {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim() || null,
        hire_date: editForm.hire_date,
        department: editForm.department.trim() || null,
        job_title: editForm.job_title.trim() || null,
      });
      setShowEditModal(false);
      await loadEmployee();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to update employee');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <Page title="Employee" subtitle="Loading…">
        <Card>
          <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={{ color: styles.colors.textSecondary }}>Loading employee…</p>
          </div>
        </Card>
        <style>{styles.spinKeyframes}</style>
      </Page>
    );
  }

  if (!employee) {
    return (
      <Page
        title={forbiddenAccess ? "You don't have access to this employee" : 'Employee not found'}
        actions={<Link to="/enterprise/employees" style={{ color: styles.colors.primary, textDecoration: 'none', fontWeight: 500 }}>← Back to Employees</Link>}
      >
        <Card>
          {forbiddenAccess ? (
            <p style={{ color: styles.colors.textSecondary, margin: 0 }}>
              Contact your Tenant Admin if you need access to view or manage this employee.
            </p>
          ) : (
            error && <p style={{ color: styles.colors.danger, margin: 0 }}>{error}</p>
          )}
        </Card>
      </Page>
    );
  }

  const le = currentEmployment ? legalEntityById.get(currentEmployment.legal_entity_id) : undefined;
  const pg = currentEmployment?.pay_group_id ? payGroupById.get(currentEmployment.pay_group_id) : undefined;

  const statusStyle =
    employee.status === 'ACTIVE'
      ? statusStyles.statusActive
      : employee.status === 'TERMINATED'
        ? statusStyles.statusTerminated
        : statusStyles.statusOther;

  const pageTitle = (
    <>
      {employee.first_name} {employee.last_name}
      <span style={statusStyle}>{employee.status}</span>
    </>
  );

  const pageSubtitle = [employee.employee_no, employee.email ?? '—', currentEmployment && le ? le.name : null]
    .filter(Boolean)
    .join(' • ');

  const pageActions = (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {canWriteEmployee && (
        <button style={styles.buttonSecondary} onClick={openEditModal} type="button">
          Edit employee
        </button>
      )}
      {can('employment:write') && employee.status === 'ACTIVE' && (
        <>
          <button style={styles.buttonPrimary} onClick={() => setShowAddEmployment(true)} type="button">
            Add employment change
          </button>
          {currentEmployment && (
            <button style={styles.buttonSecondary} onClick={openMoverModal} type="button">
              Transfer (Mover)
            </button>
          )}
        </>
      )}
      {canWriteEmployee && employee.status === 'ACTIVE' && (
        <button style={styles.buttonDanger} onClick={() => setTerminateOpen(true)} type="button">Terminate</button>
      )}
      {canWriteEmployee && employee.status === 'TERMINATED' && (
        <button
          style={styles.buttonPrimary}
          onClick={() => { setRehireForm((p) => ({ ...p, rehire_date: new Date().toISOString().slice(0, 10) })); setRehireOpen(true); }}
          type="button"
        >
          Rehire
        </button>
      )}
      <button onClick={() => navigate(-1)} style={styles.buttonSecondary} type="button">← Back</button>
    </div>
  );

  return (
    <Page title={pageTitle} subtitle={pageSubtitle} actions={pageActions}>
      {error && <Banner variant="error">{error}</Banner>}

      {tabDefs.length > 0 && (
        <TabsBar>
          {tabDefs.map((t) => (
            <Tab key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)}>
              {t.label}
              {t.badge && <span style={{ marginLeft: 8, fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 999, color: styles.colors.textMuted }}>{t.badge}</span>}
            </Tab>
          ))}
        </TabsBar>
      )}

      {activeTab === 'overview' && (
        <Grid cols="1fr 1fr" gap={16}>
          <Stack gap={16}>
            <Card>
              <CardHeader title="Employee" />
              <div style={styles.grid2}>
                <div><div style={styles.formLabel}>Hire date</div><div style={{ color: styles.colors.textPrimary }}>{employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : '—'}</div></div>
                <div><div style={styles.formLabel}>Termination date</div><div style={{ color: styles.colors.textPrimary }}>{employee.termination_date ? new Date(employee.termination_date).toLocaleDateString() : '—'}</div></div>
                <div><div style={styles.formLabel}>Department</div><div style={{ color: styles.colors.textPrimary }}>{employee.department || currentEmployment?.current_assignment?.org_unit?.name || '—'}</div></div>
                <div><div style={styles.formLabel}>Job title</div><div style={{ color: styles.colors.textPrimary }}>{employee.job_title || currentEmployment?.job_title || currentEmployment?.current_assignment?.position?.title || '—'}</div></div>
              </div>
            </Card>
            <Card>
              <CardHeader title="Manager" />
              <div style={{ color: styles.colors.textPrimary }}>
                {employee.manager_name ? `${employee.manager_name}${employee.manager_employee_no ? ` (${employee.manager_employee_no})` : ''}` : '—'}
              </div>
            </Card>
          </Stack>
          <Stack gap={16}>
            <Card>
              <CardHeader title="Current employment" />
              {currentEmployment ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div><strong>Legal entity:</strong> {le ? `${le.name} (${le.code})` : currentEmployment.legal_entity_id}</div>
                  <div><strong>Pay group:</strong> {pg ? `${pg.name}${pg.code ? ` (${pg.code})` : ''}` : currentEmployment.pay_group_id || 'Not enrolled in payroll'}</div>
                  <div><strong>Org unit:</strong> {currentEmployment.current_assignment?.org_unit ? `${currentEmployment.current_assignment.org_unit.name} (${currentEmployment.current_assignment.org_unit.code})` : '—'}</div>
                  {currentEmployment.current_assignment?.position && (
                    <div><strong>Position:</strong> {currentEmployment.current_assignment.position.title} ({currentEmployment.current_assignment.position.code})</div>
                  )}
                  <div><strong>From:</strong> {new Date(currentEmployment.effective_from).toLocaleDateString()}</div>
                  <div><strong>To:</strong> {currentEmployment.effective_to ? new Date(currentEmployment.effective_to).toLocaleDateString() : 'Current'}</div>
                  {currentEmployment.next_assignment && (
                    <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1px solid ${styles.colors.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: styles.colors.textMuted, marginBottom: 4 }}>Planned change</div>
                      <div>→ {currentEmployment.next_assignment.org_unit?.name} ({currentEmployment.next_assignment.org_unit?.code}) from {new Date(currentEmployment.next_assignment.effective_from).toLocaleDateString()}</div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: styles.colors.textMuted, margin: 0 }}>No employment records yet.</p>
              )}
            </Card>
            <Card>
              <CardHeader title="At a glance" />
              <div style={styles.grid2}>
                <div><div style={styles.formLabel}>Hire date</div><div style={{ color: styles.colors.textPrimary }}>{employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : '—'}</div></div>
                <div><div style={styles.formLabel}>Pay group</div><div style={{ color: styles.colors.textPrimary }}>{pg ? pg.name : '—'}</div></div>
                <div><div style={styles.formLabel}>Org unit</div><div style={{ color: styles.colors.textPrimary }}>{currentEmployment?.current_assignment?.org_unit?.name ?? '—'}</div></div>
                <div><div style={styles.formLabel}>Job title</div><div style={{ color: styles.colors.textPrimary }}>{currentEmployment?.job_title || currentEmployment?.current_assignment?.position?.title || '—'}</div></div>
                {currentEmployment?.current_assignment?.position && (
                  <div><div style={styles.formLabel}>Position</div><div style={{ color: styles.colors.textPrimary }}>{currentEmployment.current_assignment.position.title} ({currentEmployment.current_assignment.position.code})</div></div>
                )}
                <div>
                  <div style={styles.formLabel}>
                    {currentEmployment?.current_assignment?.cost_center ? 'Cost center' : currentEmployment?.cost_center ? 'Legacy cost center' : 'Cost center'}
                  </div>
                  <div style={{ color: styles.colors.textPrimary }}>
                    {currentEmployment?.current_assignment?.cost_center?.name ?? currentEmployment?.cost_center ?? '—'}
                  </div>
                </div>
                <div><div style={styles.formLabel}>Status</div><div style={{ color: styles.colors.textPrimary }}>{employee.status}</div></div>
              </div>
            </Card>
          </Stack>
        </Grid>
      )}

      {activeTab === 'employment' && (
        <Stack gap={16}>
          <Card>
            <CardHeader title="Current employment" />
            {currentEmployment ? (
              <div style={styles.grid2}>
                <div><div style={styles.formLabel}>Legal entity</div><div style={{ color: styles.colors.textPrimary }}>{le ? `${le.name} (${le.code})` : currentEmployment.legal_entity_id}</div></div>
                <div><div style={styles.formLabel}>Pay group</div><div style={{ color: styles.colors.textPrimary }}>{pg ? `${pg.name}${pg.code ? ` (${pg.code})` : ''}` : currentEmployment.pay_group_id || 'Not enrolled in payroll'}</div></div>
                <div><div style={styles.formLabel}>Org unit</div><div style={{ color: styles.colors.textPrimary }}>{currentEmployment.current_assignment?.org_unit ? `${currentEmployment.current_assignment.org_unit.name} (${currentEmployment.current_assignment.org_unit.code})` : '—'}</div></div>
                {currentEmployment.current_assignment?.position && (
                  <div><div style={styles.formLabel}>Position</div><div style={{ color: styles.colors.textPrimary }}>{currentEmployment.current_assignment.position.title} ({currentEmployment.current_assignment.position.code})</div></div>
                )}
                <div><div style={styles.formLabel}>Job title</div><div style={{ color: styles.colors.textPrimary }}>{currentEmployment.job_title ?? '—'}</div></div>
                <div>
                  <div style={styles.formLabel}>
                    {currentEmployment.current_assignment?.cost_center ? 'Cost center' : currentEmployment.cost_center ? 'Legacy cost center' : 'Cost center'}
                  </div>
                  <div style={{ color: styles.colors.textPrimary }}>{currentEmployment.current_assignment?.cost_center?.name ?? currentEmployment.cost_center ?? '—'}</div>
                </div>
                <div><div style={styles.formLabel}>Effective from</div><div style={{ color: styles.colors.textPrimary }}>{new Date(currentEmployment.effective_from).toLocaleDateString()}</div></div>
                <div><div style={styles.formLabel}>Updated</div><div style={{ color: styles.colors.textPrimary }}>{currentEmployment.updated_at ? new Date(currentEmployment.updated_at).toLocaleString() : currentEmployment.created_at ? new Date(currentEmployment.created_at).toLocaleString() : '—'}</div></div>
              </div>
            ) : (
              <p style={{ color: styles.colors.textMuted, margin: 0 }}>No employment records yet.</p>
            )}
            {currentEmployment?.next_assignment && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${styles.colors.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: styles.colors.textMuted, marginBottom: 8 }}>Planned change</div>
                <div style={styles.grid2}>
                  <div><div style={styles.formLabel}>Org unit</div><div style={{ color: styles.colors.textPrimary }}>{currentEmployment.next_assignment.org_unit?.name} ({currentEmployment.next_assignment.org_unit?.code})</div></div>
                  <div><div style={styles.formLabel}>Effective from</div><div style={{ color: styles.colors.textPrimary }}>{new Date(currentEmployment.next_assignment.effective_from).toLocaleDateString()}</div></div>
                  {currentEmployment.next_assignment.cost_center && (
                    <div><div style={styles.formLabel}>Cost center</div><div style={{ color: styles.colors.textPrimary }}>{currentEmployment.next_assignment.cost_center.name} ({currentEmployment.next_assignment.cost_center.code})</div></div>
                  )}
                </div>
              </div>
            )}
          </Card>
          <Card style={{ padding: 0 }}>
            <div style={{ padding: 24, borderBottom: `1px solid ${styles.colors.border}`, fontWeight: 800, fontSize: 16 }}>Employment history</div>
            <div style={{ overflow: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.tableHeaderCell}>Legal entity</th>
                    <th style={styles.tableHeaderCell}>Pay group</th>
                    <th style={styles.tableHeaderCell}>Org unit</th>
                    <th style={styles.tableHeaderCell}>Position</th>
                    <th style={styles.tableHeaderCell}>Job title</th>
                    <th style={styles.tableHeaderCell}>From</th>
                    <th style={styles.tableHeaderCell}>To</th>
                    <th style={styles.tableHeaderCell}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {employments.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ ...styles.emptyState, padding: '2rem' }}>No employment history.</td>
                    </tr>
                  ) : (
                    employments.map((e) => {
                      const leRow = legalEntityById.get(e.legal_entity_id);
                      const pgRow = e.pay_group_id ? payGroupById.get(e.pay_group_id) : undefined;
                      return (
                        <tr key={e.id} style={styles.tableRow}>
                          <td style={styles.tableCell}>{leRow ? leRow.code : e.legal_entity_id}</td>
                          <td style={styles.tableCell}>{pgRow ? (pgRow.code ?? pgRow.name) : e.pay_group_id || 'Not enrolled'}</td>
                          <td style={styles.tableCell}>{e.current_assignment?.org_unit ? `${e.current_assignment.org_unit.code}` : '—'}</td>
                          <td style={styles.tableCell}>{e.current_assignment?.position ? `${e.current_assignment.position.title} (${e.current_assignment.position.code})` : '—'}</td>
                          <td style={styles.tableCell}>{e.job_title || e.current_assignment?.position?.title || '—'}</td>
                          <td style={styles.tableCell}>{new Date(e.effective_from).toLocaleDateString()}</td>
                          <td style={styles.tableCell}>{e.effective_to ? new Date(e.effective_to).toLocaleDateString() : 'Current'}</td>
                          <td style={styles.tableCell}>{e.updated_at ? new Date(e.updated_at).toLocaleString() : e.created_at ? new Date(e.created_at).toLocaleString() : '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </Stack>
      )}

      {activeTab === 'lifecycle' && (
        <Stack gap={16}>
          <Card>
            <CardHeader title="Lifecycle timeline" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ ...statusStyles.statusActive, padding: '4px 8px' }}>Hired</span>
                  <span style={{ color: styles.colors.textSecondary }}>{employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : '—'}</span>
                </div>
                {employments
                  .filter((e) => e.effective_to)
                  .sort((a, b) => (a.effective_from < b.effective_from ? -1 : 1))
                  .map((e) => {
                    const leRow = legalEntityById.get(e.legal_entity_id);
                    return (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Employment change</span>
                        <span style={{ color: styles.colors.textSecondary }}>
                          {new Date(e.effective_from).toLocaleDateString()} → {e.effective_to ? new Date(e.effective_to).toLocaleDateString() : 'Current'}
                          {leRow && ` • ${leRow.code}`}
                        </span>
                      </div>
                    );
                  })}
                {employee.status === 'TERMINATED' && employee.termination_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ ...statusStyles.statusTerminated, padding: '4px 8px' }}>Terminated</span>
                    <span style={{ color: styles.colors.textSecondary }}>{new Date(employee.termination_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
          </Card>
          <Card>
            <CardHeader title="Lifecycle actions" />
              <p style={{ color: styles.colors.textSecondary, margin: '0 0 1rem 0' }}>
                Joiner → Mover → Leaver. Transfer (org unit, cost center, job title), terminate, rehire, or change manager. These actions feed downstream IGA and access systems.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {employee.status === 'ACTIVE' && currentEmployment && can('employment:write') && (
                  <button style={styles.buttonSecondary} onClick={openMoverModal} type="button">Transfer (Mover)</button>
                )}
                {employee.status === 'ACTIVE' && (
                  <button style={styles.buttonDanger} onClick={() => setTerminateOpen(true)} type="button">Terminate Employee</button>
                )}
                {employee.status === 'TERMINATED' && (
                  <button
                    style={styles.buttonPrimary}
                    onClick={() => { setRehireForm((p) => ({ ...p, rehire_date: new Date().toISOString().slice(0, 10) })); setRehireOpen(true); }}
                    type="button"
                  >
                    Rehire Employee
                  </button>
                )}
                <div style={{ flex: '1 1 100%' }}>
                  <div style={styles.formLabel}>Manager</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ color: styles.colors.textPrimary }}>
                      {employee.manager_name ? `${employee.manager_name}${employee.manager_employee_no ? ` (${employee.manager_employee_no})` : ''}` : '—'}
                    </span>
                    <button style={styles.buttonSecondary} onClick={() => setManagerModalOpen(true)} type="button">Change Manager</button>
                  </div>
                </div>
              </div>
          </Card>
        </Stack>
      )}

      {activeTab === 'comp' && (
        <Card>
          <CardHeader title="Compensation" right={<span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>Coming soon</span>} />
            <p style={{ margin: '0 0 12px 0', color: styles.colors.textSecondary }}>This section will include:</p>
            <ul style={{ margin: 0, paddingLeft: 20, color: styles.colors.textSecondary }}>
              <li>Effective-dated salary history</li>
              <li>Allowance and deduction inputs</li>
              <li>Payroll calculation alignment</li>
            </ul>
        </Card>
      )}

      {activeTab === 'banktax' && (
        <Card>
          <CardHeader title="Bank & Tax" right={<span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>Coming soon</span>} />
            <p style={{ margin: '0 0 12px 0', color: styles.colors.textSecondary }}>This section will include:</p>
            <ul style={{ margin: 0, paddingLeft: 20, color: styles.colors.textSecondary }}>
              <li>Bank accounts (masked display)</li>
              <li>Tax profile and residency history</li>
              <li>Integration with payroll and SARS</li>
            </ul>
        </Card>
      )}

      {activeTab === 'activity' && (
        <Card>
          <CardHeader title="Activity" right={<span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>Coming soon</span>} />
            <p style={{ margin: '0 0 12px 0', color: styles.colors.textSecondary }}>This section will include:</p>
            <ul style={{ margin: 0, paddingLeft: 20, color: styles.colors.textSecondary }}>
              <li>Audit timeline of changes</li>
              <li>Who changed what and when</li>
              <li>Compliance and traceability</li>
            </ul>
        </Card>
      )}

      {activeTab === 'team' && (
        <Stack gap={16}>
          {teamLoading && <Card><p style={{ margin: 0, color: styles.colors.textMuted }}>Loading team data…</p></Card>}
          {teamError && <Banner variant="error">{teamError}</Banner>}

          {!teamLoading && teamSummary && (
            <>
              <Grid cols="1fr 1fr 1fr 1fr" gap={16}>
                <Card>
                  <div style={{ fontSize: 12, color: styles.colors.textMuted, marginBottom: 4 }}>Direct Reports</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: styles.colors.text }}>{teamSummary.directReportsCount}</div>
                </Card>
                <Card>
                  <div style={{ fontSize: 12, color: styles.colors.textMuted, marginBottom: 4 }}>Total Team</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: styles.colors.text }}>{teamSummary.totalTeamSize}</div>
                </Card>
                <Card>
                  <div style={{ fontSize: 12, color: styles.colors.textMuted, marginBottom: 4 }}>Levels Below</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: styles.colors.text }}>{teamSummary.levelsBelow}</div>
                </Card>
                <Card>
                  <div style={{ fontSize: 12, color: styles.colors.textMuted, marginBottom: 4 }}>Span of Control</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: styles.colors.text }}>{teamSummary.directReportsCount}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      background: teamSummary.spanWarning === 'OVER_THRESHOLD' ? '#fef2f2' : teamSummary.spanWarning === 'WATCH' ? '#fffbeb' : '#f0fdf4',
                      color: teamSummary.spanWarning === 'OVER_THRESHOLD' ? '#dc2626' : teamSummary.spanWarning === 'WATCH' ? '#d97706' : '#16a34a',
                    }}>
                      {teamSummary.spanWarning === 'OVER_THRESHOLD' ? 'Over threshold' : teamSummary.spanWarning === 'WATCH' ? 'Watch' : 'OK'}
                    </span>
                  </div>
                </Card>
              </Grid>

              {teamSummary.largestSpanInSubtree > 50 && (
                <Banner variant="warning">
                  Largest span in subtree: {teamSummary.largestSpanInSubtree} direct reports — may need restructuring
                </Banner>
              )}
            </>
          )}

          {!teamLoading && directReports.length > 0 && (
            <Card>
              <CardHeader title="Direct Reports" right={<span style={{ fontSize: 12, color: styles.colors.textMuted }}>{directReports.length} report(s)</span>} />
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th style={styles.tableHeaderCell}>Employee</th>
                      <th style={styles.tableHeaderCell}>Job Title</th>
                      <th style={styles.tableHeaderCell}>Org Unit</th>
                      <th style={styles.tableHeaderCell}>Direct Reports</th>
                      <th style={styles.tableHeaderCell}>Team Size</th>
                      <th style={styles.tableHeaderCell}>Span</th>
                      <th style={styles.tableHeaderCell}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directReports.map((dr: any) => (
                      <tr key={dr.employeeId} style={styles.tableRow}>
                        <td style={styles.tableCell}>
                          <Link to={`/enterprise/employees/${dr.employeeId}`} style={{ color: styles.colors.primary, textDecoration: 'none', fontWeight: 500 }}>
                            {dr.name}
                          </Link>
                          <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{dr.employeeNo}</div>
                        </td>
                        <td style={styles.tableCell}>{dr.jobTitle ?? '—'}</td>
                        <td style={styles.tableCell}>{dr.orgUnitName ?? '—'}</td>
                        <td style={styles.tableCell}>{dr.directReportsCount}</td>
                        <td style={styles.tableCell}>{dr.teamSize}</td>
                        <td style={styles.tableCell}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                            background: dr.spanWarning === 'OVER_THRESHOLD' ? '#fef2f2' : dr.spanWarning === 'WATCH' ? '#fffbeb' : '#f0fdf4',
                            color: dr.spanWarning === 'OVER_THRESHOLD' ? '#dc2626' : dr.spanWarning === 'WATCH' ? '#d97706' : '#16a34a',
                          }}>
                            {dr.spanWarning === 'OVER_THRESHOLD' ? 'Over' : dr.spanWarning === 'WATCH' ? 'Watch' : 'OK'}
                          </span>
                        </td>
                        <td style={styles.tableCell}>
                          <Link to={`/enterprise/employees/${dr.employeeId}?tab=team`} style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 12 }}>
                            View team
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {!teamLoading && directReports.length === 0 && !teamError && (
            <Card>
              <p style={{ margin: 0, color: styles.colors.textMuted }}>This employee has no direct reports.</p>
            </Card>
          )}

          {!teamLoading && teamTree && teamTree.children && teamTree.children.length > 0 && (
            <Card>
              <CardHeader title="Team Tree" right={<span style={{ fontSize: 12, color: styles.colors.textMuted }}>Up to 3 levels</span>} />
              <div style={{ padding: '0 8px 8px 0' }}>
                {teamTree.children.map((child: any) => (
                  <TeamTreeNode key={child.employeeId} node={child} depth={0} />
                ))}
              </div>
            </Card>
          )}
        </Stack>
      )}

      {tabDefs.length === 0 && (
        <Card>
          <p style={{ color: styles.colors.textMuted, margin: 0 }}>You don't have permission to view any sections of this employee.</p>
        </Card>
      )}

      {showAddEmployment && (
        <div style={modalStyles.overlay} onClick={() => !submitting && setShowAddEmployment(false)}>
          <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h2 style={modalStyles.title}>Add employment change</h2>
              <button style={modalStyles.closeBtn} onClick={() => !submitting && setShowAddEmployment(false)} type="button">
                ×
              </button>
            </div>

            <div style={modalStyles.body}>
              <div style={modalStyles.formRow}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Legal entity</label>
                  <select
                    style={{ ...modalStyles.input, ...styles.formSelect }}
                    value={form.legal_entity_id}
                    onChange={(e) => onSelectLegalEntity(e.target.value)}
                    disabled={submitting}
                  >
                    <option value="">Select legal entity…</option>
                    {legalEntities.map((leOpt) => (
                      <option key={leOpt.id} value={leOpt.id}>
                        {leOpt.name} ({leOpt.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Pay group (optional — payroll)</label>
                  <select
                    style={{ ...modalStyles.input, ...styles.formSelect }}
                    value={form.pay_group_id}
                    onChange={(e) => onChange('pay_group_id', e.target.value)}
                    disabled={submitting}
                  >
                    <option value="">Not enrolled in payroll</option>
                    {payGroupsForSelectedEntity.map((pgOpt) => (
                      <option key={pgOpt.id} value={pgOpt.id}>
                        {pgOpt.name} {pgOpt.code ? `(${pgOpt.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={modalStyles.formRow}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Org unit</label>
                  <select
                    style={{ ...modalStyles.input, ...styles.formSelect }}
                    value={form.org_unit_id}
                    onChange={(e) => onChange('org_unit_id', e.target.value)}
                    disabled={submitting}
                  >
                    <option value="">Select org unit…</option>
                    {orgUnits.map((ou) => (
                      <option key={ou.id} value={ou.id}>
                        {ou.code} — {ou.name}
                      </option>
                    ))}
                  </select>
                  <div style={{ color: styles.colors.textMuted, fontSize: '0.8rem', marginTop: 4 }}>
                    Required for reporting hierarchy
                  </div>
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Country</label>
                  <input
                    style={modalStyles.input}
                    value={form.country}
                    onChange={(e) => onChange('country', e.target.value)}
                    disabled={submitting}
                  />
                  <div style={{ color: styles.colors.textMuted, fontSize: '0.8rem', marginTop: 4 }}>
                    Tip: this must match the legal entity country.
                  </div>
                </div>

                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Employment type</label>
                  <select
                    style={{ ...modalStyles.input, ...styles.formSelect }}
                    value={form.employment_type}
                    onChange={(e) => onChange('employment_type', e.target.value)}
                    disabled={submitting}
                  >
                    <option value="PERMANENT">PERMANENT</option>
                    <option value="CONTRACT">CONTRACT</option>
                    <option value="CASUAL">CASUAL</option>
                  </select>
                </div>
              </div>

              <div style={modalStyles.formRow}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Job title</label>
                  <input
                    style={modalStyles.input}
                    value={form.job_title}
                    onChange={(e) => onChange('job_title', e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Cost center</label>
                  <input
                    style={modalStyles.input}
                    value={form.cost_center}
                    onChange={(e) => onChange('cost_center', e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div style={modalStyles.formRow}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Effective from</label>
                  <input
                    type="date"
                    style={modalStyles.input}
                    value={form.effective_from}
                    onChange={(e) => onChange('effective_from', e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Effective to (optional)</label>
                  <input
                    type="date"
                    style={modalStyles.input}
                    value={form.effective_to}
                    onChange={(e) => onChange('effective_to', e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Notes</label>
                <textarea
                  style={{ ...modalStyles.input, minHeight: 80 }}
                  value={form.notes}
                  onChange={(e) => onChange('notes', e.target.value)}
                  disabled={submitting}
                  rows={3}
                />
              </div>
            </div>

            <div style={modalStyles.footer}>
              <button
                style={styles.buttonSecondary}
                onClick={() => !submitting && setShowAddEmployment(false)}
                disabled={submitting}
                type="button"
              >
                Cancel
              </button>
              <button
                style={styles.buttonPrimary}
                onClick={submitEmploymentChange}
                disabled={submitting || !form.legal_entity_id || !form.org_unit_id || !form.country || !form.effective_from}
                type="button"
              >
                {submitting ? 'Saving…' : 'Save change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoverModal && currentEmployment && (
        <div style={modalStyles.overlay} onClick={() => !moverSubmitting && setShowMoverModal(false)}>
          <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h2 style={modalStyles.title}>Transfer (Mover)</h2>
              <button style={modalStyles.closeBtn} onClick={() => !moverSubmitting && setShowMoverModal(false)} type="button">
                ×
              </button>
            </div>

            <div style={modalStyles.body}>
              <p style={{ color: styles.colors.textSecondary, margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
                Record an effective-dated transfer: new org unit, cost center, or job title. This creates a new employment row and closes the current one. Legal entity and pay group stay the same.
              </p>

              <div style={{ ...modalStyles.field, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: styles.colors.textMuted, marginBottom: 4 }}>Current context (unchanged)</div>
                <div style={{ fontSize: 14, color: styles.colors.textPrimary }}>
                  {le?.name} ({le?.code}) · {pg?.name}
                </div>
              </div>

              <div style={modalStyles.formRow}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>New org unit</label>
                  <select
                    style={{ ...modalStyles.input, ...styles.formSelect }}
                    value={moverForm.org_unit_id}
                    onChange={(e) => setMoverForm((p) => ({ ...p, org_unit_id: e.target.value }))}
                    disabled={moverSubmitting}
                  >
                    <option value="">Select org unit…</option>
                    {orgUnits.map((ou) => (
                      <option key={ou.id} value={ou.id}>
                        {ou.code} — {ou.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Cost center (optional)</label>
                  <select
                    style={{ ...modalStyles.input, ...styles.formSelect }}
                    value={moverForm.cost_center_id}
                    onChange={(e) => setMoverForm((p) => ({ ...p, cost_center_id: e.target.value }))}
                    disabled={moverSubmitting}
                  >
                    <option value="">None</option>
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.cost_center_code} — {cc.cost_center_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={modalStyles.formRow}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Job title</label>
                  <input
                    style={modalStyles.input}
                    value={moverForm.job_title}
                    onChange={(e) => setMoverForm((p) => ({ ...p, job_title: e.target.value }))}
                    placeholder="e.g. Senior Engineer"
                    disabled={moverSubmitting}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Effective from</label>
                  <input
                    type="date"
                    style={modalStyles.input}
                    value={moverForm.effective_from}
                    onChange={(e) => setMoverForm((p) => ({ ...p, effective_from: e.target.value }))}
                    disabled={moverSubmitting}
                  />
                </div>
              </div>

              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Notes (optional)</label>
                <textarea
                  style={{ ...modalStyles.input, minHeight: 60 }}
                  value={moverForm.notes}
                  onChange={(e) => setMoverForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Internal transfer from Engineering to Product"
                  disabled={moverSubmitting}
                  rows={2}
                />
              </div>
            </div>

            <div style={modalStyles.footer}>
              <button
                style={styles.buttonSecondary}
                onClick={() => !moverSubmitting && setShowMoverModal(false)}
                disabled={moverSubmitting}
                type="button"
              >
                Cancel
              </button>
              <button
                style={styles.buttonPrimary}
                onClick={submitMoverChange}
                disabled={moverSubmitting || !moverForm.org_unit_id || !moverForm.effective_from}
                type="button"
              >
                {moverSubmitting ? 'Saving…' : 'Record transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {terminateOpen && (
        <div style={modalStyles.overlay} onClick={() => !terminating && setTerminateOpen(false)}>
          <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h2 style={modalStyles.title}>Terminate Employee</h2>
              <button style={modalStyles.closeBtn} onClick={() => !terminating && setTerminateOpen(false)} type="button">
                ×
              </button>
            </div>
            <div style={modalStyles.body}>
              <p style={{ color: styles.colors.textSecondary, marginBottom: '1rem' }}>
                This will set the employee status to TERMINATED and close their current employment.
              </p>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Termination date</label>
                <input
                  type="date"
                  style={modalStyles.input}
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  disabled={terminating}
                />
              </div>
            </div>
            <div style={modalStyles.footer}>
              <button style={styles.buttonSecondary} onClick={() => !terminating && setTerminateOpen(false)} disabled={terminating} type="button">
                Cancel
              </button>
              <button
                style={styles.buttonDanger}
                onClick={handleTerminate}
                disabled={!terminationDate || terminating}
                type="button"
              >
                {terminating ? 'Terminating…' : 'Confirm Termination'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rehireOpen && (
        <div style={modalStyles.overlay} onClick={() => !rehiring && setRehireOpen(false)}>
          <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h2 style={modalStyles.title}>Rehire Employee</h2>
              <button style={modalStyles.closeBtn} onClick={() => !rehiring && setRehireOpen(false)} type="button">
                ×
              </button>
            </div>
            <div style={modalStyles.body}>
              <p style={{ color: styles.colors.textSecondary, marginBottom: '1rem' }}>
                Restore the employee to ACTIVE status and create a new employment record.
              </p>
              <div style={modalStyles.formRow}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Rehire date</label>
                  <input
                    type="date"
                    style={modalStyles.input}
                    value={rehireForm.rehire_date}
                    onChange={(e) => setRehireForm((p) => ({ ...p, rehire_date: e.target.value }))}
                    disabled={rehiring}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Legal entity</label>
                  <select
                    style={{ ...modalStyles.input, ...styles.formSelect }}
                    value={rehireForm.legal_entity_id}
                    onChange={(e) => {
                      const le = legalEntityById.get(e.target.value);
                      setRehireForm((p) => ({
                        ...p,
                        legal_entity_id: e.target.value,
                        country: le?.country ?? p.country,
                        pay_group_id: '',
                        org_unit_id: '',
                      }));
                    }}
                    disabled={rehiring}
                  >
                    <option value="">Select legal entity…</option>
                    {legalEntities.map((leOpt) => (
                      <option key={leOpt.id} value={leOpt.id}>
                        {leOpt.name} ({leOpt.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={modalStyles.formRow}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Pay group (optional — payroll)</label>
                  <select
                    style={{ ...modalStyles.input, ...styles.formSelect }}
                    value={rehireForm.pay_group_id}
                    onChange={(e) => setRehireForm((p) => ({ ...p, pay_group_id: e.target.value }))}
                    disabled={rehiring}
                  >
                    <option value="">Not enrolled in payroll</option>
                    {payGroupsForRehireEntity.map((pgOpt) => (
                      <option key={pgOpt.id} value={pgOpt.id}>
                        {pgOpt.name} {pgOpt.code ? `(${pgOpt.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Org unit</label>
                  <select
                    style={{ ...modalStyles.input, ...styles.formSelect }}
                    value={rehireForm.org_unit_id}
                    onChange={(e) => setRehireForm((p) => ({ ...p, org_unit_id: e.target.value }))}
                    disabled={rehiring}
                  >
                    <option value="">Select org unit…</option>
                    {orgUnits.map((ou) => (
                      <option key={ou.id} value={ou.id}>
                        {ou.code} — {ou.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={modalStyles.formRow}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Country</label>
                  <input
                    style={modalStyles.input}
                    value={rehireForm.country}
                    onChange={(e) => setRehireForm((p) => ({ ...p, country: e.target.value }))}
                    disabled={rehiring}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Job title</label>
                  <input
                    style={modalStyles.input}
                    value={rehireForm.job_title}
                    onChange={(e) => setRehireForm((p) => ({ ...p, job_title: e.target.value }))}
                    disabled={rehiring}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Cost center</label>
                  <input
                    style={modalStyles.input}
                    value={rehireForm.cost_center}
                    onChange={(e) => setRehireForm((p) => ({ ...p, cost_center: e.target.value }))}
                    disabled={rehiring}
                  />
                </div>
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Employment type</label>
                <select
                  style={{ ...modalStyles.input, ...styles.formSelect }}
                  value={rehireForm.employment_type}
                  onChange={(e) => setRehireForm((p) => ({ ...p, employment_type: e.target.value }))}
                  disabled={rehiring}
                >
                  <option value="PERMANENT">PERMANENT</option>
                  <option value="CONTRACT">CONTRACT</option>
                  <option value="CASUAL">CASUAL</option>
                </select>
              </div>
            </div>
            <div style={modalStyles.footer}>
              <button style={styles.buttonSecondary} onClick={() => !rehiring && setRehireOpen(false)} disabled={rehiring} type="button">
                Cancel
              </button>
              <button
                style={styles.buttonPrimary}
                onClick={handleRehire}
                disabled={
                  rehiring ||
                  !rehireForm.rehire_date ||
                  !rehireForm.legal_entity_id ||
                  !rehireForm.org_unit_id ||
                  !rehireForm.country
                }
                type="button"
              >
                {rehiring ? 'Rehiring…' : 'Rehire'}
              </button>
            </div>
          </div>
        </div>
      )}

      {managerModalOpen && (
        <div style={modalStyles.overlay} onClick={() => !savingManager && setManagerModalOpen(false)}>
          <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h2 style={modalStyles.title}>Change Manager</h2>
              <button style={modalStyles.closeBtn} onClick={() => !savingManager && setManagerModalOpen(false)} type="button">
                ×
              </button>
            </div>
            <div style={modalStyles.body}>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Search employees</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    style={modalStyles.input}
                    value={managerSearch}
                    onChange={(e) => setManagerSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchManagers())}
                    placeholder="Type name or employee number…"
                    disabled={savingManager}
                  />
                  <button style={styles.buttonPrimary} onClick={searchManagers} disabled={savingManager || !managerSearch.trim()} type="button">
                    Search
                  </button>
                </div>
              </div>
              {managerSearchResults.length > 0 && (
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Select manager</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 200, overflowY: 'auto' }}>
                    {managerSearchResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        style={{
                          padding: '0.5rem 0.75rem',
                          textAlign: 'left',
                          borderRadius: 8,
                          border: selectedManagerId === m.id ? `2px solid ${styles.colors.primary}` : '1px solid #e2e8f0',
                          background: selectedManagerId === m.id ? '#eff6ff' : 'white',
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedManagerId(m.id)}
                      >
                        {m.first_name} {m.last_name} ({m.employee_no})
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {employee.manager_name && (
                <p style={{ marginTop: '1rem', color: styles.colors.textMuted, fontSize: '0.9rem' }}>
                  Current: {employee.manager_name}
                  {employee.manager_employee_no ? ` (${employee.manager_employee_no})` : ''}
                </p>
              )}
            </div>
            <div style={modalStyles.footer}>
              <button style={styles.buttonSecondary} onClick={() => !savingManager && setManagerModalOpen(false)} disabled={savingManager} type="button">
                Cancel
              </button>
              {employee.manager_id && (
                <button style={styles.buttonSecondary} onClick={handleClearManager} disabled={savingManager} type="button">
                  Clear Manager
                </button>
              )}
              <button
                style={styles.buttonPrimary}
                onClick={handleSaveManager}
                disabled={!selectedManagerId || savingManager}
                type="button"
              >
                {savingManager ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div style={modalStyles.overlay} onClick={() => !savingEdit && setShowEditModal(false)}>
          <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h2 style={modalStyles.title}>Edit employee</h2>
              <button style={modalStyles.closeBtn} onClick={() => !savingEdit && setShowEditModal(false)} type="button">
                ×
              </button>
            </div>
            <div style={modalStyles.body}>
              <div style={modalStyles.formRow}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>First name</label>
                  <input
                    style={modalStyles.input}
                    value={editForm.first_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, first_name: e.target.value }))}
                    placeholder="First name"
                    disabled={savingEdit}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Last name</label>
                  <input
                    style={modalStyles.input}
                    value={editForm.last_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, last_name: e.target.value }))}
                    placeholder="Last name"
                    disabled={savingEdit}
                  />
                </div>
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Email</label>
                <input
                  type="email"
                  style={modalStyles.input}
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@company.com"
                  disabled={savingEdit}
                />
              </div>
              <div style={modalStyles.formRow}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Hire date</label>
                  <input
                    type="date"
                    style={modalStyles.input}
                    value={editForm.hire_date}
                    onChange={(e) => setEditForm((p) => ({ ...p, hire_date: e.target.value }))}
                    disabled={savingEdit}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Department</label>
                  <input
                    style={modalStyles.input}
                    value={editForm.department}
                    onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))}
                    placeholder="e.g. Engineering"
                    disabled={savingEdit}
                  />
                </div>
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Job title</label>
                <input
                  style={modalStyles.input}
                  value={editForm.job_title}
                  onChange={(e) => setEditForm((p) => ({ ...p, job_title: e.target.value }))}
                  placeholder="e.g. Senior Engineer"
                  disabled={savingEdit}
                />
              </div>
            </div>
            <div style={modalStyles.footer}>
              <button
                style={styles.buttonSecondary}
                onClick={() => !savingEdit && setShowEditModal(false)}
                disabled={savingEdit}
                type="button"
              >
                Cancel
              </button>
              <button
                style={styles.buttonPrimary}
                onClick={handleSaveEdit}
                disabled={savingEdit || !editForm.first_name?.trim() || !editForm.last_name?.trim() || !editForm.hire_date}
                type="button"
              >
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
