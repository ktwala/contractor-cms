import { useEffect, useState } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner, Stack, Grid } from '../ui/layout';
import { ForbiddenEmptyState, UnavailableEmptyState, EmptyListState } from '../ui/empty-states';
import { normalizeError } from '../ui/page-template';
import { ui } from '../ui/layout';

type ApiError = { status?: number; message?: string };

interface CompanyGroup {
  id: string;
  group_name: string;
  group_code: string;
  consolidation_currency: string;
}

interface CreateGroupForm {
  groupName: string;
  groupCode: string;
  consolidationCurrency: string;
}

export default function CompanyGroups() {
  const [groups, setGroups] = useState<CompanyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [forbiddenAccess, setForbiddenAccess] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CompanyGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [form, setForm] = useState<CreateGroupForm>({
    groupName: '',
    groupCode: '',
    consolidationCurrency: 'ZAR',
  });

  const loadGroups = async () => {
    setLoading(true);
    setError(null);
    setForbiddenAccess(false);
    setUnavailable(false);
    try {
      const response = await api.get('/api/enterprise/groups');
      setGroups(response.data || []);
    } catch (err: unknown) {
      const normalized = normalizeError(err);
      setGroups([]);
      if (normalized.status === 403) {
        setForbiddenAccess(true);
        setError(null);
        setUnavailable(false);
      } else if (normalized.status === 404 || normalized.status === 501) {
        setUnavailable(true);
        setForbiddenAccess(false);
        setError(null);
      } else {
        setError(normalized);
        setForbiddenAccess(false);
        setUnavailable(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGroups();
  }, []);

  const handleCreate = async () => {
    if (!form.groupName || !form.groupCode) {
      setError({ message: 'Please fill in all required fields' });
      return;
    }

    try {
      setCreating(true);
      setError(null);
      await api.post('/api/enterprise/groups', {
        group_name: form.groupName,
        group_code: form.groupCode,
        consolidation_currency: form.consolidationCurrency,
      });
      closeModals();
      void loadGroups();
    } catch (err: unknown) {
      const normalized = normalizeError(err);
      setError(normalized);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingGroup || !form.groupName || !form.groupCode) {
      setError({ message: 'Please fill in all required fields' });
      return;
    }

    try {
      setUpdating(true);
      setError(null);
      await api.put(`/api/enterprise/groups/${editingGroup.id}`, {
        group_name: form.groupName,
        group_code: form.groupCode,
        consolidation_currency: form.consolidationCurrency,
      });
      setEditingGroup(null);
      setForm({ groupName: '', groupCode: '', consolidationCurrency: 'ZAR' });
      void loadGroups();
    } catch (err: unknown) {
      const normalized = normalizeError(err);
      setError(normalized);
    } finally {
      setUpdating(false);
    }
  };

  const openEditModal = (group: CompanyGroup) => {
    setEditingGroup(group);
    setForm({
      groupName: group.group_name,
      groupCode: group.group_code,
      consolidationCurrency: group.consolidation_currency,
    });
  };

  const closeModals = () => {
    setShowModal(false);
    setEditingGroup(null);
    setForm({ groupName: '', groupCode: '', consolidationCurrency: 'ZAR' });
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;

    try {
      setError(null);
      await api.delete(`/api/enterprise/groups/${groupId}`);
      void loadGroups();
    } catch (err: unknown) {
      const normalized = normalizeError(err);
      setError(normalized);
    }
  };

  const canRetry = !loading && error != null && (error.status == null || error.status >= 500);

  if (loading) {
    return (
      <Page title="Company Groups" subtitle="Manage organizational structure across entities">
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} />
          <p style={{ color: styles.colors.textSecondary }}>Loading company groups...</p>
        </div>
        <style>{styles.spinKeyframes}</style>
      </Page>
    );
  }

  if (forbiddenAccess) {
    return (
      <Page title="Company Groups" subtitle="You don't have access to this feature.">
        <ForbiddenEmptyState feature="Company Groups" />
      </Page>
    );
  }

  if (unavailable) {
    return (
      <Page title="Company Groups" subtitle="This feature is not available for this tenant.">
        <UnavailableEmptyState feature="Company Groups" />
      </Page>
    );
  }

  if (error && (error.status == null || error.status >= 500)) {
    return (
      <Page
        title="Company Groups"
        subtitle="Something went wrong while loading this page."
        actions={
          <button
            onClick={() => void loadGroups()}
            disabled={!canRetry}
            style={{
              ...styles.buttonPrimary,
              opacity: canRetry ? 1 : 0.6,
              cursor: canRetry ? 'pointer' : 'not-allowed',
            }}
            type="button"
          >
            Retry
          </button>
        }
      >
        <Banner variant="error">
          {error.message ?? 'Failed to load company groups. Please try again.'}
        </Banner>
      </Page>
    );
  }

  return (
    <Page
      title="Company Groups"
      subtitle="Manage organizational structure across entities"
      actions={
        <button style={styles.buttonPrimary} onClick={() => setShowModal(true)} type="button">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Group
        </button>
      }
    >
      <Stack gap={ui.space.lg}>
        {error?.message && <Banner variant="error">{error.message}</Banner>}

        <p style={{ margin: 0, fontSize: 13, color: styles.colors.textMuted }}>
          Legal Entities can exist without a Company Group. Groups are optional and used for consolidated reporting.
        </p>

        <Grid cols={3} gap={ui.space.lg}>
          {[
            { label: 'Total Groups', value: groups.length, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: styles.colors.gradientAdmin },
            { label: 'Total Companies', value: '-', icon: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9', color: '#0ea5e9' },
            { label: 'Total Employees', value: '-', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: styles.colors.success },
          ].map((stat, i) => (
            <Card key={i}>
              <div style={{ padding: ui.space.lg }}>
                <div style={styles.flexStart}>
                  <div style={styles.iconContainer(stat.color)}>
                    <svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: styles.colors.textMuted }}>{stat.label}</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 700, color: styles.colors.textPrimary }}>{stat.value}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </Grid>

        <Card>
          <CardHeader title="All Company Groups" />
          <div style={{ padding: 0, overflow: 'hidden' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.tableHeaderCell}>Group Name</th>
                  <th style={styles.tableHeaderCell}>Code</th>
                  <th style={styles.tableHeaderCell}>Currency</th>
                  <th style={styles.tableHeaderCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 0, verticalAlign: 'middle' }}>
                      <div style={{ padding: '2rem' }}>
                        <EmptyListState
                          title="No company groups found"
                          description="Create a new group to get started with multi-company management"
                          action={
                            <button style={styles.buttonPrimary} onClick={() => setShowModal(true)} type="button">
                              Create Group
                            </button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ) : (
                  groups.map((group, idx) => (
                    <tr
                      key={group.id}
                      className="company-groups-row"
                      style={{
                        ...styles.tableRow,
                        borderBottom: idx === groups.length - 1 ? 'none' : undefined,
                      }}
                    >
                      <td style={{ ...styles.tableCell, fontWeight: 600 }}>{group.group_name}</td>
                      <td style={{ ...styles.tableCell, fontFamily: 'monospace', fontSize: '0.8rem' }}>{group.group_code}</td>
                      <td style={styles.tableCell}>{group.consolidation_currency}</td>
                      <td style={styles.tableCell}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            style={{ ...styles.buttonSecondary, padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                            onClick={() => openEditModal(group)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            style={{ ...styles.buttonDanger, padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                            onClick={() => handleDelete(group.id)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {(showModal || editingGroup) && (
          <div style={modalStyles.overlay} onClick={closeModals} role="dialog" aria-modal="true" aria-labelledby="company-group-modal-title">
            <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
              <div style={modalStyles.header}>
                <h2 id="company-group-modal-title" style={modalStyles.title}>
                  {editingGroup ? 'Edit Company Group' : 'Create Company Group'}
                </h2>
                <button style={modalStyles.closeBtn} onClick={closeModals} type="button" aria-label="Close">
                  ✕
                </button>
              </div>
              <div style={modalStyles.body}>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Group Name *</label>
                  <input
                    type="text"
                    style={modalStyles.input}
                    placeholder="e.g. North Region Operations"
                    value={form.groupName}
                    onChange={(e) => setForm({ ...form, groupName: e.target.value })}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Group Code *</label>
                  <input
                    type="text"
                    style={modalStyles.input}
                    placeholder="e.g. NR-OPS"
                    value={form.groupCode}
                    onChange={(e) => setForm({ ...form, groupCode: e.target.value.toUpperCase() })}
                  />
                </div>
                <div style={modalStyles.field}>
                  <label style={modalStyles.label}>Consolidation Currency</label>
                  <select
                    style={modalStyles.input}
                    value={form.consolidationCurrency}
                    onChange={(e) => setForm({ ...form, consolidationCurrency: e.target.value })}
                  >
                    <option value="ZAR">ZAR - South African Rand</option>
                    <option value="LSL">LSL - Lesotho Loti</option>
                  </select>
                </div>
              </div>
              <div style={modalStyles.footer}>
                <button style={styles.buttonSecondary} onClick={closeModals} type="button">
                  Cancel
                </button>
                {editingGroup ? (
                  <button style={styles.buttonPrimary} onClick={handleUpdate} disabled={updating} type="button">
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                ) : (
                  <button style={styles.buttonPrimary} onClick={handleCreate} disabled={creating} type="button">
                    {creating ? 'Creating...' : 'Create Group'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Stack>
      <style>{`.company-groups-row:hover { background: ${styles.colors.background}; }`}</style>
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
    maxWidth: '480px',
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
