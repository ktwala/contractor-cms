import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, EmptyState, Stack, Grid, Banner } from '../ui/layout';
import { useAccess } from '../hooks/useAccess';

interface Employee {
  id: string;
  employee_no: string;
  first_name: string;
  last_name: string;
  national_id?: string;
  email?: string;
  status: string;
  hire_date: string;
  termination_date?: string | null;
}

interface LegalEntity {
  id: string;
  code: string;
  name: string;
  country: string;
}

interface PayGroup {
  id: string;
  name: string;
  legal_entity_id: string;
  frequency: string;
}

interface CreateEmployeeForm {
  employee_no: string;
  first_name: string;
  last_name: string;
  national_id: string;
  email: string;
  hire_date: string;
  status: string;
  add_employment: boolean;
  legal_entity_id: string;
  pay_group_id: string;
  job_title: string;
  effective_from: string;
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
    maxWidth: '560px',
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
  sectionTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#475569',
    marginTop: '0.5rem',
    marginBottom: '0.25rem',
  },
};

const lockIcon = (
  <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const peopleIcon = (
  <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default function Employees() {
  const { can } = useAccess();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbiddenAccess, setForbiddenAccess] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<CreateEmployeeForm>({
    employee_no: '',
    first_name: '',
    last_name: '',
    national_id: '',
    email: '',
    hire_date: today,
    status: 'ACTIVE',
    add_employment: true,
    legal_entity_id: '',
    pay_group_id: '',
    job_title: '',
    effective_from: today,
  });

  useEffect(() => { loadEmployees(); }, [searchQuery]);
  useEffect(() => {
    if (showModal) {
      loadLegalEntities();
      loadPayGroups();
    }
  }, [showModal]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setForbiddenAccess(false);
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      params.set('limit', '100');
      const response = await api.get(`/employees?${params.toString()}`);
      const data = response.data;
      setEmployees(data.items || []);
      setTotal(data.total ?? data.items?.length ?? 0);
      setStatusCounts(data.status_counts ?? {});
      setError(null);
    } catch (err: any) {
      console.error('Failed to load employees:', err);
      const status = err?.response?.status;
      setEmployees([]);
      setTotal(0);
      setStatusCounts({});
      if (status === 403) {
        setForbiddenAccess(true);
        setError(null);
      } else {
        setForbiddenAccess(false);
        setError(err.response?.data?.message || 'Failed to load employees');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadLegalEntities = async () => {
    try {
      const response = await api.get('/legal-entities');
      const items = response.data?.items ?? response.data ?? [];
      setLegalEntities(Array.isArray(items) ? items : []);
      if (items.length > 0 && !form.legal_entity_id) {
        setForm((f) => ({ ...f, legal_entity_id: items[0].id }));
      }
    } catch (err) {
      console.error('Failed to load legal entities:', err);
    }
  };

  const loadPayGroups = async () => {
    try {
      const params = form.legal_entity_id ? `?legal_entity_id=${form.legal_entity_id}` : '';
      const response = await api.get(`/pay-groups${params}`);
      const items = response.data?.items ?? response.data ?? [];
      setPayGroups(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Failed to load pay groups:', err);
    }
  };

  useEffect(() => {
    if (showModal && form.legal_entity_id) {
      loadPayGroups();
    }
  }, [form.legal_entity_id, showModal]);

  const handleCreate = async () => {
    if (!form.employee_no?.trim() || !form.first_name?.trim() || !form.last_name?.trim() || !form.hire_date) {
      setError('Please fill in Employee No, First Name, Last Name, and Hire Date');
      return;
    }
    if (form.add_employment && (!form.legal_entity_id || !form.effective_from)) {
      setError('When adding an employment, please select Legal Entity and Effective From date');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const employeePayload = {
        employee_no: form.employee_no.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        national_id: form.national_id?.trim() || undefined,
        email: form.email?.trim() || undefined,
        hire_date: form.hire_date,
        status: form.status,
      };
      const empRes = await api.post('/employees', employeePayload);
      const created = empRes.data;

      if (form.add_employment && form.legal_entity_id && form.effective_from) {
        const legalEntity = legalEntities.find((le) => le.id === form.legal_entity_id);
        await api.post(`/employees/${created.id}/employments`, {
          legal_entity_id: form.legal_entity_id,
          pay_group_id: form.pay_group_id || undefined,
          country: legalEntity?.country || 'ZA',
          job_title: form.job_title?.trim() || undefined,
          effective_from: form.effective_from,
        });
      }

      setShowModal(false);
      setForm({
        employee_no: '',
        first_name: '',
        last_name: '',
        national_id: '',
        email: '',
        hire_date: today,
        status: 'ACTIVE',
        add_employment: true,
        legal_entity_id: legalEntities[0]?.id || '',
        pay_group_id: '',
        job_title: '',
        effective_from: today,
      });
      loadEmployees();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to create employee';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setCreating(false);
    }
  };

  const activeCount = statusCounts.ACTIVE ?? 0;

  if (loading && employees.length === 0 && !forbiddenAccess) {
    return (
      <Page title="Employees" subtitle="Manage employee directory and lifecycle.">
        <Card>
          <div style={styles.loadingContainer}>
            <div style={styles.loadingSpinner} />
            <p style={{ color: styles.colors.textSecondary }}>Loading employees...</p>
          </div>
        </Card>
        <style>{styles.spinKeyframes}</style>
      </Page>
    );
  }

  if (forbiddenAccess) {
    return (
      <Page title="Employees" subtitle="Manage employee directory and lifecycle.">
        <EmptyState
          title="You don't have access to Employee Records"
          description="Contact your Tenant Admin if you need access to view or manage employees."
          icon={lockIcon}
        />
      </Page>
    );
  }

  return (
    <Page
      title="Employees"
      subtitle="Manage employee directory and lifecycle."
      actions={can('employee:write') ? (
        <button style={styles.buttonPrimary} onClick={() => setShowModal(true)} type="button">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Employee
        </button>
      ) : undefined}
    >
      {error && <Banner variant="error">{error}</Banner>}

      <Card>
        <CardHeader title="Overview" subtitle="Search and stats" />
        <Stack gap={16}>
          <Grid cols="1fr 1fr 1fr 1fr" gap={16}>
            {[
              { label: 'Total Employees', value: total, color: styles.colors.primary },
              { label: 'Active', value: activeCount, color: styles.colors.success },
              { label: 'Terminated', value: statusCounts.TERMINATED ?? 0, color: styles.colors.danger },
              { label: 'On Leave', value: statusCounts.ON_LEAVE ?? 0, color: styles.colors.warning },
            ].map((stat, i) => (
              <div key={i} style={{ borderTop: `3px solid ${stat.color}`, paddingTop: 8 }}>
                <p style={{ fontSize: 12, color: styles.colors.textMuted, marginBottom: 4 }}>{stat.label}</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: styles.colors.textPrimary }}>{stat.value}</p>
              </div>
            ))}
          </Grid>
          <input
            type="search"
            placeholder="Search by name, employee no, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...styles.formInput, maxWidth: 400 }}
          />
        </Stack>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: 24, borderBottom: `1px solid ${styles.colors.border}`, fontWeight: 800, fontSize: 16 }}>
          All Employees
        </div>
        <div style={{ overflow: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Employee No</th>
                <th style={styles.tableHeaderCell}>Name</th>
                <th style={styles.tableHeaderCell}>Email</th>
                <th style={styles.tableHeaderCell}>Hire Date</th>
                <th style={styles.tableHeaderCell}>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 0, verticalAlign: 'middle' }}>
                    <EmptyState
                      title="No employees found"
                      description={searchQuery ? 'Try a different search term' : 'Add your first employee to get started'}
                      icon={peopleIcon}
                      action={!searchQuery && can('employee:write') ? (
                        <button style={styles.buttonPrimary} onClick={() => setShowModal(true)} type="button">
                          Add Employee
                        </button>
                      ) : undefined}
                    />
                  </td>
                </tr>
              ) : (
                employees.map((emp, idx) => (
                  <tr
                    key={emp.id}
                    style={{ ...styles.tableRow, borderBottom: idx === employees.length - 1 ? 'none' : undefined }}
                  >
                    <td style={{ ...styles.tableCell, fontFamily: 'monospace', fontSize: 14 }}>{emp.employee_no}</td>
                    <td style={{ ...styles.tableCell, fontWeight: 600 }}>
                      <Link to={`/enterprise/employees/${emp.id}`} style={{ color: styles.colors.primary, textDecoration: 'none' }}>
                        {emp.first_name} {emp.last_name}
                      </Link>
                    </td>
                    <td style={{ ...styles.tableCell, color: styles.colors.textMuted }}>{emp.email || '-'}</td>
                    <td style={styles.tableCell}>{emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '-'}</td>
                    <td style={styles.tableCell}>
                      <span style={styles.badge(emp.status === 'ACTIVE' ? 'success' : emp.status === 'TERMINATED' ? 'danger' : 'warning')}>
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && (
        <div style={modalStyles.overlay} onClick={() => setShowModal(false)}>
          <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h2 style={modalStyles.title}>Add New Employee</h2>
              <button style={modalStyles.closeBtn} onClick={() => setShowModal(false)} type="button">✕</button>
            </div>
            <div style={modalStyles.body}>
              <div style={modalStyles.row}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Employee No *</label>
                  <input type="text" style={modalStyles.input} placeholder="e.g. HB-0001" value={form.employee_no} onChange={(e) => setForm({ ...form, employee_no: e.target.value })} />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Hire Date *</label>
                  <input type="date" style={modalStyles.input} value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
                </div>
              </div>
              <div style={modalStyles.row}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>First Name *</label>
                  <input type="text" style={modalStyles.input} placeholder="e.g. Thabo" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Last Name *</label>
                  <input type="text" style={modalStyles.input} placeholder="e.g. Mokoena" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div style={modalStyles.row}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>National ID</label>
                  <input type="text" style={modalStyles.input} placeholder="e.g. 9012015123456" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Email</label>
                  <input type="email" style={modalStyles.input} placeholder="employee@company.co.za" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div style={modalStyles.field}>
                <label style={{ ...modalStyles.label, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.add_employment} onChange={(e) => setForm({ ...form, add_employment: e.target.checked })} />
                  Add employment (assign to a legal entity)
                </label>
              </div>
              {form.add_employment && (
                <>
                  <p style={modalStyles.sectionTitle}>Employment Assignment</p>
                  <div style={modalStyles.row}>
                    <div style={modalStyles.field}>
                      <label style={modalStyles.label}>Legal Entity *</label>
                      <select style={{ ...modalStyles.input, ...styles.formSelect }} value={form.legal_entity_id} onChange={(e) => setForm({ ...form, legal_entity_id: e.target.value, pay_group_id: '' })}>
                        <option value="">Select...</option>
                        {legalEntities.map((le) => (
                          <option key={le.id} value={le.id}>{le.name} ({le.code})</option>
                        ))}
                      </select>
                    </div>
                    <div style={modalStyles.field}>
                      <label style={modalStyles.label}>Pay Group (optional — payroll)</label>
                      <select style={{ ...modalStyles.input, ...styles.formSelect }} value={form.pay_group_id} onChange={(e) => setForm({ ...form, pay_group_id: e.target.value })}>
                        <option value="">Not enrolled in payroll</option>
                        {payGroups.filter((pg) => !form.legal_entity_id || pg.legal_entity_id === form.legal_entity_id).map((pg) => (
                          <option key={pg.id} value={pg.id}>{pg.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={modalStyles.row}>
                    <div style={modalStyles.field}>
                      <label style={modalStyles.label}>Job Title</label>
                      <input type="text" style={modalStyles.input} placeholder="e.g. Software Engineer" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
                    </div>
                    <div style={modalStyles.field}>
                      <label style={modalStyles.label}>Effective From *</label>
                      <input type="date" style={modalStyles.input} value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={modalStyles.footer}>
              <button style={styles.buttonSecondary} onClick={() => setShowModal(false)} type="button">Cancel</button>
              <button style={styles.buttonPrimary} onClick={handleCreate} disabled={creating} type="button">
                {creating ? 'Creating...' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
