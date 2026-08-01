import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import * as styles from '../styles/common';
import { P } from '../constants/permissions';
import { useAccess } from '../hooks/useAccess';
import { fetchLegalEntities, type LegalEntityItem } from '../services/recruitment/legalEntities.service';
import {
  onboardingRecruitmentService,
  type OnboardingDetail,
  type OnboardingListRow,
} from '../services/recruitment/onboarding.service';
import { OfferSelect } from '../components/selectors/OfferSelect';
import type { AsyncEntityOption } from '../components/selectors/AsyncEntitySelect';

function getQueryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

function axiosErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object' || !('response' in err)) {
    return err instanceof Error ? err.message : 'Request failed';
  }
  const data = (err as { response?: { data?: { message?: unknown } } }).response?.data?.message;
  if (Array.isArray(data)) return data.join(', ');
  if (typeof data === 'string') return data;
  return 'Request failed';
}

const LE_KEY = 'talent_recruitment_legal_entity_id';

export default function Onboarding() {
  const { can } = useAccess();
  const canView = can(P.RECRUITMENT_ONBOARDING_VIEW);
  const canCreate = can(P.RECRUITMENT_ONBOARDING_CREATE);
  const canComplete = can(P.RECRUITMENT_ONBOARDING_COMPLETE_TASKS);
  const canManageDocs = can(P.RECRUITMENT_ONBOARDING_MANAGE_DOCUMENTS);
  const canUpload = can(P.RECRUITMENT_ONBOARDING_UPLOAD_DOCUMENTS);
  const canVerify = can(P.RECRUITMENT_ONBOARDING_VERIFY_DOCUMENTS);

  const [legalEntities, setLegalEntities] = useState<LegalEntityItem[]>([]);
  const [leErr, setLeErr] = useState(false);
  const [legalEntityId, setLegalEntityId] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem(LE_KEY) ?? '' : ''),
  );

  const [list, setList] = useState<OnboardingListRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OnboardingDetail | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [msg, setMsg] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [cf, setCf] = useState({
    offer_id: '',
    start_date: '',
    workflow_name: '',
    notes: '',
  });
  const [selectedOffer, setSelectedOffer] = useState<AsyncEntityOption | undefined>();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const [uploadDocId, setUploadDocId] = useState<string | null>(null);
  const [filePath, setFilePath] = useState('');

  const [addDocOpen, setAddDocOpen] = useState(false);
  const [docForm, setDocForm] = useState({ type: '', name: '' });

  useEffect(() => {
    void fetchLegalEntities()
      .then(setLegalEntities)
      .catch(() => setLeErr(true));
  }, []);

  const persistLe = (id: string) => {
    setLegalEntityId(id);
    if (id) localStorage.setItem(LE_KEY, id);
    else localStorage.removeItem(LE_KEY);
  };

  const loadList = useCallback(async () => {
    if (!canView) return;
    try {
      setMsg(null);
      setState('loading');
      const data = await onboardingRecruitmentService.list(legalEntityId.trim() || undefined);
      setList(data);
      setState('ready');
    } catch (e: unknown) {
      setState('error');
      setMsg(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [canView, legalEntityId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const wid = getQueryParam('workflow_id');
    if (!wid || !list.length) return;
    if (list.some((w) => w.id === wid)) {
      setSelectedId(wid);
    }
  }, [list]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void onboardingRecruitmentService
      .get(selectedId)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [selectedId]);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!cf.offer_id.trim() || !cf.start_date || !legalEntityId.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const created = await onboardingRecruitmentService.create({
        offer_id: cf.offer_id.trim(),
        start_date: cf.start_date,
        workflow_name: cf.workflow_name.trim() || undefined,
        legal_entity_id: legalEntityId.trim(),
        notes: cf.notes.trim() || undefined,
      });
      setCreateOpen(false);
      setCf({ offer_id: '', start_date: '', workflow_name: '', notes: '' });
      setSelectedOffer(undefined);
      await loadList();
      if (created.workflow_id) {
        setSelectedId(created.workflow_id);
        const name = created.employee_name?.trim();
        const base = name
          ? `Employee created and onboarding started (${name}).`
          : 'Employee created and onboarding started.';
        if (created.employment_record_created) {
          setFlash(`${base} Payroll employment shell created (pay group + effective date).`);
        } else if (created.employment_setup_required) {
          setFlash(
            `${base} Payroll employment was not created automatically — complete the “Complete employment & payroll setup” task or add a pay group for this legal entity.`,
          );
        } else {
          setFlash(base);
        }
        window.setTimeout(() => setFlash(null), 12_000);
      }
    } catch (err: unknown) {
      setMsg(axiosErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function addDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !docForm.type.trim()) return;
    setBusy(true);
    try {
      await onboardingRecruitmentService.addDocument(selectedId, {
        document_type: docForm.type.trim(),
        document_name: docForm.name.trim() || docForm.type.trim(),
        is_required: true,
      });
      setAddDocOpen(false);
      setDocForm({ type: '', name: '' });
      const d = await onboardingRecruitmentService.get(selectedId);
      setDetail(d);
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  async function submitUpload() {
    if (!uploadDocId) return;
    setBusy(true);
    try {
      await onboardingRecruitmentService.uploadDocument(uploadDocId, filePath.trim() || '/unknown');
      setUploadDocId(null);
      setFilePath('');
      if (selectedId) {
        const d = await onboardingRecruitmentService.get(selectedId);
        setDetail(d);
      }
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <div style={styles.pageContainer} data-testid="onboarding-blocked">
        <div style={styles.card}>
          <h1 style={styles.pageTitle}>Access denied</h1>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer} data-testid="onboarding-page">
      <div style={{ ...styles.flexBetween, ...styles.pageHeader }}>
        <div>
          <h1 style={styles.pageTitle}>New-hire onboarding</h1>
          <p style={styles.pageSubtitle}>
            New hires: pick an accepted offer (API also accepts application_id). Existing employees: use API with
            employee_id.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={styles.buttonSecondary} onClick={() => void loadList()} data-testid="onboarding-refresh-button">
            Refresh
          </button>
          {canCreate && (
            <button type="button" style={styles.buttonPrimary} onClick={() => setCreateOpen(true)} data-testid="onboarding-create-button">
              Start onboarding
            </button>
          )}
        </div>
      </div>

      <div style={{ ...styles.card, marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Filter by legal entity (optional)</label>
        {legalEntities.length > 0 ? (
          <select style={{ ...styles.input, maxWidth: 400 }} value={legalEntityId} onChange={(e) => persistLe(e.target.value)}>
            <option value="">All</option>
            {legalEntities.map((le) => (
              <option key={le.id} value={le.id}>
                {le.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            style={{ ...styles.input, maxWidth: 400 }}
            placeholder={leErr ? 'Legal entity id' : 'Loading…'}
            value={legalEntityId}
            onChange={(e) => persistLe(e.target.value)}
            disabled={!leErr && legalEntities.length === 0}
          />
        )}
      </div>

      {flash && (
        <div
          style={{
            ...styles.card,
            marginBottom: 16,
            borderLeft: `4px solid ${styles.colors.primary}`,
            background: '#f0fdf4',
          }}
          data-testid="onboarding-success-flash"
        >
          <p style={{ margin: 0, fontSize: 14 }}>{flash}</p>
        </div>
      )}

      {state === 'ready' && msg && (
        <div
          style={{
            ...styles.card,
            marginBottom: 16,
            borderLeft: '4px solid #dc2626',
            background: '#fef2f2',
          }}
          data-testid="onboarding-inline-error"
        >
          <p style={{ margin: 0, fontSize: 14 }}>{msg}</p>
          <button type="button" style={{ ...styles.buttonSecondary, marginTop: 8 }} onClick={() => setMsg(null)}>
            Dismiss
          </button>
        </div>
      )}

      {state === 'error' && (
        <div style={styles.card} data-testid="onboarding-error">
          <p>{msg}</p>
          <button type="button" style={{ ...styles.buttonPrimary, marginTop: 8 }} onClick={() => void loadList()}>
            Retry
          </button>
        </div>
      )}

      {state === 'ready' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
          <div style={styles.card}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Workflows</h2>
            {!list.length ? (
              <p style={{ color: styles.colors.textMuted }} data-testid="onboarding-empty">
                No workflows.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {list.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(w.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        marginBottom: 6,
                        borderRadius: 8,
                        border: `1px solid ${selectedId === w.id ? styles.colors.primary : styles.colors.border}`,
                        background: selectedId === w.id ? '#eef2ff' : '#fff',
                        cursor: 'pointer',
                      }}
                      data-testid={`onboarding-row-${w.id}`}
                    >
                      <div style={{ fontWeight: 600 }}>{w.employee_name ?? w.employee_id}</div>
                      <div style={{ fontSize: 12, color: styles.colors.textMuted }}>
                        {w.workflow_name} · {w.status} · {w.progress ?? 0}%
                      </div>
                      {w.candidate_name && w.candidate_name !== w.employee_name && (
                        <div style={{ fontSize: 11, color: styles.colors.textMuted, marginTop: 4 }}>
                          From candidate: {w.candidate_name}
                        </div>
                      )}
                      {w.offer_status && (
                        <div style={{ fontSize: 11, color: styles.colors.textMuted, marginTop: 2 }}>
                          Offer: {w.offer_status}
                        </div>
                      )}
                      {w.hiring_manager_name && (
                        <div style={{ fontSize: 11, color: styles.colors.textMuted, marginTop: 2 }}>
                          HM: {w.hiring_manager_name}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={styles.card} data-testid="onboarding-detail-panel">
            {!detail ? (
              <p style={{ color: styles.colors.textMuted }}>Select a workflow.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <h2 style={{ fontSize: 16, margin: 0 }}>{detail.workflowName}</h2>
                  {detail.offer_status && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: detail.offer_status === 'accepted' ? '#d1fae5' : '#f1f5f9',
                        color: detail.offer_status === 'accepted' ? '#065f46' : '#475569',
                      }}
                      data-testid={`onboarding-offer-status-${detail.offer_status}`}
                    >
                      Offer: {detail.offer_status}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 14, color: styles.colors.textMuted, marginBottom: 12 }}>
                  {detail.employee_name} · Progress {detail.progress ?? 0}%
                </p>
                {(detail.payroll_employment_count ?? 0) === 0 && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: 10,
                      borderRadius: 10,
                      border: '1px solid #fcd34d',
                      background: '#fffbeb',
                      fontSize: 13,
                      color: '#78350f',
                    }}
                    data-testid="onboarding-payroll-employment-missing"
                  >
                    <strong>Payroll employment</strong>: this employee has no payroll Employment record yet. Complete the
                    payroll onboarding task below, or create employment in Workforce. Other onboarding steps can still
                    proceed.
                  </div>
                )}
                {(detail.payroll_employment_count ?? 0) > 0 && (
                  <p
                    style={{ fontSize: 12, color: '#065f46', marginBottom: 12 }}
                    data-testid="onboarding-payroll-employment-ok"
                  >
                    Payroll employment linked ({detail.payroll_employment_count} record
                    {detail.payroll_employment_count === 1 ? '' : 's'}).
                  </p>
                )}
                {(detail.candidate_name ||
                  detail.offer_id ||
                  detail.requisition_title ||
                  detail.employee_number ||
                  detail.hiring_manager_name ||
                  detail.offer_position) && (
                  <div
                    style={{
                      border: `1px solid ${styles.colors.border}`,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 16,
                      fontSize: 13,
                    }}
                    data-testid="onboarding-origin-section"
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>Origin</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {detail.candidate_id && (
                          <Link
                            to={`/recruitment/candidates?candidate_id=${encodeURIComponent(detail.candidate_id)}`}
                            style={{ ...styles.buttonSecondary, fontSize: 11, padding: '4px 10px', textDecoration: 'none' }}
                            data-testid="onboarding-open-candidate"
                          >
                            Open candidate
                          </Link>
                        )}
                        {detail.offer_id && (
                          <Link
                            to={`/recruitment/offers?offer_id=${encodeURIComponent(detail.offer_id)}`}
                            style={{ ...styles.buttonSecondary, fontSize: 11, padding: '4px 10px', textDecoration: 'none' }}
                            data-testid="onboarding-open-offer"
                          >
                            Open offer
                          </Link>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Candidate</div>
                        <div>{detail.candidate_name ?? '—'}</div>
                        {detail.candidate_id && (
                          <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{detail.candidate_id}</div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Role (offer)</div>
                        <div>{detail.offer_position ?? '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Department</div>
                        <div>{detail.requisition_department ?? '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Hiring manager</div>
                        <div>{detail.hiring_manager_name ?? '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Accepted offer</div>
                        <div>{detail.offer_id ?? '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Created employee</div>
                        <div>{detail.employee_name ?? '—'}</div>
                        {detail.employee_number && (
                          <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{detail.employee_number}</div>
                        )}
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Requisition</div>
                        <div>{detail.requisition_title ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                )}
                {canManageDocs && (
                  <button
                    type="button"
                    style={{ ...styles.buttonSecondary, marginBottom: 16, fontSize: 12 }}
                    onClick={() => setAddDocOpen(true)}
                  >
                    Add document requirement
                  </button>
                )}
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>Tasks</h3>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 20 }}>
                  {(detail.tasks ?? []).map((t) => (
                    <li
                      key={t.id}
                      style={{
                        padding: '8px 0',
                        borderBottom: `1px solid ${styles.colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>
                        {t.taskName} <small style={{ color: styles.colors.textMuted }}>({t.status})</small>
                      </span>
                      {canComplete && t.status !== 'completed' && (
                        <button
                          type="button"
                          style={{ ...styles.buttonSecondary, fontSize: 11, padding: '2px 8px' }}
                          onClick={() =>
                            void onboardingRecruitmentService.completeTask(t.id).then(async () => {
                              const d = await onboardingRecruitmentService.get(selectedId!);
                              setDetail(d);
                              await loadList();
                            })
                          }
                        >
                          Complete
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>Documents</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {(detail.documents ?? []).map((d) => (
                    <li
                      key={d.id}
                      style={{ padding: '8px 0', borderBottom: `1px solid ${styles.colors.border}`, fontSize: 14 }}
                    >
                      <strong>{d.documentName}</strong> — {d.status}
                      {canUpload && d.status === 'pending' && (
                        <button
                          type="button"
                          style={{ ...styles.buttonSecondary, fontSize: 11, marginLeft: 8 }}
                          onClick={() => setUploadDocId(d.id)}
                        >
                          Upload
                        </button>
                      )}
                      {canVerify && d.status === 'uploaded' && (
                        <button
                          type="button"
                          style={{ ...styles.buttonSecondary, fontSize: 11, marginLeft: 8 }}
                          onClick={() =>
                            void onboardingRecruitmentService.verifyDocument(d.id).then(async () => {
                              const det = await onboardingRecruitmentService.get(selectedId!);
                              setDetail(det);
                              await loadList();
                            })
                          }
                        >
                          Verify
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {createOpen && (
        <div style={overlay} data-testid="create-onboarding-modal">
          <div style={{ ...styles.card, maxWidth: 520, width: '100%' }}>
            <h2 style={{ marginBottom: 8 }}>Start new-hire onboarding</h2>
            <p style={{ fontSize: 13, color: styles.colors.textMuted, marginBottom: 12 }}>
              Choose a legal entity, then pick an accepted offer. The system creates the employee record and opens the
              workflow.
            </p>
            <form onSubmit={(e) => void submitCreate(e)}>
              <label style={styles.formLabel}>Select candidate (offer accepted)</label>
              {!legalEntityId.trim() ? (
                <p style={{ fontSize: 13, color: styles.colors.textMuted, marginBottom: 8 }}>
                  Select a legal entity in the filter above to search offers for that entity.
                </p>
              ) : null}
              <OfferSelect
                value={cf.offer_id || undefined}
                onChange={(id, opt) => {
                  setCf((c) => ({ ...c, offer_id: id ?? '' }));
                  setSelectedOffer(opt);
                }}
                legalEntityId={legalEntityId.trim() || undefined}
                acceptedOnly
                disabled={!legalEntityId.trim()}
                placeholder="Search by name, email, or role…"
                testId="create-onboarding-offer"
              />
              {selectedOffer && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: `1px solid ${styles.colors.border}`,
                    fontSize: 13,
                  }}
                  data-testid="create-onboarding-offer-preview"
                >
                  <div style={{ fontWeight: 600 }}>{selectedOffer.label}</div>
                  {selectedOffer.subtitle && (
                    <div style={{ color: styles.colors.textMuted, marginTop: 4 }}>{selectedOffer.subtitle}</div>
                  )}
                  {(() => {
                    const m = selectedOffer.meta as
                      | {
                          position?: string;
                          department?: string | null;
                          hiring_manager_name?: string | null;
                        }
                      | undefined;
                    if (!m?.position && !m?.department && !m?.hiring_manager_name) return null;
                    return (
                      <div style={{ marginTop: 8, fontSize: 12, color: styles.colors.text }}>
                        {m.position && (
                          <div>
                            <span style={{ color: styles.colors.textMuted }}>Role: </span>
                            {m.position}
                          </div>
                        )}
                        {m.department && (
                          <div>
                            <span style={{ color: styles.colors.textMuted }}>Department: </span>
                            {m.department}
                          </div>
                        )}
                        {m.hiring_manager_name && (
                          <div>
                            <span style={{ color: styles.colors.textMuted }}>Hiring manager: </span>
                            {m.hiring_manager_name}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
              <label style={{ ...styles.formLabel, marginTop: 12 }}>Start date</label>
              <input
                style={styles.input}
                type="date"
                value={cf.start_date}
                onChange={(e) => setCf((c) => ({ ...c, start_date: e.target.value }))}
                required
                data-testid="create-onboarding-start-date"
              />
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 10,
                  border: `1px dashed ${styles.colors.border}`,
                  background: '#fffbeb',
                  fontSize: 12,
                  color: '#92400e',
                }}
                data-testid="create-onboarding-template-coming-soon"
              >
                <strong>Workflow templates (task packs)</strong> — coming soon. Only the default welcome task is created
                today; choosing a template will not change behaviour until task packs ship.
              </div>
              <label style={{ ...styles.formLabel, marginTop: 10 }}>Workflow name (optional)</label>
              <input
                style={styles.input}
                placeholder="e.g. SOC new hire"
                value={cf.workflow_name}
                onChange={(e) => setCf((c) => ({ ...c, workflow_name: e.target.value }))}
              />
              <label style={{ ...styles.formLabel, marginTop: 10 }}>Notes (optional)</label>
              <textarea
                style={{ ...styles.input, minHeight: 72, resize: 'vertical' as const }}
                placeholder="Optional notes for HR"
                value={cf.notes}
                onChange={(e) => setCf((c) => ({ ...c, notes: e.target.value }))}
                data-testid="create-onboarding-notes"
              />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  gap: 8,
                  marginTop: 16,
                }}
                className="onboarding-create-footer"
              >
                <button type="button" style={styles.buttonSecondary} onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.buttonPrimary}
                  disabled={busy || !legalEntityId.trim()}
                  data-testid="create-onboarding-submit"
                >
                  {busy ? 'Starting…' : 'Start onboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addDocOpen && selectedId && (
        <div style={overlay}>
          <div style={{ ...styles.card, maxWidth: 400, width: '100%' }}>
            <h3 style={{ marginBottom: 8 }}>Add document</h3>
            <form onSubmit={(e) => void addDocument(e)}>
              <input
                style={styles.input}
                placeholder="Document type"
                value={docForm.type}
                onChange={(e) => setDocForm((d) => ({ ...d, type: e.target.value }))}
                required
              />
              <input
                style={{ ...styles.input, marginTop: 8 }}
                placeholder="Display name"
                value={docForm.name}
                onChange={(e) => setDocForm((d) => ({ ...d, name: e.target.value }))}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" style={styles.buttonSecondary} onClick={() => setAddDocOpen(false)}>
                  Cancel
                </button>
                <button type="submit" style={styles.buttonPrimary} disabled={busy}>
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {uploadDocId && (
        <div style={overlay}>
          <div style={{ ...styles.card, maxWidth: 400, width: '100%' }}>
            <h3 style={{ marginBottom: 8 }}>Upload document</h3>
            <input
              style={styles.input}
              placeholder="File path / URL"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" style={styles.buttonSecondary} onClick={() => setUploadDocId(null)}>
                Cancel
              </button>
              <button type="button" style={styles.buttonPrimary} disabled={busy} onClick={() => void submitUpload()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  padding: 16,
};
