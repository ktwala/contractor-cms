import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as styles from '../styles/common';
import { P } from '../constants/permissions';
import { useAccess } from '../hooks/useAccess';
import { fetchLegalEntities, type LegalEntityItem } from '../services/recruitment/legalEntities.service';
import { candidatesService, type ApplicationApi, type CandidateApi } from '../services/recruitment/candidates.service';
import { RequisitionSelect } from '../components/selectors/RequisitionSelect';
import { TagInput } from '../components/inputs/TagInput';
import { FileUploadField } from '../components/inputs/FileUploadField';
import type { AsyncEntityOption } from '../components/selectors/AsyncEntitySelect';

const LE_KEY = 'talent_recruitment_legal_entity_id';

const STAGES = ['applied', 'phone_screen', 'interview', 'final', 'offer'] as const;

export default function Candidates() {
  const [searchParams] = useSearchParams();
  const focusCandidateId = searchParams.get('candidate_id');

  const { can } = useAccess();
  const canView =
    can(P.RECRUITMENT_CANDIDATES_VIEW) || can(P.RECRUITMENT_APPLICATIONS_VIEW);
  const canCreate = can(P.RECRUITMENT_CANDIDATES_CREATE);
  const canApply = can(P.RECRUITMENT_APPLICATIONS_CREATE);
  const canManage = can(P.RECRUITMENT_APPLICATIONS_MANAGE);
  const canRate = can(P.RECRUITMENT_APPLICATIONS_RATE);

  const [legalEntities, setLegalEntities] = useState<LegalEntityItem[]>([]);
  const [leError, setLeError] = useState(false);
  const [legalEntityId, setLegalEntityId] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem(LE_KEY) ?? '' : ''),
  );

  const [rows, setRows] = useState<CandidateApi[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error' | 'empty' | 'ready'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [cf, setCf] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    linkedin_url: '',
    source: '',
    skills: [] as string[],
    requisition_id: '' as string | undefined,
    resume_url: '',
    resume_file_label: '' as string,
  });
  const [selectedReq, setSelectedReq] = useState<AsyncEntityOption | undefined>();
  const [creating, setCreating] = useState(false);

  const [applyOpen, setApplyOpen] = useState<{ candidateId: string; name: string } | null>(null);
  const [applyReqId, setApplyReqId] = useState<string | undefined>();
  const [applyReqPreview, setApplyReqPreview] = useState<AsyncEntityOption | undefined>();
  const [applyErr, setApplyErr] = useState<string | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);

  const [actionApp, setActionApp] = useState<ApplicationApi | null>(null);
  const [actionMode, setActionMode] = useState<'stage' | 'reject' | 'rate' | null>(null);
  const [stageVal, setStageVal] = useState<string>('applied');
  const [rejectReason, setRejectReason] = useState('');
  const [rateVal, setRateVal] = useState(3);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    void fetchLegalEntities()
      .then(setLegalEntities)
      .catch(() => setLeError(true));
  }, []);

  const persistLe = (id: string) => {
    setLegalEntityId(id);
    if (id) localStorage.setItem(LE_KEY, id);
    else localStorage.removeItem(LE_KEY);
  };

  const load = useCallback(async () => {
    try {
      setErrMsg(null);
      setLoadState((p) => (p === 'ready' || p === 'empty' ? p : 'loading'));
      const data = await candidatesService.list(legalEntityId.trim() || undefined);
      setRows(data);
      setLoadState(data.length ? 'ready' : 'empty');
    } catch (e: unknown) {
      setLoadState('error');
      setErrMsg(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [legalEntityId]);

  useEffect(() => {
    if (!canView) return;
    void load();
  }, [canView, load]);

  useEffect(() => {
    if (!focusCandidateId || loadState !== 'ready') return;
    const tid = `candidate-row-${focusCandidateId}`;
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-testid="${tid}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [focusCandidateId, loadState, rows]);

  function openCreateCandidate() {
    setCf({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      linkedin_url: '',
      source: '',
      skills: [],
      requisition_id: undefined,
      resume_url: '',
      resume_file_label: '',
    });
    setSelectedReq(undefined);
    setCreateOpen(true);
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!cf.email.trim()) return;
    setCreating(true);
    try {
      const { candidate_id } = await candidatesService.create({
        first_name: cf.first_name.trim() || 'Unknown',
        last_name: cf.last_name.trim() || 'Unknown',
        email: cf.email.trim(),
        phone: cf.phone.trim() || undefined,
        linkedin_url: cf.linkedin_url.trim() || undefined,
        source: cf.source.trim() || undefined,
        skills: cf.skills.length ? cf.skills : undefined,
        resume_url: cf.resume_url.trim() || undefined,
      });
      if (cf.requisition_id?.trim() && canApply) {
        try {
          await candidatesService.applyToRequisition({
            candidate_id,
            requisition_id: cf.requisition_id.trim(),
          });
        } catch {
          /* application may already exist; ignore */
        }
      }
      setCreateOpen(false);
      setSelectedReq(undefined);
      setCf({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        linkedin_url: '',
        source: '',
        skills: [],
        requisition_id: undefined,
        resume_url: '',
        resume_file_label: '',
      });
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function submitApplyToRequisition(e: React.FormEvent) {
    e.preventDefault();
    setApplyErr(null);
    if (!applyOpen || !applyReqId?.trim()) {
      setApplyErr('Choose a requisition.');
      return;
    }
    if (!legalEntityId.trim()) {
      setApplyErr('Select a legal entity filter above.');
      return;
    }
    setApplyBusy(true);
    try {
      await candidatesService.applyToRequisition({
        candidate_id: applyOpen.candidateId,
        requisition_id: applyReqId.trim(),
      });
      setApplyOpen(null);
      setApplyReqId(undefined);
      setApplyReqPreview(undefined);
      await load();
    } catch (err: unknown) {
      setApplyErr(err instanceof Error ? err.message : 'Could not create application');
    } finally {
      setApplyBusy(false);
    }
  }

  async function submitAction() {
    if (!actionApp || !actionMode) return;
    setActionBusy(true);
    try {
      if (actionMode === 'stage') await candidatesService.moveStage(actionApp.id, stageVal);
      else if (actionMode === 'reject')
        await candidatesService.reject(actionApp.id, rejectReason.trim() || 'Rejected');
      else if (actionMode === 'rate') await candidatesService.rate(actionApp.id, rateVal);
      setActionApp(null);
      setActionMode(null);
      await load();
    } finally {
      setActionBusy(false);
    }
  }

  if (!canView) {
    return (
      <div style={styles.pageContainer} data-testid="candidates-blocked">
        <div style={styles.card}>
          <h1 style={styles.pageTitle}>Access denied</h1>
          <p style={{ color: styles.colors.textMuted }}>You cannot view candidates or applications.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer} data-testid="candidates-page">
      <div style={{ ...styles.flexBetween, ...styles.pageHeader }}>
        <div>
          <h1 style={styles.pageTitle}>Candidates</h1>
          <p style={styles.pageSubtitle}>Applicants and pipeline stages</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={styles.buttonSecondary} onClick={() => void load()} data-testid="candidates-refresh">
            Refresh
          </button>
          {canCreate && (
            <button type="button" style={styles.buttonPrimary} onClick={() => openCreateCandidate()} data-testid="candidates-create-button">
              Add Candidate
            </button>
          )}
        </div>
      </div>

      <div style={{ ...styles.card, marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Filter by legal entity (optional)</label>
        <p style={{ fontSize: 11, color: styles.colors.textMuted, margin: '0 0 8px' }}>
          Requisition picker and “apply after create” need a selected entity.
        </p>
        {legalEntities.length > 0 ? (
          <select
            style={{ ...styles.input, maxWidth: 400 }}
            value={legalEntityId}
            onChange={(e) => persistLe(e.target.value)}
          >
            <option value="">All entities</option>
            {legalEntities.map((le) => (
              <option key={le.id} value={le.id}>
                {le.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            style={{ ...styles.input, maxWidth: 400 }}
            placeholder={leError ? 'Legal entity id (optional)' : 'Loading…'}
            value={legalEntityId}
            onChange={(e) => persistLe(e.target.value)}
            disabled={!leError && legalEntities.length === 0}
          />
        )}
      </div>

      {loadState === 'loading' && (
        <div style={styles.card} data-testid="candidates-loading">
          <p style={{ color: styles.colors.textMuted }}>Loading…</p>
        </div>
      )}
      {loadState === 'error' && (
        <div style={styles.card} data-testid="candidates-error">
          <p>{errMsg}</p>
          <button type="button" style={{ ...styles.buttonPrimary, marginTop: 12 }} onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      {loadState === 'empty' && (
        <div style={styles.card} data-testid="candidates-empty">
          <p style={{ color: styles.colors.textMuted }}>No candidates yet.</p>
        </div>
      )}

      {loadState === 'ready' && (
        <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Candidate</th>
                <th style={styles.tableHeaderCell}>Email</th>
                <th style={styles.tableHeaderCell}>Applications</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  style={{
                    ...styles.tableRow,
                    ...(focusCandidateId === c.id ? { background: '#fefce8' } : {}),
                  }}
                  data-testid={`candidate-row-${c.id}`}
                >
                  <td style={styles.tableCell}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <strong>
                        {c.firstName} {c.lastName}
                      </strong>
                      {canApply && (
                        <button
                          type="button"
                          style={{ ...styles.buttonSecondary, fontSize: 11, padding: '4px 8px', alignSelf: 'flex-start' }}
                          onClick={() => {
                            setApplyErr(null);
                            setApplyReqId(undefined);
                            setApplyReqPreview(undefined);
                            setApplyOpen({
                              candidateId: c.id,
                              name: `${c.firstName} ${c.lastName}`.trim(),
                            });
                          }}
                          data-testid={`candidate-apply-${c.id}`}
                        >
                          Apply to requisition
                        </button>
                      )}
                    </div>
                  </td>
                  <td style={styles.tableCell}>{c.email}</td>
                  <td style={styles.tableCell}>
                    {(c.applications ?? []).map((a) => (
                      <div
                        key={a.id}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          padding: '8px 0',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: 13 }}>
                          {a.requisition?.title ?? a.requisitionId}: <strong>{a.stage}</strong> ({a.status})
                          {a.rating != null ? ` · ${a.rating}/5` : ''}
                        </span>
                        {canManage && a.status !== 'rejected' && a.status !== 'hired' && (
                          <>
                            <button
                              type="button"
                              style={{ ...styles.buttonSecondary, fontSize: 11, padding: '2px 8px' }}
                              onClick={() => {
                                setActionApp(a);
                                setStageVal(a.stage);
                                setActionMode('stage');
                              }}
                            >
                              Move stage
                            </button>
                            <button
                              type="button"
                              style={{ ...styles.buttonSecondary, fontSize: 11, padding: '2px 8px' }}
                              onClick={() => {
                                setActionApp(a);
                                setActionMode('reject');
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {canRate && a.status !== 'rejected' && (
                          <button
                            type="button"
                            style={{ ...styles.buttonSecondary, fontSize: 11, padding: '2px 8px' }}
                            onClick={() => {
                              setActionApp(a);
                              setRateVal(a.rating ?? 3);
                              setActionMode('rate');
                            }}
                          >
                            Rate
                          </button>
                        )}
                      </div>
                    ))}
                    {!(c.applications ?? []).length && <span style={{ color: styles.colors.textMuted }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <div style={modalOverlay} data-testid="candidate-form-modal">
          <div style={{ ...styles.card, maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>New candidate</h2>
            <p style={{ fontSize: 12, color: styles.colors.textMuted, marginBottom: 12 }}>
              Optional requisition link creates an application after save (requires applications:create and a legal entity filter).
            </p>
            <form onSubmit={(e) => void submitCreate(e)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={styles.formLabel}>First name</label>
                    <input
                      style={styles.input}
                      value={cf.first_name}
                      onChange={(e) => setCf((f) => ({ ...f, first_name: e.target.value }))}
                      data-testid="candidate-form-first-name"
                    />
                  </div>
                  <div>
                    <label style={styles.formLabel}>Last name</label>
                    <input
                      style={styles.input}
                      value={cf.last_name}
                      onChange={(e) => setCf((f) => ({ ...f, last_name: e.target.value }))}
                      data-testid="candidate-form-last-name"
                    />
                  </div>
                </div>
                <div>
                  <label style={styles.formLabel}>Email *</label>
                  <input
                    style={styles.input}
                    type="email"
                    required
                    value={cf.email}
                    onChange={(e) => setCf((f) => ({ ...f, email: e.target.value }))}
                    data-testid="candidate-form-email"
                  />
                </div>
                <div>
                  <label style={styles.formLabel}>Phone</label>
                  <input
                    style={styles.input}
                    value={cf.phone}
                    onChange={(e) => setCf((f) => ({ ...f, phone: e.target.value }))}
                    data-testid="candidate-form-phone"
                  />
                </div>
                <div>
                  <label style={styles.formLabel}>Skills</label>
                  <TagInput value={cf.skills} onChange={(skills) => setCf((f) => ({ ...f, skills }))} testId="candidate-form-skills" />
                </div>
                <div>
                  <label style={styles.formLabel}>LinkedIn URL</label>
                  <input
                    style={styles.input}
                    value={cf.linkedin_url}
                    onChange={(e) => setCf((f) => ({ ...f, linkedin_url: e.target.value }))}
                    data-testid="candidate-form-linkedin"
                  />
                </div>
                <FileUploadField
                  label="Resume"
                  value={cf.resume_url}
                  originalName={cf.resume_file_label || undefined}
                  onChangePath={(path, meta) =>
                    setCf((f) => ({
                      ...f,
                      resume_url: path,
                      resume_file_label: meta?.original_filename ?? f.resume_file_label,
                    }))
                  }
                  helperText="PDF or Word. File is stored on the server; the path is saved on the candidate."
                  testId="candidate-form-resume"
                />
                <div>
                  <label style={styles.formLabel}>Source</label>
                  <select
                    style={styles.input}
                    value={cf.source}
                    onChange={(e) => setCf((f) => ({ ...f, source: e.target.value }))}
                    data-testid="candidate-form-source"
                  >
                    <option value="">—</option>
                    <option value="referral">Referral</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="company_website">Company website</option>
                    <option value="agency">Agency</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={styles.formLabel}>Apply to posted requisition (optional)</label>
                  <RequisitionSelect
                    value={cf.requisition_id}
                    onChange={(id, opt) => {
                      setCf((f) => ({ ...f, requisition_id: id }));
                      setSelectedReq(opt);
                    }}
                    legalEntityId={legalEntityId.trim() || undefined}
                    onlyPosted
                    disabled={!legalEntityId.trim()}
                    testId="candidate-form-requisition"
                  />
                  {selectedReq && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 10,
                        borderRadius: 8,
                        background: styles.colors.background,
                        fontSize: 13,
                      }}
                      data-testid="candidate-form-requisition-preview"
                    >
                      {selectedReq.label}
                      {selectedReq.subtitle && (
                        <div style={{ color: styles.colors.textMuted, marginTop: 4 }}>{selectedReq.subtitle}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" style={styles.buttonSecondary} onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" style={styles.buttonPrimary} disabled={creating} data-testid="candidate-form-submit">
                  {creating ? 'Saving…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {applyOpen && (
        <div style={modalOverlay} data-testid="apply-candidate-dialog">
          <div style={{ ...styles.card, maxWidth: 440, width: '100%' }}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Apply to requisition</h2>
            <p style={{ fontSize: 13, color: styles.colors.textMuted, marginBottom: 12 }}>
              {applyOpen.name} — choose an open posted job ({legalEntityId.trim() ? 'entity filter active' : 'select legal entity above'}).
            </p>
            <form onSubmit={(e) => void submitApplyToRequisition(e)}>
              <label style={styles.formLabel}>Requisition</label>
              <RequisitionSelect
                value={applyReqId}
                onChange={(id, opt) => {
                  setApplyReqId(id);
                  setApplyReqPreview(opt);
                  setApplyErr(null);
                }}
                legalEntityId={legalEntityId.trim() || undefined}
                onlyPosted
                disabled={!legalEntityId.trim()}
                testId="apply-candidate-requisition"
              />
              {applyReqPreview && (
                <div style={{ marginTop: 10, padding: 10, background: styles.colors.background, borderRadius: 8, fontSize: 13 }}>
                  <strong>{applyReqPreview.label}</strong>
                  {applyReqPreview.subtitle && (
                    <div style={{ color: styles.colors.textMuted, marginTop: 4 }}>{applyReqPreview.subtitle}</div>
                  )}
                </div>
              )}
              {applyErr && <p style={{ color: styles.colors.danger, fontSize: 13, marginTop: 10 }}>{applyErr}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" style={styles.buttonSecondary} onClick={() => setApplyOpen(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.buttonPrimary}
                  disabled={applyBusy || !legalEntityId.trim()}
                  data-testid="apply-candidate-submit"
                >
                  {applyBusy ? '…' : 'Apply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {actionApp && actionMode && (
        <div style={modalOverlay}>
          <div style={{ ...styles.card, maxWidth: 400, width: '100%' }}>
            {actionMode === 'stage' && (
              <>
                <h3 style={{ marginBottom: 8 }}>Move stage</h3>
                <select style={styles.input} value={stageVal} onChange={(e) => setStageVal(e.target.value)}>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </>
            )}
            {actionMode === 'reject' && (
              <>
                <h3 style={{ marginBottom: 8 }}>Reject application</h3>
                <textarea
                  style={styles.input}
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason"
                />
              </>
            )}
            {actionMode === 'rate' && (
              <>
                <h3 style={{ marginBottom: 8 }}>Rating (1–5)</h3>
                <select style={styles.input} value={rateVal} onChange={(e) => setRateVal(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                style={styles.buttonSecondary}
                onClick={() => {
                  setActionApp(null);
                  setActionMode(null);
                }}
              >
                Cancel
              </button>
              <button type="button" style={styles.buttonPrimary} disabled={actionBusy} onClick={() => void submitAction()}>
                {actionBusy ? '…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalOverlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  padding: 16,
};
