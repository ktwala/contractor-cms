import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner } from '../ui/layout';
import { useAccess } from '../hooks/useAccess';
import {
  canProceedPayrunExecutionWithReadiness,
  isPayrollReadinessGateBlockedError,
  readinessOverrideRequestHeaders,
} from '../utils/payrunExecutionClient';
import { P } from '../constants/permissions';

interface PayGroup { id: string; name: string; code: string; country: string; currency: string; frequency: string; legalEntityId: string; legalEntity?: { name: string } }
interface PayPeriod { id: string; start_date: string; end_date: string; pay_date: string; cutoff_date?: string; name?: string; year?: number; periodNum?: number }

const STATUTORY_PAYROLL_READINESS_CODES = new Set([
  'MISSING_COMPUTE_PACK',
  'MISSING_PAYE_TAX_TABLE',
  'INCOMPLETE_STATUTORY_BOOTSTRAP',
]);

function hasStatutoryReadinessBlockers(r: PayGroupReadiness): boolean {
  return (r.blockingReasons ?? []).some((b) => STATUTORY_PAYROLL_READINESS_CODES.has(b.code));
}

interface PayGroupReadiness {
  canCreatePayrun: boolean;
  readinessPercent?: number;
  blockingReasons?: { code: string; message: string }[];
  statutoryBootstrap?: {
    asOf: string;
    snapshotEngineReady: boolean;
    operatorBootstrapComplete: boolean;
  };
}

interface InclusionPreviewResponse {
  pay_group: { id: string; code: string; name: string };
  period: { period_start: string; period_end: string; pay_date: string };
  run_type: string;
  candidates: PreviewPersonRow[];
  excluded: PreviewPersonRow[];
  exclusion_summary?: Record<string, number>;
  employment_scope: {
    active_employees: number;
    with_employment_in_pay_group: number;
    with_employment_overlapping_payrun_period: number;
  } | null;
}

type PreviewPersonRow = {
  employee_id: string;
  reason: string;
  employee_no?: string;
  first_name?: string;
  last_name?: string;
};

type Step = 'scope' | 'population' | 'review';

function formatExclusionReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    'No valid compensation record for period': 'Missing compensation',
    'No valid bank account for period': 'Missing bank account',
    'No valid tax profile for period': 'Missing tax profile',
  };
  return labels[reason] ?? reason;
}

function fmtPeriodDate(d: string | undefined | null): string {
  if (!d) return '—';
  const date = new Date(d + 'T00:00:00');
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function periodLabel(p: PayPeriod): string {
  const start = fmtPeriodDate(p.start_date);
  const end = fmtPeriodDate(p.end_date);
  if (p.name) return `${p.name} — ${start} to ${end}`;
  const year = p.year ?? (p.start_date ? new Date(p.start_date + 'T00:00:00').getFullYear() : '');
  const month = p.start_date ? new Date(p.start_date + 'T00:00:00').toLocaleString('en-ZA', { month: 'short' }) : '';
  return `${year} ${month} — ${start} to ${end}`;
}

function fmtIsoRangeShort(isoStart: string, isoEnd: string): string {
  const a = fmtPeriodDate(isoStart.slice(0, 10));
  const b = fmtPeriodDate(isoEnd.slice(0, 10));
  return `${a}–${b}`;
}

/** Human-readable line aligned with PayrunSnapshotService eligibility rules. */
function narrativeForExclusionReason(
  reasonKey: string,
  count: number,
  period: InclusionPreviewResponse['period'] | undefined,
): string {
  const range =
    period?.period_start && period?.period_end
      ? fmtIsoRangeShort(period.period_start, period.period_end)
      : 'this pay period';
  const n = count;
  const s = n === 1 ? '' : 's';
  switch (reasonKey) {
    case 'No valid bank account for period':
      return `${n} employee${s} missing payroll-ready bank account details. Required: at least one bank account row (\`bank_accounts\`) with effective dates overlapping ${range}.`;
    case 'No valid compensation record for period':
      return `${n} employee${s} missing compensation effective for ${range}.`;
    case 'No valid tax profile for period':
      return `${n} employee${s} missing tax profile effective for ${range}.`;
    default:
      return `${n}× ${formatExclusionReasonLabel(reasonKey)}`;
  }
}

function formatPersonLabel(row: PreviewPersonRow): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  if (name && row.employee_no) return `${name} (${row.employee_no})`;
  if (name) return name;
  if (row.employee_no) return row.employee_no;
  return row.employee_id;
}

export default function CreatePayrun() {
  const navigate = useNavigate();
  const { can } = useAccess();

  const [step, setStep] = useState<Step>('scope');
  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [periods, setPeriods] = useState<PayPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<PayGroupReadiness | null | undefined>(undefined);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessOverrideUse, setReadinessOverrideUse] = useState(false);
  const [readinessOverrideJustification, setReadinessOverrideJustification] = useState('');

  const [inclusionPreview, setInclusionPreview] = useState<InclusionPreviewResponse | null>(null);
  const [inclusionPreviewLoading, setInclusionPreviewLoading] = useState(false);
  const [inclusionPreviewError, setInclusionPreviewError] = useState<string | null>(null);
  const [emptyEligibilityOverride, setEmptyEligibilityOverride] = useState(false);

  const [form, setForm] = useState({
    pay_group_id: '',
    period_id: '',
    pay_date: '',
    notes: '',
  });

  const selectedPg = payGroups.find((pg) => pg.id === form.pay_group_id);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/pay-groups?limit=200');
        const items = res.data?.items ?? res.data ?? [];
        setPayGroups(Array.isArray(items) ? items : []);
      } catch {
        setError('Failed to load pay groups');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!form.pay_group_id) { setPeriods([]); return; }
    (async () => {
      try {
        const res = await api.get(`/pay-groups/${form.pay_group_id}/periods?limit=50`);
        const items = res.data?.items ?? res.data ?? [];
        setPeriods(Array.isArray(items) ? items : []);
      } catch {
        setPeriods([]);
      }
    })();
  }, [form.pay_group_id]);

  useEffect(() => {
    if (!form.pay_group_id) {
      setReadiness(undefined);
      setReadinessOverrideUse(false);
      setReadinessOverrideJustification('');
      return;
    }
    let cancelled = false;
    setReadinessLoading(true);
    void (async () => {
      try {
        const rRes = await api.get(`/payroll/readiness/pay-groups/${form.pay_group_id}`);
        if (!cancelled) setReadiness(rRes.data as PayGroupReadiness);
      } catch {
        if (!cancelled) setReadiness(null);
      } finally {
        if (!cancelled) setReadinessLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.pay_group_id]);

  useEffect(() => {
    if (form.period_id && periods.length > 0) {
      const p = periods.find((pp) => pp.id === form.period_id);
      if (p && !form.pay_date && p.pay_date) {
        setForm((f) => ({ ...f, pay_date: p.pay_date.slice(0, 10) }));
      }
    }
  }, [form.period_id, periods]);

  const fetchInclusionPreview = useCallback(async () => {
    if (!form.pay_group_id) return;
    if (!form.period_id && !form.pay_date) {
      setInclusionPreview(null);
      setInclusionPreviewError(null);
      setInclusionPreviewLoading(false);
      return;
    }
    setInclusionPreviewLoading(true);
    setInclusionPreviewError(null);
    setInclusionPreview(null);
    try {
      const body: Record<string, string> = { pay_group_id: form.pay_group_id, run_type: 'REGULAR' };
      if (form.period_id) body.period_id = form.period_id;
      if (form.pay_date) body.pay_date = form.pay_date;
      const res = await api.post<InclusionPreviewResponse>('/payruns/preview-inclusions', body);
      setInclusionPreview(res.data);
    } catch (e: unknown) {
      const anyE = e as { response?: { data?: { message?: string } } };
      setInclusionPreviewError(anyE?.response?.data?.message ?? 'Failed to load eligibility preview');
      setInclusionPreview(null);
    } finally {
      setInclusionPreviewLoading(false);
    }
  }, [form.pay_group_id, form.period_id, form.pay_date]);

  useEffect(() => {
    if (step !== 'population' && step !== 'review') return;
    if (!form.pay_group_id) return;
    if (!form.period_id && !form.pay_date) return;
    void fetchInclusionPreview();
  }, [step, form.pay_group_id, form.period_id, form.pay_date, fetchInclusionPreview]);

  useEffect(() => {
    if (inclusionPreview && inclusionPreview.candidates.length > 0) {
      setEmptyEligibilityOverride(false);
    }
  }, [inclusionPreview]);

  const canSubmit = Boolean(form.pay_group_id && (form.period_id || form.pay_date));
  const createBlockedByReadiness =
    readiness !== undefined &&
    readiness !== null &&
    !readiness.canCreatePayrun &&
    !canProceedPayrunExecutionWithReadiness({
      canCreatePayrun: !!readiness?.canCreatePayrun,
      hasOverridePermission: can('payrun:readiness_override'),
      useReadinessOverride: readinessOverrideUse,
      overrideJustification: readinessOverrideJustification,
    });

  const eligibilityGateBlocksCreate =
    step === 'review' &&
    canSubmit &&
    (inclusionPreviewLoading ||
      !!inclusionPreviewError ||
      !inclusionPreview ||
      (inclusionPreview.candidates.length === 0 && !(can(P.PAYRUN_ADMIN) && emptyEligibilityOverride)));

  const handleSubmit = async () => {
    if (!form.pay_group_id) return;
    if (!form.period_id && !form.pay_date) {
      setError('Please select a payroll period or provide a payment date.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const body: any = { pay_group_id: form.pay_group_id };
      if (form.period_id) body.period_id = form.period_id;
      if (form.pay_date) body.pay_date = form.pay_date;
      if (form.notes) body.notes = form.notes;

      const headers: Record<string, string> = {};
      if (
        readiness &&
        !readiness.canCreatePayrun &&
        can('payrun:readiness_override') &&
        readinessOverrideUse
      ) {
        Object.assign(headers, readinessOverrideRequestHeaders(readinessOverrideJustification));
      }

      const res = await api.post('/payruns', body, { headers });
      const id = res.data?.id ?? res.data?.payrun?.id;
      if (id) navigate(`/payroll/payruns/${id}`);
      else navigate('/payroll/run-center');
    } catch (e: unknown) {
      if (isPayrollReadinessGateBlockedError(e)) {
        const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
        setError(typeof msg === 'string' ? msg : 'Payroll readiness blocked payrun creation.');
      } else {
        const anyE = e as { response?: { data?: { message?: string } } };
        setError(anyE?.response?.data?.message ?? 'Failed to create payrun');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPeriod = periods.find((p) => p.id === form.period_id);

  const renderEligibilityPreview = () => (
    <>
      {(!form.period_id && !form.pay_date) && (
        <Banner variant="warn">Select a payroll period or payment date on the previous step to preview eligibility.</Banner>
      )}
      {inclusionPreviewLoading && (form.period_id || form.pay_date) && (
        <Banner variant="warn">Loading eligibility preview…</Banner>
      )}
      {inclusionPreviewError && (
        <Banner variant="error">{inclusionPreviewError}</Banner>
      )}
      {inclusionPreview && !inclusionPreviewLoading && (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            border: `1px solid ${inclusionPreview.candidates.length > 0 ? '#bbf7d0' : '#fecaca'}`,
            background: inclusionPreview.candidates.length > 0 ? '#f0fdf4' : '#fef2f2',
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: 8,
              color: inclusionPreview.candidates.length > 0 ? '#15803d' : '#991b1b',
            }}
          >
            Eligibility preview
          </div>
          <div style={{ fontSize: 14, color: styles.colors.text, marginBottom: 8 }}>
            {inclusionPreview.candidates.length === 0 ? (
              <>0 employees are eligible. Resolve the issues below before creating this payrun.</>
            ) : (
              <>
                {inclusionPreview.candidates.length} employee{inclusionPreview.candidates.length === 1 ? '' : 's'}{' '}
                {inclusionPreview.candidates.length === 1 ? 'is' : 'are'} eligible for this payrun.
              </>
            )}
          </div>
          <div style={{ fontSize: 13, color: styles.colors.textSecondary, marginBottom: 8 }}>
            Eligible employees: {inclusionPreview.candidates.length} · Excluded employees:{' '}
            {inclusionPreview.excluded.length}
          </div>
          {inclusionPreview.exclusion_summary && Object.keys(inclusionPreview.exclusion_summary).length > 0 && (
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Reason</div>
              <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
                {Object.entries(inclusionPreview.exclusion_summary).map(([reason, n]) => (
                  <li key={reason} style={{ marginBottom: 6 }}>
                    {narrativeForExclusionReason(reason, Number(n), inclusionPreview.period)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {inclusionPreview.excluded.length > 0 && (
            <div style={{ fontSize: 13, marginTop: 4 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                View affected employees ({inclusionPreview.excluded.length})
              </div>
              <div
                style={{
                  overflowX: 'auto',
                  maxHeight: 280,
                  overflowY: 'auto',
                  border: `1px solid ${styles.colors.border}`,
                  borderRadius: 8,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Employee</th>
                      <th style={{ padding: '8px 10px' }}>Blocking reason</th>
                      <th style={{ padding: '8px 10px' }}>Fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inclusionPreview.excluded.map((row) => (
                      <tr key={row.employee_id} style={{ borderTop: `1px solid ${styles.colors.border}` }}>
                        <td style={{ padding: '8px 10px' }}>{formatPersonLabel(row)}</td>
                        <td style={{ padding: '8px 10px' }}>{formatExclusionReasonLabel(row.reason)}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <Link to={`/enterprise/employees/${row.employee_id}`} style={{ fontWeight: 600 }}>
                            Open employee
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {inclusionPreview.candidates.length === 0 &&
            inclusionPreview.excluded.length === 0 &&
            inclusionPreview.employment_scope && (
              <div style={{ fontSize: 13, marginTop: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Employment scope (no employees matched this pay group and period)
                </div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Active employees: {inclusionPreview.employment_scope.active_employees}</li>
                  <li>With employment in this pay group: {inclusionPreview.employment_scope.with_employment_in_pay_group}</li>
                  <li>Overlapping this payrun period: {inclusionPreview.employment_scope.with_employment_overlapping_payrun_period}</li>
                </ul>
              </div>
            )}
        </div>
      )}
    </>
  );

  if (loading) return <Page title="Create Payrun"><div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div></Page>;

  const stepperItems = [
    { key: 'scope', label: '1. Scope' },
    { key: 'population', label: '2. Population' },
    { key: 'review', label: '3. Review & Create' },
  ];

  return (
    <Page
      title="Create Payrun"
      subtitle="Define the payroll period, employee scope, and snapshot rules for this run."
      actions={
        <button style={styles.buttonSecondary} onClick={() => navigate(-1)}>Cancel</button>
      }
    >
      {error && <Banner variant="error">{error}</Banner>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {stepperItems.map((s) => (
          <div key={s.key} style={{
            flex: 1, padding: '10px 16px', borderRadius: 8, textAlign: 'center', fontSize: 13, fontWeight: 600,
            background: step === s.key ? styles.colors.primary : '#f1f5f9',
            color: step === s.key ? '#fff' : styles.colors.textMuted,
            cursor: 'pointer',
          }} onClick={() => {
            if (s.key === 'scope') setStep('scope');
            else if (s.key === 'population' && form.pay_group_id) setStep('population');
            else if (s.key === 'review' && form.pay_group_id) setStep('review');
          }}>
            {s.label}
          </div>
        ))}
      </div>

      {step === 'scope' && (
        <Card>
          <CardHeader title="Payrun Scope" />
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: styles.colors.text }}>Pay Group *</label>
              <select
                value={form.pay_group_id}
                onChange={(e) => setForm({ ...form, pay_group_id: e.target.value, period_id: '', pay_date: '' })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 14, background: '#fff' }}
              >
                <option value="">Select pay group</option>
                {payGroups.map((pg) => (
                  <option key={pg.id} value={pg.id}>{pg.name} ({pg.code}) — {pg.legalEntity?.name ?? pg.country}</option>
                ))}
              </select>
            </div>

            {readinessLoading && form.pay_group_id && (
              <Banner variant="warn">Checking payroll readiness…</Banner>
            )}
            {!readinessLoading && readiness && !readiness.canCreatePayrun && (
              <Banner variant="error">
                Payroll readiness is not green for this pay group ({readiness.readinessPercent ?? 0}%).
                {readiness.blockingReasons && readiness.blockingReasons.length > 0 && (
                  <span> {readiness.blockingReasons.map((b) => b.message).join(' · ')}</span>
                )}
                {hasStatutoryReadinessBlockers(readiness) && (
                  <span>
                    {' '}
                    <Link to="/admin/statutory-config" style={{ color: 'inherit', fontWeight: 600 }}>
                      Statutory config / bootstrap
                    </Link>
                  </span>
                )}
              </Banner>
            )}

            {selectedPg && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Country</div><div style={{ fontWeight: 500 }}>{selectedPg.country}</div></div>
                <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Currency</div><div style={{ fontWeight: 500 }}>{selectedPg.currency}</div></div>
                <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Frequency</div><div style={{ fontWeight: 500 }}>{selectedPg.frequency}</div></div>
              </div>
            )}

            {form.pay_group_id && periods.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: styles.colors.text }}>Payroll Period</label>
                <select
                  value={form.period_id}
                  onChange={(e) => setForm({ ...form, period_id: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 14, background: '#fff' }}
                >
                  <option value="">Select period (optional)</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {periodLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.pay_group_id && periods.length === 0 && (
              <div style={{ padding: 16, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#92400e', marginBottom: 4 }}>No payroll periods available</div>
                <div style={{ fontSize: 13, color: '#78350f', marginBottom: 12 }}>
                  No payroll periods are available for <strong>{selectedPg?.name ?? 'this pay group'}</strong>. Generate periods first in Payroll &rarr; Calendars.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link to="/payroll/calendars" style={{ ...styles.buttonPrimary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontSize: 13, background: '#d97706' }}>
                    Go to Calendars
                  </Link>
                  <button style={{ ...styles.buttonSecondary, fontSize: 13 }} onClick={() => {
                    if (!form.pay_group_id) return;
                    api.get(`/pay-groups/${form.pay_group_id}/periods?limit=50`).then((res) => {
                      const items = res.data?.items ?? res.data ?? [];
                      setPeriods(Array.isArray(items) ? items : []);
                    }).catch(() => setPeriods([]));
                  }}>
                    Refresh
                  </button>
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: styles.colors.text }}>Payment Date</label>
              <input
                type="date"
                value={form.pay_date}
                onChange={(e) => setForm({ ...form, pay_date: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: styles.colors.text }}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes for this payrun"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 14, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={styles.buttonPrimary} disabled={!form.pay_group_id || (!!form.pay_group_id && periods.length === 0)} onClick={() => setStep('population')}>
                Next: Population
              </button>
            </div>
          </div>
        </Card>
      )}

      {step === 'population' && (
        <Card>
          <CardHeader title="Employee Population" />
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {renderEligibilityPreview()}
            </div>

            <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>
              After creating the payrun, you'll be able to:
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, color: styles.colors.textSecondary, fontSize: 13 }}>
              <li>Preview employee inclusions before snapshotting</li>
              <li>Include or exclude specific employees</li>
              <li>Add line item inputs (bonuses, adjustments)</li>
              <li>Review snapshot before calculating</li>
            </ul>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button style={styles.buttonSecondary} onClick={() => setStep('scope')}>Back</button>
              <button style={styles.buttonPrimary} onClick={() => setStep('review')}>Next: Review</button>
            </div>
          </div>
        </Card>
      )}

      {step === 'review' && (
        <Card>
          <CardHeader title="Review & Create" />
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!canSubmit && (
              <Banner variant="warn">Please select a payroll period or provide a payment date before creating the payrun.</Banner>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {renderEligibilityPreview()}
            </div>
            {inclusionPreview && inclusionPreview.candidates.length === 0 && can(P.PAYRUN_ADMIN) && (
              <div style={{ padding: 14, borderRadius: 8, border: '1px solid #fcd34d', background: '#fffbeb' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#92400e' }}>
                  Payrun admin — empty eligibility override
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={emptyEligibilityOverride}
                    onChange={(e) => setEmptyEligibilityOverride(e.target.checked)}
                  />
                  Allow creating this payrun with zero eligible employees (non-default; testing or exceptional use).
                </label>
              </div>
            )}
            {readinessLoading && form.pay_group_id && (
              <Banner variant="warn">Checking payroll readiness…</Banner>
            )}
            {!readinessLoading && readiness && !readiness.canCreatePayrun && (
              <Banner variant="error">
                You cannot create this payrun until payroll readiness is green ({readiness.readinessPercent ?? 0}%), unless you use an audited override with permission.
                {readiness.blockingReasons && readiness.blockingReasons.length > 0 && (
                  <span> {readiness.blockingReasons.map((b) => b.message).join(' · ')}</span>
                )}
                {hasStatutoryReadinessBlockers(readiness) && (
                  <span>
                    {' '}
                    <Link to="/admin/statutory-config" style={{ color: 'inherit', fontWeight: 600 }}>
                      Statutory config / bootstrap
                    </Link>
                  </span>
                )}
              </Banner>
            )}
            {!readinessLoading && readiness && !readiness.canCreatePayrun && can('payrun:readiness_override') && (
              <div style={{ padding: 14, borderRadius: 8, border: '1px solid #fecaca', background: '#fff1f2' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#991b1b' }}>Readiness override (audited)</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
                  <input type="checkbox" checked={readinessOverrideUse} onChange={(e) => setReadinessOverrideUse(e.target.checked)} />
                  I am explicitly overriding the readiness gate for this create action.
                </label>
                <textarea
                  value={readinessOverrideJustification}
                  onChange={(e) => setReadinessOverrideJustification(e.target.value)}
                  placeholder={`Justification (min. 20 characters; sent as x-readiness-override-justification)`}
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 13 }}
                />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Pay Group</div>
                <div style={{ fontWeight: 500 }}>{selectedPg?.name ?? '—'} ({selectedPg?.code ?? '—'})</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Legal Entity</div>
                <div style={{ fontWeight: 500 }}>{selectedPg?.legalEntity?.name ?? '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Period</div>
                <div style={{ fontWeight: 500, color: selectedPeriod ? undefined : '#dc2626' }}>
                  {selectedPeriod ? periodLabel(selectedPeriod) : 'Not selected'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Payment Date</div>
                <div style={{ fontWeight: 500, color: form.pay_date ? undefined : (!selectedPeriod ? '#dc2626' : undefined) }}>
                  {form.pay_date || 'Not set'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Country</div>
                <div style={{ fontWeight: 500 }}>{selectedPg?.country ?? '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Run Type</div>
                <div style={{ fontWeight: 500 }}>Regular</div>
              </div>
            </div>

            {form.notes && (
              <div>
                <div style={{ fontSize: 11, color: styles.colors.textMuted, marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 13, color: styles.colors.text }}>{form.notes}</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button style={styles.buttonSecondary} onClick={() => setStep('population')}>Back</button>
              <button
                style={styles.buttonPrimary}
                disabled={submitting || !canSubmit || readinessLoading || createBlockedByReadiness || eligibilityGateBlocksCreate}
                onClick={handleSubmit}
              >
                {submitting ? 'Creating…' : 'Create Payrun'}
              </button>
            </div>
          </div>
        </Card>
      )}
    </Page>
  );
}
