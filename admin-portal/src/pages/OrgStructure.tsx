import { useEffect, useState } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, Banner, Stack, ui } from '../ui/layout';
import { classifyError } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageBlockedView, PageErrorView } from '../ui/PageStateViews';
import { fetchOrgUnitStatsTree, acceptManagerSuggestion, triggerStatsRefresh } from '../features/workforce-stats/api';
import { StatCard, StatStrip } from '../features/workforce-stats/components/StatCard';
import { IssueBadge } from '../features/workforce-stats/components/IssueBadge';
import { IssueDrilldownDrawer } from '../features/workforce-stats/components/IssueDrilldownDrawer';
import { useIssueDrilldown } from '../features/workforce-stats/hooks/useIssueDrilldown';

type OrgUnit = {
  id: string;
  legal_entity_id: string;
  code: string;
  name: string;
  parent_org_unit_id: string | null;
  sort_order: number;
  is_active: boolean;
  parent_name?: string | null;
};

type LegalEntity = { id: string; name: string; code: string; country?: string };

export default function OrgStructure() {
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [selectedLegalEntityId, setSelectedLegalEntityId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<OrgUnit | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '' });
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [ouStats, setOuStats] = useState<any[]>([]);
  const { drilldownState, openDrilldown, closeDrilldown } = useIssueDrilldown();

  const loadLegalEntities = async () => {
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
  };

  const loadOrgUnits = async () => {
    if (!selectedLegalEntityId) {
      setOrgUnits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const r = await api.get('/api/enterprise/org-units', { params: { legal_entity_id: selectedLegalEntityId } });
      setOrgUnits(r.data || []);
    } catch (err) {
      setOrgUnits([]);
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLegalEntities();
  }, []);

  useEffect(() => {
    void loadOrgUnits();
    if (selectedLegalEntityId) {
      fetchOrgUnitStatsTree({ legalEntityId: selectedLegalEntityId }).then(setOuStats).catch(() => {});
    }
  }, [selectedLegalEntityId]);

  const handleCreate = async () => {
    if (!form.code || !form.name || !selectedLegalEntityId) {
      setActionError('Code and name are required.');
      return;
    }
    try {
      setCreating(true);
      setActionError(null);
      await api.post('/api/enterprise/org-units', {
        legal_entity_id: selectedLegalEntityId,
        code: form.code,
        name: form.name,
        parent_org_unit_id: parentId || null,
      });
      setShowModal(false);
      setForm({ code: '', name: '' });
      setParentId(null);
      void loadOrgUnits();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to create org unit');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUnit || !form.code || !form.name) return;
    try {
      setUpdating(true);
      setActionError(null);
      await api.put(`/api/enterprise/org-units/${editingUnit.id}`, {
        code: form.code,
        name: form.name,
      });
      setEditingUnit(null);
      setForm({ code: '', name: '' });
      void loadOrgUnits();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to update org unit');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this org unit? It must have no children.')) return;
    try {
      setActionError(null);
      await api.delete(`/api/enterprise/org-units/${id}`);
      void loadOrgUnits();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to delete org unit');
    }
  };

  const openCreateModal = (parentIdArg?: string | null) => {
    setEditingUnit(null);
    setParentId(parentIdArg ?? null);
    setForm({ code: '', name: '' });
    setShowModal(true);
  };

  const openEditModal = (u: OrgUnit) => {
    setShowModal(false);
    setEditingUnit(u);
    setForm({ code: u.code, name: u.name });
  };

  const closeModals = () => {
    setShowModal(false);
    setEditingUnit(null);
    setForm({ code: '', name: '' });
    setParentId(null);
  };

  const buildTree = (items: OrgUnit[], parentId: string | null): OrgUnit[] => {
    return items
      .filter((u) => u.parent_org_unit_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
  };

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleAcceptSuggestion = async (suggestionId: string) => {
    setAcceptingId(suggestionId);
    try {
      await acceptManagerSuggestion(suggestionId);
      await triggerStatsRefresh();
      if (selectedLegalEntityId) {
        const data = await fetchOrgUnitStatsTree({ legalEntityId: selectedLegalEntityId });
        setOuStats(data);
      }
      setActionFeedback('Manager suggestion accepted and assigned.');
      setTimeout(() => setActionFeedback(null), 4000);
    } catch { /* ignore */ }
    setAcceptingId(null);
  };

  const renderTree = (items: OrgUnit[], parentId: string | null, depth: number) => {
    const children = buildTree(items, parentId);
    return children.map((u) => {
      const stat = ouStats.find((s: any) => s.orgUnitId === u.id);
      const suggestion = stat?.managerSuggestion;
      const hasConfirmedManager = !!stat?.managerName;

      return (
        <div key={u.id} style={{ marginLeft: depth * 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${suggestion && !hasConfirmedManager ? '#93c5fd' : stat?.missingManager && !suggestion ? '#fde68a' : styles.colors.borderLight}`,
              marginBottom: 8,
              background: u.is_active ? 'white' : 'rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: styles.colors.textPrimary }}>{u.code}</span>
              <span style={{ color: styles.colors.textSecondary }}>{u.name}</span>

              {/* Manager state display */}
              {hasConfirmedManager && (
                <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 500 }}>
                  Mgr: {stat.managerName}
                  {stat.managerAssignmentSource === 'INFERRED_ACCEPTED' && (
                    <span style={{ marginLeft: 4, padding: '0 4px', borderRadius: 3, background: '#ede9fe', color: '#7c3aed', fontSize: 9, fontWeight: 600 }}>
                      Accepted
                    </span>
                  )}
                </span>
              )}
              {!hasConfirmedManager && suggestion && (
                <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#2563eb', fontWeight: 500 }}>Suggested: {suggestion.employeeName}</span>
                  <span style={{
                    padding: '0 5px', borderRadius: 3, fontSize: 9, fontWeight: 700,
                    background: suggestion.confidenceBand === 'HIGH' ? '#dcfce7' : '#fef9c3',
                    color: suggestion.confidenceBand === 'HIGH' ? '#166534' : '#854d0e',
                  }}>
                    {suggestion.confidenceBand} {suggestion.confidence}%
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAcceptSuggestion(suggestion.id); }}
                    disabled={acceptingId === suggestion.id}
                    style={{
                      padding: '1px 8px', borderRadius: 4, border: '1px solid #22c55e',
                      background: '#f0fdf4', color: '#16a34a', fontSize: 10, fontWeight: 600,
                      cursor: 'pointer', opacity: acceptingId === suggestion.id ? 0.5 : 1,
                    }}
                  >
                    {acceptingId === suggestion.id ? '...' : 'Accept'}
                  </button>
                </span>
              )}
              {!hasConfirmedManager && !suggestion && (
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                  Manager not assigned
                </span>
              )}

              {stat && stat.directEmployeesCount > 0 && (
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  {stat.directEmployeesCount} emp{stat.descendantEmployeesCount > stat.directEmployeesCount ? ` (${stat.descendantEmployeesCount} total)` : ''}
                </span>
              )}
              {stat?.issuesCount > 0 && (
                <span
                  onClick={(e) => { e.stopPropagation(); openDrilldown({ orgUnitId: u.id, title: `Issues — ${u.name}`, groupBy: 'issueType' }); }}
                  style={{ cursor: 'pointer' }}
                >
                  <IssueBadge count={stat.issuesCount} severity={stat.blockersCount > 0 ? 'error' : 'warning'} />
                </span>
              )}
              {!u.is_active && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.08)', color: styles.colors.textMuted }}>
                  Inactive
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => openCreateModal(u.id)}
                style={{ ...styles.buttonSecondary, fontSize: 12, padding: '6px 12px' }}
              >
                Add child
              </button>
              <button type="button" onClick={() => openEditModal(u)} style={{ ...styles.buttonSecondary, fontSize: 12, padding: '6px 12px' }}>
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(u.id)}
                style={{ ...styles.buttonDanger, fontSize: 12, padding: '6px 12px' }}
              >
                Delete
              </button>
            </div>
          </div>
          {renderTree(items, u.id, depth + 1)}
        </div>
      );
    });
  };

  const loadState = loadError ? classifyError(loadError) : null;
  const stateForTelemetry = loadState ?? { kind: 'ready' as const };
  usePageStateTelemetry('enterprise.orgStructure', 'enterprise', stateForTelemetry);
  if (loadState && loadState.kind === 'blocked') {
    return (
      <Page title="Org Structure" subtitle="Org unit tree (Departments → Teams).">
        <PageBlockedView code={loadState.code} message={loadState.message} page="enterprise.orgStructure" module="enterprise" />
      </Page>
    );
  }
  if (loadState && loadState.kind === 'error') {
    return (
      <Page title="Org Structure" subtitle="Org unit tree (Departments → Teams).">
        <PageErrorView message={loadState.message} retryable={loadState.retryable} onRetry={loadOrgUnits} page="enterprise.orgStructure" module="enterprise" />
      </Page>
    );
  }

  return (
    <Page
      title="Org Structure"
      subtitle="Org unit tree (Departments → Teams). Used for reporting and manager chains."
      actions={
        <button type="button" onClick={() => openCreateModal(null)} style={styles.buttonPrimary}>
          Add org unit
        </button>
      }
    >
      <Stack gap={ui.space.lg}>
        {actionError && (
          <Banner variant="error">{actionError}</Banner>
        )}

        {actionFeedback && (
          <Banner variant="success">{actionFeedback}</Banner>
        )}

        {ouStats.length > 0 && (
          <StatStrip columns={5}>
            <StatCard label="Org Units" value={ouStats.length} color="#0ea5e9" />
            <StatCard
              label="With Manager"
              value={ouStats.filter((s: any) => s.hasManager).length}
              color="#22c55e"
            />
            <StatCard
              label="Without Manager"
              value={ouStats.filter((s: any) => s.missingManager).length}
              color={ouStats.filter((s: any) => s.missingManager).length > 0 ? '#f59e0b' : '#94a3b8'}
            />
            <StatCard
              label="Total Employees"
              value={ouStats.filter((s: any) => !s.parentOrgUnitId).reduce((sum: number, s: any) => sum + (s.descendantEmployeesCount || 0), 0) || ouStats.reduce((sum: number, s: any) => sum + (s.directEmployeesCount || 0), 0)}
              color="#6366f1"
            />
            <StatCard
              label="Issues"
              value={ouStats.reduce((sum: number, s: any) => sum + (s.issuesCount || 0), 0)}
              color={ouStats.reduce((sum: number, s: any) => sum + (s.issuesCount || 0), 0) > 0 ? '#ef4444' : '#94a3b8'}
              onClick={ouStats.reduce((sum: number, s: any) => sum + (s.issuesCount || 0), 0) > 0 ? () => openDrilldown({
                title: 'Org structure issues',
                entityType: 'ORG_UNIT',
                groupBy: 'issueType',
              }) : undefined}
            />
          </StatStrip>
        )}

        <Card>
          <div style={{ padding: ui.space.lg }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...styles.formLabel, marginBottom: 8 }}>Legal entity</label>
              <select
                value={selectedLegalEntityId}
                onChange={(e) => setSelectedLegalEntityId(e.target.value)}
                style={{ ...styles.formSelect, maxWidth: 320 }}
              >
                <option value="">Select…</option>
                {legalEntities.map((le) => (
                  <option key={le.id} value={le.id}>
                    {le.name} ({le.code})
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div style={{ padding: ui.space.xl, textAlign: 'center', color: styles.colors.textSecondary }}>Loading…</div>
            ) : !selectedLegalEntityId ? (
              <div style={{ padding: ui.space.xl, color: styles.colors.textSecondary }}>Select a legal entity to view org units.</div>
            ) : orgUnits.length === 0 ? (
              <div style={{ padding: ui.space.xl, color: styles.colors.textSecondary }}>
                No org units yet. Click &quot;Add org unit&quot; to create the first one.
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>{renderTree(orgUnits, null, 0)}</div>
            )}
          </div>
        </Card>
      </Stack>

      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => !creating && closeModals()}
        >
          <div
            style={{ background: 'white', borderRadius: 14, padding: ui.space.xl, minWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900 }}>Add org unit</h3>
            {parentId && (
              <p style={{ fontSize: 12, color: styles.colors.textSecondary, marginBottom: 12 }}>
                Creating under parent org unit
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={styles.formLabel}>Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  style={styles.formInput}
                  placeholder="e.g. ENG"
                />
              </div>
              <div>
                <label style={styles.formLabel}>Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  style={styles.formInput}
                  placeholder="e.g. Engineering"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button type="button" onClick={() => !creating && closeModals()} disabled={creating}>Cancel</button>
              <button type="button" onClick={handleCreate} disabled={creating || !form.code || !form.name}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUnit && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => !updating && closeModals()}
        >
          <div
            style={{ background: 'white', borderRadius: 14, padding: ui.space.xl, minWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900 }}>Edit org unit</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={styles.formLabel}>Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  style={styles.formInput}
                />
              </div>
              <div>
                <label style={styles.formLabel}>Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  style={styles.formInput}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button type="button" onClick={() => !updating && closeModals()} disabled={updating}>Cancel</button>
              <button type="button" onClick={handleUpdate} disabled={updating || !form.code || !form.name}>
                {updating ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <IssueDrilldownDrawer
        open={drilldownState.open}
        onClose={closeDrilldown}
        issueType={drilldownState.issueType}
        entityType={drilldownState.entityType}
        orgUnitId={drilldownState.orgUnitId}
        title={drilldownState.title}
        groupBy={drilldownState.groupBy}
        onRefreshNeeded={() => {
          if (selectedLegalEntityId) {
            fetchOrgUnitStatsTree({ legalEntityId: selectedLegalEntityId }).then(setOuStats).catch(() => {});
          }
        }}
      />
    </Page>
  );
}
