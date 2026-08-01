import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, ui } from '../ui/layout';
import { ForbiddenEmptyState, UnavailableEmptyState } from '../ui/empty-states';
import { useAccess } from '../hooks/useAccess';
import { fetchLegalEntityStats } from '../features/workforce-stats/api';
import { StatCard, StatStrip } from '../features/workforce-stats/components/StatCard';
import { ReadinessBadge } from '../features/workforce-stats/components/ReadinessBadge';
import { IssueBadge } from '../features/workforce-stats/components/IssueBadge';
import { IssueDrilldownDrawer } from '../features/workforce-stats/components/IssueDrilldownDrawer';
import { useIssueDrilldown } from '../features/workforce-stats/hooks/useIssueDrilldown';

type LegalEntity = {
  id: string;
  code: string;
  name: string;
  country: string;
  registration_no?: string;
  tax_reference?: string;
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
  title: { fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', margin: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' },
  body: { padding: '1.5rem', display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
  label: { fontSize: '0.875rem', fontWeight: 500, color: '#374151' },
  input: {
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1.5rem', borderTop: '1px solid #e2e8f0' },
};

export default function LegalEntities() {
  const { canAny } = useAccess();
  const canCreate = canAny(['legal_entity:write', 'iam:legal_entities:manage']);
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message?: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    country: 'ZA' as 'ZA' | 'LS',
    registration_no: '',
    tax_reference: '',
  });

  const [leStats, setLeStats] = useState<any[]>([]);
  const { drilldownState, openDrilldown, closeDrilldown } = useIssueDrilldown();

  const loadEntities = useCallback(() => {
    setLoading(true);
    api
      .get('/legal-entities', { params: { limit: 200 } })
      .then((r) => {
        const items = r.data?.items ?? r.data ?? [];
        setEntities(Array.isArray(items) ? items : []);
      })
      .catch((e) => {
        setError({ status: e?.response?.status });
        setEntities([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadEntities();
    fetchLegalEntityStats().then(setLeStats).catch(() => {});
  }, [loadEntities]);

  const handleCreate = async () => {
    if (!form.code?.trim() || !form.name?.trim()) {
      setCreateError('Code and Name are required.');
      return;
    }
    try {
      setCreating(true);
      setCreateError(null);
      await api.post('/legal-entities', {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        country: form.country,
        registration_no: form.registration_no?.trim() || undefined,
        tax_reference: form.tax_reference?.trim() || undefined,
      });
      setShowCreateModal(false);
      setForm({ code: '', name: '', country: 'ZA', registration_no: '', tax_reference: '' });
      loadEntities();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string }; status?: number } };
      setCreateError(e?.response?.data?.message ?? 'Failed to create legal entity.');
    } finally {
      setCreating(false);
    }
  };

  const forbidden = error?.status === 403;
  const unavailable = error?.status === 404 || error?.status === 501;

  if (forbidden) {
    return (
      <Page title="Legal Entities" subtitle="Companies and statutory contexts (country, registration, tax).">
        <ForbiddenEmptyState feature="Legal Entities" description="You need legal entity access to view this page." />
      </Page>
    );
  }

  if (unavailable) {
    return (
      <Page title="Legal Entities" subtitle="Companies and statutory contexts (country, registration, tax).">
        <UnavailableEmptyState feature="Legal Entities" description="Not enabled or not available." />
      </Page>
    );
  }

  return (
    <Page
      title="Legal Entities"
      subtitle="Companies and statutory contexts (country, registration, tax)."
      actions={
        canCreate ? (
          <button style={styles.buttonPrimary} onClick={() => { setShowCreateModal(true); setCreateError(null); }} type="button">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: 8, verticalAlign: 'middle' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Legal Entity
          </button>
        ) : null
      }
    >
      {error?.message && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 14 }}>
          {error.message}
        </div>
      )}
      <Card>
        <div style={{ padding: ui.space.lg }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: ui.space.xl, color: styles.colors.textSecondary }}>
              Loading…
            </div>
          ) : entities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: ui.space.xl, color: styles.colors.textSecondary }}>
              No legal entities found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${styles.colors.border}` }}>
                    <th style={{ ...styles.tableHeaderCell, textAlign: 'left' }}>Code</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: 'left' }}>Name</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: 'left' }}>Country</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: 'right' }}>Employees</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: 'right' }}>Org Units</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: 'right' }}>Issues</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: 'center' }}>Readiness</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((e) => {
                    const stat = leStats.find((s: any) => s.legalEntityId === e.id);
                    return (
                      <tr key={e.id} style={{ borderBottom: `1px solid ${styles.colors.borderLight}` }}>
                        <td style={{ ...styles.tableCell, fontFamily: 'monospace', fontSize: '0.85rem' }}>{e.code}</td>
                        <td style={{ ...styles.tableCell, fontWeight: 600 }}>{e.name}</td>
                        <td style={{ ...styles.tableCell }}>{e.country}</td>
                        <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                          {stat ? (
                            <span>{stat.activeEmployeesCount}<span style={{ color: '#94a3b8', fontSize: 11 }}> / {stat.employeesCount}</span></span>
                          ) : '—'}
                        </td>
                        <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                          {stat ? stat.orgUnitsCount : '—'}
                        </td>
                        <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                          {stat ? (
                            <div
                              style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', cursor: (stat.issuesCount > 0 || stat.blockersCount > 0) ? 'pointer' : 'default' }}
                              onClick={(stat.issuesCount > 0 || stat.blockersCount > 0) ? () => openDrilldown({
                                legalEntityId: e.id,
                                title: `Issues — ${e.name}`,
                                groupBy: 'issueType',
                              }) : undefined}
                            >
                              {stat.blockersCount > 0 && <IssueBadge count={stat.blockersCount} severity="error" label={stat.blockersCount === 1 ? 'blocker' : 'blockers'} />}
                              {stat.issuesCount > 0 && <IssueBadge count={stat.issuesCount} severity="warning" />}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ ...styles.tableCell, textAlign: 'center' }}>
                          {stat ? (
                            <ReadinessBadge status={stat.readinessStatus} percent={stat.readinessPercent} />
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {showCreateModal && (
        <div style={modalStyles.overlay} onClick={() => !creating && setShowCreateModal(false)}>
          <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h2 style={modalStyles.title}>Add Legal Entity</h2>
              <button style={modalStyles.closeBtn} onClick={() => !creating && setShowCreateModal(false)} type="button">×</button>
            </div>
            <div style={modalStyles.body}>
              {createError && (
                <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 14 }}>
                  {createError}
                </div>
              )}
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Code *</label>
                <input
                  style={modalStyles.input}
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. DEMO-ZA-001"
                  disabled={creating}
                />
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Name *</label>
                <input
                  style={modalStyles.input}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Demo Company (Pty) Ltd"
                  disabled={creating}
                />
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Country *</label>
                <select
                  style={modalStyles.input}
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value as 'ZA' | 'LS' }))}
                  disabled={creating}
                >
                  <option value="ZA">ZA - South Africa</option>
                  <option value="LS">LS - Lesotho</option>
                </select>
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Registration no (optional)</label>
                <input
                  style={modalStyles.input}
                  value={form.registration_no}
                  onChange={(e) => setForm((f) => ({ ...f, registration_no: e.target.value }))}
                  placeholder="e.g. 2020/123456/07"
                  disabled={creating}
                />
              </div>
              <div style={modalStyles.field}>
                <label style={modalStyles.label}>Tax reference (optional)</label>
                <input
                  style={modalStyles.input}
                  value={form.tax_reference}
                  onChange={(e) => setForm((f) => ({ ...f, tax_reference: e.target.value }))}
                  placeholder="e.g. 9012345678"
                  disabled={creating}
                />
              </div>
            </div>
            <div style={modalStyles.footer}>
              <button style={styles.buttonSecondary} onClick={() => !creating && setShowCreateModal(false)} disabled={creating} type="button">Cancel</button>
              <button style={styles.buttonPrimary} onClick={handleCreate} disabled={creating || !form.code?.trim() || !form.name?.trim()} type="button">
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <IssueDrilldownDrawer
        open={drilldownState.open}
        onClose={closeDrilldown}
        issueType={drilldownState.issueType}
        legalEntityId={drilldownState.legalEntityId}
        title={drilldownState.title}
        groupBy={drilldownState.groupBy}
        onRefreshNeeded={() => fetchLegalEntityStats().then(setLeStats).catch(() => {})}
      />
    </Page>
  );
}
