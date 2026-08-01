import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import * as styles from '../styles/common';
import { P } from '../constants/permissions';
import { useAccess } from '../hooks/useAccess';
import { fetchLegalEntities, type LegalEntityItem } from '../services/recruitment/legalEntities.service';
import { interviewsService, type InterviewApi } from '../services/recruitment/interviews.service';
import { ApplicationSelect } from '../components/selectors/ApplicationSelect';
import { MultiUserSelect } from '../components/selectors/MultiUserSelect';
import type { AsyncEntityOption } from '../components/selectors/AsyncEntitySelect';

const LE_KEY = 'talent_recruitment_legal_entity_id';

export default function Interviews() {
  const { can } = useAccess();
  const canView = can(P.RECRUITMENT_INTERVIEWS_VIEW);
  const canSchedule = can(P.RECRUITMENT_INTERVIEWS_SCHEDULE);
  const canFeedback = can(P.RECRUITMENT_INTERVIEWS_FEEDBACK);
  const canManage = can(P.RECRUITMENT_INTERVIEWS_MANAGE);

  const [legalEntities, setLegalEntities] = useState<LegalEntityItem[]>([]);
  const [leErr, setLeErr] = useState(false);
  const [legalEntityId, setLegalEntityId] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem(LE_KEY) ?? '' : ''),
  );

  const [all, setAll] = useState<InterviewApi[]>([]);
  const [mine, setMine] = useState<InterviewApi[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'empty' | 'ready'>('loading');
  const [msg, setMsg] = useState<string | null>(null);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sf, setSf] = useState({
    application_id: '',
    interview_type: 'technical',
    scheduled_local: '',
    interviewer_ids: [] as string[],
    location: '',
  });
  const [selectedApplication, setSelectedApplication] = useState<AsyncEntityOption | undefined>();
  const [schedBusy, setSchedBusy] = useState(false);
  const [schedErr, setSchedErr] = useState<string | null>(null);

  const [fbIv, setFbIv] = useState<InterviewApi | null>(null);
  const [fbRating, setFbRating] = useState(3);
  const [fbRec, setFbRec] = useState('hire');
  const [fbNotes, setFbNotes] = useState('');
  const [fbBusy, setFbBusy] = useState(false);

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

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      setMsg(null);
      setState('loading');
      const my = await interviewsService.myInterviews();
      setMine(my);
      if (!legalEntityId.trim()) {
        setAll([]);
        setState(my.length ? 'ready' : 'empty');
        return;
      }
      const list = await interviewsService.list(legalEntityId.trim());
      setAll(list);
      setState(list.length || my.length ? 'ready' : 'empty');
    } catch (e: unknown) {
      setState('error');
      setMsg(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [canView, legalEntityId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openScheduleModal() {
    setSchedErr(null);
    setSelectedApplication(undefined);
    setSf({
      application_id: '',
      interview_type: 'technical',
      scheduled_local: '',
      interviewer_ids: [],
      location: '',
    });
    setScheduleOpen(true);
  }

  async function submitSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSchedErr(null);
    if (!legalEntityId.trim()) {
      setSchedErr('Select a legal entity above to search applications.');
      return;
    }
    const [primary, ...additional] = sf.interviewer_ids;
    if (!sf.application_id.trim() || !primary || !sf.scheduled_local) return;
    setSchedBusy(true);
    try {
      const scheduled_date = new Date(sf.scheduled_local).toISOString();
      await interviewsService.schedule({
        application_id: sf.application_id.trim(),
        interview_type: sf.interview_type,
        scheduled_date,
        interviewer_id: primary,
        location: sf.location.trim() || undefined,
        additional_interviewers: additional.length ? additional : undefined,
      });
      setScheduleOpen(false);
      setSelectedApplication(undefined);
      setSf({
        application_id: '',
        interview_type: 'technical',
        scheduled_local: '',
        interviewer_ids: [],
        location: '',
      });
      await load();
    } finally {
      setSchedBusy(false);
    }
  }

  async function submitFeedback() {
    if (!fbIv) return;
    setFbBusy(true);
    try {
      await interviewsService.feedback(fbIv.id, {
        overall_rating: fbRating,
        recommendation: fbRec,
        detailed_feedback: fbNotes,
      });
      setFbIv(null);
      await load();
    } finally {
      setFbBusy(false);
    }
  }

  if (!canView) {
    return (
      <div style={styles.pageContainer} data-testid="interviews-blocked">
        <div style={styles.card}>
          <h1 style={styles.pageTitle}>Access denied</h1>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer} data-testid="interviews-page">
      <div style={{ ...styles.flexBetween, ...styles.pageHeader }}>
        <div>
          <h1 style={styles.pageTitle}>Interviews</h1>
          <p style={styles.pageSubtitle}>Scheduled interviews and your assignments</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={styles.buttonSecondary} onClick={() => void load()} data-testid="interviews-refresh-button">
            Refresh
          </button>
          {canSchedule && (
            <button type="button" style={styles.buttonPrimary} onClick={() => openScheduleModal()} data-testid="interviews-schedule-button">
              Schedule
            </button>
          )}
        </div>
      </div>

      <div style={{ ...styles.card, marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Legal entity (for full list)</label>
        <p style={{ fontSize: 11, color: styles.colors.textMuted, margin: '0 0 8px' }}>
          Scheduling interviews also requires a legal entity so applications and users can be searched.
        </p>
        {legalEntities.length > 0 ? (
          <select style={{ ...styles.input, maxWidth: 400 }} value={legalEntityId} onChange={(e) => persistLe(e.target.value)}>
            <option value="">My interviews only</option>
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

      {state === 'error' && (
        <div style={styles.card} data-testid="interviews-error">
          <p>{msg}</p>
          <button type="button" style={{ ...styles.buttonPrimary, marginTop: 8 }} onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {state === 'empty' && (
        <div style={styles.card} data-testid="interviews-empty">
          <p style={{ color: styles.colors.textMuted }}>No interviews.</p>
        </div>
      )}

      {state === 'ready' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={styles.card}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>All (entity)</h2>
            {!legalEntityId.trim() ? (
              <p style={{ color: styles.colors.textMuted, fontSize: 13 }}>Select a legal entity to load all interviews.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {all.map((i) => (
                  <li
                    key={i.id}
                    style={{ borderBottom: '1px solid #e2e8f0', padding: '10px 0', fontSize: 14 }}
                    data-testid={`interview-row-${i.id}`}
                  >
                    <strong>{i.candidate_name}</strong> · {i.requisition_title}
                    <div style={{ color: styles.colors.textMuted, fontSize: 12 }}>
                      {i.interview_type} · {i.scheduled_date ? new Date(i.scheduled_date).toLocaleString() : '—'} · {i.status}
                    </div>
                    {canManage && i.status === 'scheduled' && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          style={{ ...styles.buttonSecondary, fontSize: 11, padding: '2px 8px' }}
                          onClick={() => void interviewsService.complete(i.id).then(() => load())}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          style={{ ...styles.buttonSecondary, fontSize: 11, padding: '2px 8px' }}
                          onClick={() => void interviewsService.cancel(i.id, 'Cancelled').then(() => load())}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div style={styles.card} data-testid="my-interviews-panel">
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>My interviews</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {mine.map((i) => (
                <li key={i.id} style={{ borderBottom: '1px solid #e2e8f0', padding: '10px 0', fontSize: 14 }}>
                  <strong>{i.candidate_name}</strong>
                  <div style={{ color: styles.colors.textMuted, fontSize: 12 }}>
                    {i.scheduled_date ? new Date(i.scheduled_date).toLocaleString() : '—'} · {i.status}
                  </div>
                  {canFeedback && i.status === 'scheduled' && (
                    <button
                      type="button"
                      style={{ ...styles.buttonSecondary, fontSize: 11, marginTop: 6 }}
                      onClick={() => {
                        setFbIv(i);
                        setFbRating(3);
                        setFbRec('hire');
                        setFbNotes('');
                      }}
                    >
                      {i.current_user_has_feedback ? 'Update feedback' : 'Feedback'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {scheduleOpen && (
        <div style={overlay} data-testid="schedule-interview-modal">
          <div style={{ ...styles.card, maxWidth: 520, width: '100%' }}>
            <h2 style={{ marginBottom: 8 }}>Schedule interview</h2>
            <p style={{ fontSize: 13, color: styles.colors.textMuted, marginBottom: 16 }}>
              Choose an application and interview panel. Requires a legal entity selected above.
            </p>
            <form onSubmit={(e) => void submitSchedule(e)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={styles.formLabel}>Application</label>
                  <ApplicationSelect
                    value={sf.application_id || undefined}
                    onChange={(id, opt) => {
                      setSf((s) => ({ ...s, application_id: id ?? '' }));
                      setSelectedApplication(opt);
                    }}
                    legalEntityId={legalEntityId.trim() || undefined}
                    allowedStages={['applied', 'phone_screen', 'interview']}
                    disabled={!legalEntityId.trim()}
                    testId="schedule-interview-application"
                  />
                </div>
                {selectedApplication && (
                  <div
                    style={{
                      ...styles.card,
                      padding: 12,
                      background: styles.colors.background,
                      fontSize: 13,
                    }}
                    data-testid="schedule-interview-selected-application"
                  >
                    <strong>{selectedApplication.label}</strong>
                    {selectedApplication.subtitle && (
                      <div style={{ color: styles.colors.textMuted, marginTop: 4 }}>Stage: {selectedApplication.subtitle}</div>
                    )}
                  </div>
                )}
                <div>
                  <label style={styles.formLabel}>Interviewers</label>
                  <p style={{ fontSize: 12, color: styles.colors.textMuted, margin: '0 0 6px' }}>
                    First selected user is the primary interviewer; additional members join the panel.
                  </p>
                  <MultiUserSelect
                    value={sf.interviewer_ids}
                    onChange={(ids) => setSf((s) => ({ ...s, interviewer_ids: ids }))}
                    legalEntityId={legalEntityId.trim() || undefined}
                    disabled={!legalEntityId.trim()}
                    testId="schedule-interview-interviewers"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={styles.formLabel}>Type</label>
                    <select
                      style={styles.input}
                      value={sf.interview_type}
                      onChange={(e) => setSf((s) => ({ ...s, interview_type: e.target.value }))}
                      data-testid="schedule-interview-type"
                    >
                      <option value="phone">Phone</option>
                      <option value="video">Video</option>
                      <option value="onsite">Onsite</option>
                      <option value="technical">Technical</option>
                      <option value="panel">Panel</option>
                    </select>
                  </div>
                  <div>
                    <label style={styles.formLabel}>Date & time</label>
                    <input
                      style={styles.input}
                      type="datetime-local"
                      value={sf.scheduled_local}
                      onChange={(e) => setSf((s) => ({ ...s, scheduled_local: e.target.value }))}
                      required
                      data-testid="schedule-interview-datetime"
                    />
                  </div>
                </div>
                <div>
                  <label style={styles.formLabel}>Location / link (optional)</label>
                  <input
                    style={styles.input}
                    placeholder="Room or video URL"
                    value={sf.location}
                    onChange={(e) => setSf((s) => ({ ...s, location: e.target.value }))}
                    data-testid="schedule-interview-location"
                  />
                </div>
                {schedErr && <p style={{ color: styles.colors.danger, fontSize: 13, margin: 0 }}>{schedErr}</p>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" style={styles.buttonSecondary} onClick={() => setScheduleOpen(false)} data-testid="schedule-interview-cancel">
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.buttonPrimary}
                  disabled={schedBusy || !legalEntityId.trim()}
                  data-testid="schedule-interview-submit"
                >
                  {schedBusy ? '…' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {fbIv && (
        <div style={overlay}>
          <div style={{ ...styles.card, maxWidth: 400, width: '100%' }}>
            <h3 style={{ marginBottom: 8 }}>Feedback</h3>
            <select style={styles.input} value={fbRating} onChange={(e) => setFbRating(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <select style={{ ...styles.input, marginTop: 8 }} value={fbRec} onChange={(e) => setFbRec(e.target.value)}>
              <option value="strong_hire">Strong hire</option>
              <option value="hire">Hire</option>
              <option value="no_hire">No hire</option>
              <option value="strong_no_hire">Strong no hire</option>
            </select>
            <textarea
              style={{ ...styles.input, marginTop: 8, minHeight: 80 }}
              placeholder="Notes"
              value={fbNotes}
              onChange={(e) => setFbNotes(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" style={styles.buttonSecondary} onClick={() => setFbIv(null)}>
                Cancel
              </button>
              <button type="button" style={styles.buttonPrimary} disabled={fbBusy} onClick={() => void submitFeedback()}>
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
