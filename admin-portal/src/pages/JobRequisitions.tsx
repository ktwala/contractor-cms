import { useCallback, useEffect, useMemo, useState } from 'react';
import * as styles from '../styles/common';
import { P } from '../constants/permissions';
import { useAccess } from '../hooks/useAccess';
import { fetchLegalEntities, type LegalEntityItem } from '../services/recruitment/legalEntities.service';
import { requisitionsService, type RequisitionApiRow } from '../services/recruitment/requisitions.service';
import {
  canApproveRequisitionStatus,
  canCloseRequisitionStatus,
  canEditRequisitionStatus,
  canPostRequisitionStatus,
  toRequisitionViewModel,
  type RequisitionViewModel,
} from '../services/recruitment/requisition.adapter';
import { DepartmentSelect } from '../components/selectors/DepartmentSelect';
import { UserSelect } from '../components/selectors/UserSelect';
import { LocationSelect } from '../components/selectors/LocationSelect';

const LE_STORAGE_KEY = 'talent_recruitment_legal_entity_id';

type LoadState = 'idle' | 'loading' | 'error' | 'empty' | 'ready';

type ActionKind = 'approve' | 'post' | 'close_filled' | 'close_cancelled' | null;

const defaultForm = () => ({
  title: '',
  department: '',
  department_org_unit_id: '' as string | undefined,
  work_location_id: '' as string | undefined,
  location_custom: '',
  remote_allowed: false,
  hybrid: false,
  employment_type: 'full_time',
  salary_min: '' as string,
  salary_max: '' as string,
  description: '',
  hiring_manager_id: '' as string | undefined,
  headcount: '' as string,
});

export default function JobRequisitions() {
  const { can } = useAccess();

  const canView = can(P.RECRUITMENT_REQUISITIONS_VIEW);
  const canCreate = can(P.RECRUITMENT_REQUISITIONS_CREATE);
  const canUpdate = can(P.RECRUITMENT_REQUISITIONS_UPDATE);
  const canApprove = can(P.RECRUITMENT_REQUISITIONS_APPROVE);
  const canPost = can(P.RECRUITMENT_REQUISITIONS_POST);
  const canManage = can(P.RECRUITMENT_REQUISITIONS_MANAGE);

  const [legalEntities, setLegalEntities] = useState<LegalEntityItem[]>([]);
  const [leLoadError, setLeLoadError] = useState(false);
  const [legalEntityId, setLegalEntityId] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(LE_STORAGE_KEY) ?? '' : '',
  );

  const [rows, setRows] = useState<RequisitionViewModel[]>([]);
  const [rawById, setRawById] = useState<Record<string, RequisitionApiRow>>({});
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [actionOpen, setActionOpen] = useState(false);
  const [actionKind, setActionKind] = useState<ActionKind>(null);
  const [actionRow, setActionRow] = useState<RequisitionViewModel | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await fetchLegalEntities();
        if (!cancelled) {
          setLegalEntities(items);
          setLeLoadError(false);
        }
      } catch {
        if (!cancelled) {
          setLeLoadError(true);
          setLegalEntities([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistLe = useCallback((id: string) => {
    setLegalEntityId(id);
    if (id) localStorage.setItem(LE_STORAGE_KEY, id);
    else localStorage.removeItem(LE_STORAGE_KEY);
  }, []);

  const load = useCallback(async () => {
    if (!legalEntityId.trim()) {
      setRows([]);
      setRawById({});
      setLoadState('idle');
      return;
    }
    try {
      setLoadError(null);
      setRefreshing(true);
      setLoadState((prev) => (prev === 'ready' || prev === 'empty' ? prev : 'loading'));
      const data = await requisitionsService.list(legalEntityId.trim());
      const mapped = data.map(toRequisitionViewModel);
      const rawMap = Object.fromEntries(data.map((r) => [r.id, r]));
      setRows(mapped);
      setRawById(rawMap);
      setLoadState(mapped.length ? 'ready' : 'empty');
    } catch (e: unknown) {
      setLoadState('error');
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Failed to load';
      setLoadError(msg);
    } finally {
      setRefreshing(false);
    }
  }, [legalEntityId]);

  useEffect(() => {
    if (!canView || !legalEntityId.trim()) return;
    void load();
  }, [canView, legalEntityId, load]);

  const stats = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      draft: by('draft'),
      approved: by('on_hold'),
      posted: by('open'),
      closed: by('closed') + by('cancelled'),
      applications: rows.reduce((s, r) => s + r.applicationCount, 0),
    };
  }, [rows]);

  function openCreate() {
    setFormMode('create');
    setEditingId(null);
    setForm(defaultForm());
    setFormOpen(true);
  }

  function openEdit(vm: RequisitionViewModel) {
    const raw = rawById[vm.id];
    if (!raw) return;
    setFormMode('edit');
    setEditingId(vm.id);
    setForm({
      title: raw.title,
      department: raw.department ?? '',
      department_org_unit_id: undefined,
      work_location_id: raw.work_location_id ?? undefined,
      location_custom: raw.work_location_id ? '' : raw.location ?? '',
      remote_allowed: Boolean(raw.remote),
      hybrid: Boolean(raw.hybrid),
      employment_type: raw.employment_type ?? 'full_time',
      salary_min: raw.salary_min ?? '',
      salary_max: raw.salary_max ?? '',
      description: raw.description ?? '',
      hiring_manager_id: raw.hiring_manager_id ?? undefined,
      headcount: raw.positions != null ? String(raw.positions) : '',
    });
    setFormOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!legalEntityId.trim()) return;
    if (!form.title.trim()) return;
    setFormSubmitting(true);
    try {
      if (formMode === 'create') {
        await requisitionsService.create({
          legal_entity_id: legalEntityId.trim(),
          job_title: form.title.trim(),
          department: form.department.trim() || undefined,
          location: !form.work_location_id ? form.location_custom.trim() || undefined : undefined,
          work_location_id: form.work_location_id?.trim() || undefined,
          hybrid: form.hybrid,
          remote_allowed: form.remote_allowed,
          employment_type: form.employment_type || undefined,
          salary_range_min: form.salary_min ? Number(form.salary_min) : undefined,
          salary_range_max: form.salary_max ? Number(form.salary_max) : undefined,
          job_description: form.description.trim() || undefined,
          hiring_manager_id: form.hiring_manager_id?.trim() || undefined,
          number_of_positions: form.headcount.trim() ? Number(form.headcount) : undefined,
        });
      } else if (editingId) {
        await requisitionsService.update(editingId, {
          job_title: form.title.trim(),
          department: form.department.trim() || null,
          work_location_id: form.work_location_id?.trim() || null,
          location: !form.work_location_id ? form.location_custom.trim() || null : null,
          hybrid: form.hybrid,
          remote_allowed: form.remote_allowed,
          employment_type: form.employment_type || null,
          salary_range_min: form.salary_min ? Number(form.salary_min) : null,
          salary_range_max: form.salary_max ? Number(form.salary_max) : null,
          job_description: form.description.trim() || null,
          hiring_manager_id: form.hiring_manager_id?.trim() || null,
          number_of_positions: form.headcount.trim() ? Number(form.headcount) : null,
        });
      }
      setFormOpen(false);
      await load();
    } finally {
      setFormSubmitting(false);
    }
  }

  function openAction(kind: ActionKind, row: RequisitionViewModel) {
    setActionKind(kind);
    setActionRow(row);
    setActionOpen(true);
  }

  async function confirmAction() {
    if (!actionRow || !actionKind) return;
    setActionSubmitting(true);
    try {
      if (actionKind === 'approve') await requisitionsService.approve(actionRow.id);
      else if (actionKind === 'post') await requisitionsService.post(actionRow.id);
      else if (actionKind === 'close_filled') await requisitionsService.close(actionRow.id, 'filled');
      else if (actionKind === 'close_cancelled') await requisitionsService.close(actionRow.id, 'cancelled');
      setActionOpen(false);
      setActionRow(null);
      setActionKind(null);
      await load();
    } finally {
      setActionSubmitting(false);
    }
  }

  if (!canView) {
    return (
      <div style={styles.pageContainer} data-testid="requisitions-blocked">
        <div style={{ ...styles.card, maxWidth: 480 }}>
          <h1 style={styles.pageTitle}>Access denied</h1>
          <p style={{ color: styles.colors.textMuted, marginTop: 8 }}>
            You do not have permission to view job requisitions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer} data-testid="job-requisitions-page">
      <div style={{ ...styles.flexBetween, ...styles.pageHeader }}>
        <div>
          <h1 style={styles.pageTitle}>Job Requisitions</h1>
          <p style={styles.pageSubtitle}>Manage open positions and hiring needs</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            style={styles.buttonSecondary}
            disabled={refreshing || !legalEntityId.trim()}
            onClick={() => void load()}
            data-testid="requisitions-refresh-button"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {canCreate && (
            <button type="button" style={styles.buttonPrimary} onClick={openCreate} data-testid="requisitions-create-button">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Requisition
            </button>
          )}
        </div>
      </div>

      <div style={{ ...styles.card, marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Legal entity</label>
        {legalEntities.length > 0 ? (
          <select
            value={legalEntityId}
            onChange={(e) => persistLe(e.target.value)}
            style={{ ...styles.input, maxWidth: 400 }}
            data-testid="requisitions-legal-entity"
          >
            <option value="">Select legal entity…</option>
            {legalEntities.map((le) => (
              <option key={le.id} value={le.id}>
                {le.name} ({le.code})
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder={leLoadError ? 'Legal entity UUID (list unavailable)' : 'Loading entities…'}
            value={legalEntityId}
            onChange={(e) => persistLe(e.target.value)}
            style={{ ...styles.input, maxWidth: 480 }}
            data-testid="requisitions-legal-entity-manual"
            disabled={!leLoadError && legalEntities.length === 0}
          />
        )}
        {leLoadError && (
          <p style={{ fontSize: 12, color: styles.colors.warning, marginTop: 8 }}>
            Could not load legal entities. Enter a legal entity id if you know it.
          </p>
        )}
      </div>

      {!legalEntityId.trim() && (
        <div style={styles.card} data-testid="requisitions-no-entity">
          <p style={{ color: styles.colors.textSecondary }}>Select a legal entity to load requisitions.</p>
        </div>
      )}

      {legalEntityId.trim() && loadState === 'loading' && (
        <div style={styles.card} data-testid="requisitions-loading">
          <p style={{ color: styles.colors.textMuted }}>Loading requisitions…</p>
        </div>
      )}

      {legalEntityId.trim() && loadState === 'error' && (
        <div style={styles.card} data-testid="requisitions-error">
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Could not load requisitions</h2>
          <p style={{ color: styles.colors.textMuted, marginTop: 8 }}>{loadError}</p>
          <button type="button" style={{ ...styles.buttonPrimary, marginTop: 16 }} onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {legalEntityId.trim() && loadState === 'empty' && (
        <div style={{ ...styles.card, borderStyle: 'dashed' }} data-testid="requisitions-empty">
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>No requisitions yet</h2>
          <p style={{ color: styles.colors.textMuted, marginTop: 8 }}>
            Create a requisition to start the approval and posting workflow.
          </p>
          {canCreate && (
            <button type="button" style={{ ...styles.buttonPrimary, marginTop: 16 }} onClick={openCreate}>
              Create Requisition
            </button>
          )}
        </div>
      )}

      {legalEntityId.trim() && loadState === 'ready' && (
        <>
          <div style={styles.grid4}>
            {[
              { label: 'Draft', value: stats.draft, color: styles.colors.textMuted },
              { label: 'Approved', value: stats.approved, color: styles.colors.warning },
              { label: 'Posted', value: stats.posted, color: styles.colors.info },
              { label: 'Applications', value: stats.applications, color: styles.colors.primary },
            ].map((stat, i) => (
              <div key={i} style={{ ...styles.card, borderTop: `3px solid ${stat.color}` }}>
                <p style={{ fontSize: '0.75rem', color: styles.colors.textMuted }}>{stat.label}</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: styles.colors.textPrimary }}>{stat.value}</p>
              </div>
            ))}
          </div>

          <h2 style={styles.sectionTitle}>All Requisitions</h2>
          <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.tableHeaderCell}>Position</th>
                  <th style={styles.tableHeaderCell}>Department</th>
                  <th style={styles.tableHeaderCell}>Location</th>
                  <th style={styles.tableHeaderCell}>Salary</th>
                  <th style={styles.tableHeaderCell}>Apps</th>
                  <th style={styles.tableHeaderCell}>Status</th>
                  <th style={styles.tableHeaderCell}>Updated</th>
                  <th style={styles.tableHeaderCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((req, idx) => (
                  <tr
                    key={req.id}
                    style={{
                      ...styles.tableRow,
                      borderBottom: idx === rows.length - 1 ? 'none' : undefined,
                    }}
                    data-testid={`requisition-row-${req.id}`}
                  >
                    <td style={styles.tableCell}>
                      <p style={{ fontWeight: 600, color: styles.colors.textPrimary }}>{req.title}</p>
                    </td>
                    <td style={styles.tableCell}>{req.department}</td>
                    <td style={styles.tableCell}>{req.location}</td>
                    <td style={styles.tableCell}>{req.salaryRangeLabel}</td>
                    <td style={styles.tableCell}>{req.applicationCount}</td>
                    <td style={styles.tableCell}>
                      <span style={styles.badge(req.status === 'open' ? 'info' : req.status === 'on_hold' ? 'warning' : req.status === 'draft' ? 'default' : 'default')}>
                        {req.statusLabel}
                      </span>
                    </td>
                    <td style={{ ...styles.tableCell, color: styles.colors.textMuted }}>{req.updatedAtLabel}</td>
                    <td style={styles.tableCell}>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {canUpdate && canEditRequisitionStatus(req.status) && (
                          <button
                            type="button"
                            style={{ ...styles.buttonSecondary, padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            onClick={() => openEdit(req)}
                            data-testid={`requisition-edit-${req.id}`}
                          >
                            Edit
                          </button>
                        )}
                        {canApprove && canApproveRequisitionStatus(req.status) && (
                          <button
                            type="button"
                            style={{ ...styles.buttonSecondary, padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            onClick={() => openAction('approve', req)}
                            data-testid={`requisition-approve-${req.id}`}
                          >
                            Approve
                          </button>
                        )}
                        {canPost && canPostRequisitionStatus(req.status) && (
                          <button
                            type="button"
                            style={{ ...styles.buttonSecondary, padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            onClick={() => openAction('post', req)}
                            data-testid={`requisition-post-${req.id}`}
                          >
                            Post
                          </button>
                        )}
                        {canManage && canCloseRequisitionStatus(req.status) && (
                          <>
                            <button
                              type="button"
                              style={{ ...styles.buttonSecondary, padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                              onClick={() => openAction('close_filled', req)}
                              data-testid={`requisition-close-filled-${req.id}`}
                            >
                              Close (filled)
                            </button>
                            <button
                              type="button"
                              style={{ ...styles.buttonSecondary, padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                              onClick={() => openAction('close_cancelled', req)}
                              data-testid={`requisition-close-cancelled-${req.id}`}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {formOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
          data-testid="requisition-form-modal"
        >
          <div style={{ ...styles.card, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              {formMode === 'create' ? 'Create requisition' : 'Edit requisition'}
            </h2>
            <form onSubmit={(e) => void submitForm(e)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!legalEntityId.trim() && (
                  <p style={{ fontSize: 12, color: styles.colors.warning, margin: 0 }}>
                    Choose a legal entity on the page before using department, location, or hiring manager search.
                  </p>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Title</label>
                  <input
                    style={styles.input}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    required
                    data-testid="requisition-form-title"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Department</label>
                  <p style={{ fontSize: 11, color: styles.colors.textMuted, margin: '0 0 6px' }}>
                    Search org units for this legal entity (stores department name on the requisition).
                  </p>
                  <DepartmentSelect
                    value={form.department_org_unit_id}
                    closedLabel={form.department || undefined}
                    onChange={(id, opt) =>
                      setForm((f) => ({
                        ...f,
                        department_org_unit_id: id,
                        department: opt?.label ?? (id ? f.department : ''),
                      }))
                    }
                    legalEntityId={legalEntityId.trim() || undefined}
                    disabled={!legalEntityId.trim()}
                    testId="requisition-form-department"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Hiring manager</label>
                  <UserSelect
                    value={form.hiring_manager_id}
                    onChange={(id) => setForm((f) => ({ ...f, hiring_manager_id: id }))}
                    legalEntityId={legalEntityId.trim() || undefined}
                    placeholder="Search user…"
                    disabled={!legalEntityId.trim()}
                    testId="requisition-form-hiring-manager"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Headcount (positions)</label>
                  <input
                    style={styles.input}
                    type="number"
                    min={1}
                    value={form.headcount}
                    onChange={(e) => setForm((f) => ({ ...f, headcount: e.target.value }))}
                    data-testid="requisition-form-headcount"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Work location</label>
                  <p style={{ fontSize: 11, color: styles.colors.textMuted, margin: '0 0 6px' }}>
                    Pick a site from the directory, or enter a custom location below if none apply.
                  </p>
                  <LocationSelect
                    value={form.work_location_id}
                    closedLabel={
                      form.work_location_id ? undefined : form.location_custom || undefined
                    }
                    onChange={(id) =>
                      setForm((f) => ({
                        ...f,
                        work_location_id: id,
                        location_custom: id ? '' : f.location_custom,
                      }))
                    }
                    legalEntityId={legalEntityId.trim() || undefined}
                    disabled={!legalEntityId.trim()}
                    testId="requisition-form-location-select"
                  />
                </div>
                {!form.work_location_id && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                      Custom location (free text)
                    </label>
                    <input
                      style={styles.input}
                      value={form.location_custom}
                      onChange={(e) => setForm((f) => ({ ...f, location_custom: e.target.value }))}
                      placeholder="e.g. Client site, roaming, or city not in list"
                      data-testid="requisition-form-location-custom"
                    />
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.remote_allowed}
                      onChange={(e) => setForm((f) => ({ ...f, remote_allowed: e.target.checked }))}
                      data-testid="requisition-form-remote"
                    />
                    Remote-friendly role
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.hybrid}
                      onChange={(e) => setForm((f) => ({ ...f, hybrid: e.target.checked }))}
                      data-testid="requisition-form-hybrid"
                    />
                    Hybrid arrangement
                  </label>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Employment type</label>
                  <select
                    style={styles.input}
                    value={form.employment_type}
                    onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
                  >
                    <option value="full_time">Full-time</option>
                    <option value="part_time">Part-time</option>
                    <option value="contract">Contract</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Salary min</label>
                    <input
                      style={styles.input}
                      type="number"
                      value={form.salary_min}
                      onChange={(e) => setForm((f) => ({ ...f, salary_min: e.target.value }))}
                      data-testid="requisition-form-salary-min"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Salary max</label>
                    <input
                      style={styles.input}
                      type="number"
                      value={form.salary_max}
                      onChange={(e) => setForm((f) => ({ ...f, salary_max: e.target.value }))}
                      data-testid="requisition-form-salary-max"
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
                  <textarea
                    style={{ ...styles.input, minHeight: 80 }}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button
                  type="button"
                  style={styles.buttonSecondary}
                  onClick={() => setFormOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.buttonPrimary} disabled={formSubmitting} data-testid="requisition-form-submit">
                  {formSubmitting ? 'Saving…' : formMode === 'create' ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {actionOpen && actionRow && actionKind && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
          data-testid={`requisition-action-${actionKind}`}
        >
          <div style={{ ...styles.card, width: '100%', maxWidth: 400 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              {actionKind === 'approve' && 'Approve requisition'}
              {actionKind === 'post' && 'Post requisition'}
              {actionKind === 'close_filled' && 'Close as filled'}
              {actionKind === 'close_cancelled' && 'Cancel requisition'}
            </h2>
            <p style={{ color: styles.colors.textSecondary, marginBottom: 16 }}>{actionRow.title}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                style={styles.buttonSecondary}
                onClick={() => {
                  setActionOpen(false);
                  setActionRow(null);
                  setActionKind(null);
                }}
                disabled={actionSubmitting}
              >
                Back
              </button>
              <button type="button" style={styles.buttonPrimary} onClick={() => void confirmAction()} disabled={actionSubmitting}>
                {actionSubmitting ? 'Working…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
