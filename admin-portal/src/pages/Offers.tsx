import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as styles from '../styles/common';
import { P } from '../constants/permissions';
import { useAccess } from '../hooks/useAccess';
import { fetchLegalEntities, type LegalEntityItem } from '../services/recruitment/legalEntities.service';
import { offersService, type OfferApi } from '../services/recruitment/offers.service';
import { ApplicationSelect } from '../components/selectors/ApplicationSelect';
import type { AsyncEntityOption } from '../components/selectors/AsyncEntitySelect';
import { FileUploadField } from '../components/inputs/FileUploadField';

const LE_KEY = 'talent_recruitment_legal_entity_id';

export default function Offers() {
  const [searchParams] = useSearchParams();
  const focusOfferId = searchParams.get('offer_id');

  const { can } = useAccess();
  const canView = can(P.RECRUITMENT_OFFERS_VIEW);
  const canCreate = can(P.RECRUITMENT_OFFERS_CREATE);
  const canApprove = can(P.RECRUITMENT_OFFERS_APPROVE);
  const canSend = can(P.RECRUITMENT_OFFERS_SEND);

  const [legalEntities, setLegalEntities] = useState<LegalEntityItem[]>([]);
  const [leErr, setLeErr] = useState(false);
  const [legalEntityId, setLegalEntityId] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem(LE_KEY) ?? '' : ''),
  );

  const [rows, setRows] = useState<OfferApi[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'empty' | 'ready'>('loading');
  const [msg, setMsg] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [cf, setCf] = useState({
    application_id: '',
    salary: '',
    offer_expiry_date: '',
    job_title: '',
    currency: 'ZAR',
    bonus: '',
    start_date: '',
    offer_letter_path: '',
    offer_letter_name: '',
  });
  const [selectedApp, setSelectedApp] = useState<AsyncEntityOption | undefined>();
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sendId, setSendId] = useState<string | null>(null);
  const [letterPath, setLetterPath] = useState('');

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
      const data = await offersService.list(legalEntityId.trim() || undefined);
      setRows(data);
      setState(data.length ? 'ready' : 'empty');
    } catch (e: unknown) {
      setState('error');
      setMsg(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [canView, legalEntityId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusOfferId || state !== 'ready') return;
    const tid = `offer-row-${focusOfferId}`;
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-testid="${tid}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [focusOfferId, state, rows]);

  function openCreateOffer() {
    setCreateErr(null);
    setSelectedApp(undefined);
    setCf({
      application_id: '',
      salary: '',
      offer_expiry_date: '',
      job_title: '',
      currency: 'ZAR',
      bonus: '',
      start_date: '',
      offer_letter_path: '',
      offer_letter_name: '',
    });
    setCreateOpen(true);
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    if (!legalEntityId.trim()) {
      setCreateErr('Select a legal entity above to choose an application.');
      return;
    }
    const salary = Number(cf.salary);
    const bonusNum = cf.bonus.trim() ? Number(cf.bonus) : NaN;
    if (!cf.application_id.trim() || !cf.offer_expiry_date || Number.isNaN(salary) || salary <= 0) return;
    setBusy(true);
    try {
      await offersService.create({
        application_id: cf.application_id.trim(),
        salary,
        offer_expiry_date: cf.offer_expiry_date,
        job_title: cf.job_title.trim() || undefined,
        salary_currency: cf.currency.trim() || 'ZAR',
        start_date: cf.start_date.trim() || undefined,
        signing_bonus: !Number.isNaN(bonusNum) && bonusNum > 0 ? bonusNum : undefined,
        offer_letter_url: cf.offer_letter_path.trim() || undefined,
      });
      setCreateOpen(false);
      setSelectedApp(undefined);
      setCf({
        application_id: '',
        salary: '',
        offer_expiry_date: '',
        job_title: '',
        currency: 'ZAR',
        bonus: '',
        start_date: '',
        offer_letter_path: '',
        offer_letter_name: '',
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function submitSend() {
    if (!sendId) return;
    setBusy(true);
    try {
      await offersService.send(sendId, letterPath.trim() || '-');
      setSendId(null);
      setLetterPath('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <div style={styles.pageContainer} data-testid="offers-blocked">
        <div style={styles.card}>
          <h1 style={styles.pageTitle}>Access denied</h1>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer} data-testid="offers-page">
      <div style={{ ...styles.flexBetween, ...styles.pageHeader }}>
        <div>
          <h1 style={styles.pageTitle}>Offers</h1>
          <p style={styles.pageSubtitle}>Create, approve, and send offers (candidate response is external)</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={styles.buttonSecondary} onClick={() => void load()} data-testid="offers-refresh-button">
            Refresh
          </button>
          {canCreate && (
            <button type="button" style={styles.buttonPrimary} onClick={() => openCreateOffer()} data-testid="offers-create-button">
              Create offer
            </button>
          )}
        </div>
      </div>

      <div style={{ ...styles.card, marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Filter by legal entity (optional)</label>
        <p style={{ fontSize: 11, color: styles.colors.textMuted, margin: '0 0 8px' }}>
          Creating an offer requires a legal entity so applications can be searched.
        </p>
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

      {state === 'loading' && (
        <div style={styles.card} data-testid="offers-loading">
          <p>Loading…</p>
        </div>
      )}
      {state === 'error' && (
        <div style={styles.card} data-testid="offers-error">
          <p>{msg}</p>
          <button type="button" style={{ ...styles.buttonPrimary, marginTop: 8 }} onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      {state === 'empty' && (
        <div style={styles.card} data-testid="offers-empty">
          <p style={{ color: styles.colors.textMuted }}>No offers in pipeline.</p>
        </div>
      )}

      {state === 'ready' && (
        <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Candidate</th>
                <th style={styles.tableHeaderCell}>Role</th>
                <th style={styles.tableHeaderCell}>Salary</th>
                <th style={styles.tableHeaderCell}>Status</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr
                  key={o.id}
                  style={{
                    ...styles.tableRow,
                    ...(focusOfferId === o.id ? { background: '#fefce8' } : {}),
                  }}
                  data-testid={`offer-row-${o.id}`}
                >
                  <td style={styles.tableCell}>{o.candidate_name}</td>
                  <td style={styles.tableCell}>{o.requisition_title ?? o.position}</td>
                  <td style={styles.tableCell}>
                    {o.currency} {o.base_salary}
                  </td>
                  <td style={styles.tableCell}>{o.status}</td>
                  <td style={styles.tableCell}>
                    {canApprove && o.status === 'draft' && (
                      <button
                        type="button"
                        style={{ ...styles.buttonSecondary, fontSize: 11, marginRight: 6 }}
                        onClick={() => void offersService.approve(o.id).then(() => load())}
                        data-testid={`offer-approve-${o.id}`}
                      >
                        Approve
                      </button>
                    )}
                    {canSend && o.status === 'pending_approval' && (
                      <button
                        type="button"
                        style={{ ...styles.buttonSecondary, fontSize: 11 }}
                        onClick={() => {
                          setSendId(o.id);
                          setLetterPath(o.offer_letter_url?.trim() ?? '');
                        }}
                        data-testid={`offer-send-${o.id}`}
                      >
                        Send
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <div style={overlay} data-testid="offer-form-modal">
          <div style={{ ...styles.card, maxWidth: 520, width: '100%' }}>
            <h2 style={{ marginBottom: 8 }}>Create offer</h2>
            <p style={{ fontSize: 13, color: styles.colors.textMuted, marginBottom: 12 }}>
              Pick an application in interview or offer stage. Requires a legal entity filter above.
            </p>
            <form onSubmit={(e) => void submitCreate(e)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={styles.formLabel}>Application</label>
                  <ApplicationSelect
                    value={cf.application_id || undefined}
                    onChange={(id, opt) => {
                      setCf((c) => ({ ...c, application_id: id ?? '' }));
                      setSelectedApp(opt);
                    }}
                    legalEntityId={legalEntityId.trim() || undefined}
                    allowedStages={['interview', 'final', 'offer']}
                    disabled={!legalEntityId.trim()}
                    testId="offer-form-application"
                  />
                </div>
                {selectedApp && (
                  <div
                    style={{ ...styles.card, padding: 12, background: styles.colors.background, fontSize: 13 }}
                    data-testid="offer-form-application-preview"
                  >
                    <strong>{selectedApp.label}</strong>
                    {selectedApp.subtitle && (
                      <div style={{ color: styles.colors.textMuted, marginTop: 4 }}>Stage: {selectedApp.subtitle}</div>
                    )}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={styles.formLabel}>Base salary</label>
                    <input
                      style={styles.input}
                      type="number"
                      value={cf.salary}
                      onChange={(e) => setCf((c) => ({ ...c, salary: e.target.value }))}
                      required
                      data-testid="offer-form-salary"
                    />
                  </div>
                  <div>
                    <label style={styles.formLabel}>Currency</label>
                    <input
                      style={styles.input}
                      value={cf.currency}
                      onChange={(e) => setCf((c) => ({ ...c, currency: e.target.value }))}
                      data-testid="offer-form-currency"
                    />
                  </div>
                </div>
                <div>
                  <label style={styles.formLabel}>Signing bonus (optional)</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={cf.bonus}
                    onChange={(e) => setCf((c) => ({ ...c, bonus: e.target.value }))}
                    data-testid="offer-form-bonus"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={styles.formLabel}>Start date (optional)</label>
                    <input
                      style={styles.input}
                      type="date"
                      value={cf.start_date}
                      onChange={(e) => setCf((c) => ({ ...c, start_date: e.target.value }))}
                      data-testid="offer-form-start-date"
                    />
                  </div>
                  <div>
                    <label style={styles.formLabel}>Expiry date</label>
                    <input
                      style={styles.input}
                      type="date"
                      value={cf.offer_expiry_date}
                      onChange={(e) => setCf((c) => ({ ...c, offer_expiry_date: e.target.value }))}
                      required
                      data-testid="offer-form-expiry-date"
                    />
                  </div>
                </div>
                <div>
                  <label style={styles.formLabel}>Job title override (optional)</label>
                  <input
                    style={styles.input}
                    value={cf.job_title}
                    onChange={(e) => setCf((c) => ({ ...c, job_title: e.target.value }))}
                  />
                </div>
                <FileUploadField
                  label="Offer letter (optional)"
                  value={cf.offer_letter_path}
                  originalName={cf.offer_letter_name || undefined}
                  onChangePath={(path, meta) =>
                    setCf((c) => ({
                      ...c,
                      offer_letter_path: path,
                      offer_letter_name: meta?.original_filename ?? c.offer_letter_name,
                    }))
                  }
                  helperText="Upload now or attach when sending. Stored path is saved on the offer."
                  testId="offer-form-letter"
                />
                {createErr && <p style={{ color: styles.colors.danger, fontSize: 13, margin: 0 }}>{createErr}</p>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" style={styles.buttonSecondary} onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.buttonPrimary}
                  disabled={busy || !legalEntityId.trim()}
                  data-testid="offer-form-submit"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sendId && (
        <div style={overlay}>
          <div style={{ ...styles.card, maxWidth: 400, width: '100%' }}>
            <h3 style={{ marginBottom: 8 }}>Send offer</h3>
            <p style={{ fontSize: 13, color: styles.colors.textMuted, marginBottom: 8 }}>
              Confirm or replace the offer letter path (pre-filled if uploaded at create).
            </p>
            <FileUploadField
              label="Offer letter file"
              value={letterPath}
              onChangePath={(path) => setLetterPath(path)}
              helperText="Upload a new file or edit the path above."
              testId="offer-send-letter"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                style={styles.buttonSecondary}
                onClick={() => {
                  setSendId(null);
                  setLetterPath('');
                }}
              >
                Cancel
              </button>
              <button type="button" style={styles.buttonPrimary} disabled={busy} onClick={() => void submitSend()}>
                Send
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
