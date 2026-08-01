import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import {
  canProceedPayrunExecutionWithReadiness,
  isPayrollReadinessGateBlockedError,
  readinessOverrideRequestHeaders,
} from '../utils/payrunExecutionClient';
import {
  canProceedMarkPaidOrPostedWithFinancialControl,
  isPayrunFinancialGateBlockedError,
  financialOverrideRequestHeaders,
} from '../utils/payrunFinancialControlClient';
import {
  canProceedMarkPostedWithBankControl,
  isPayrunBankGateBlockedError,
  bankOverrideRequestHeaders,
} from '../utils/payrunBankReconciliationClient';
import { canProceedPeriodCloseWithGlControl } from '../utils/payrunGlReconciliationClient';
import { canShowCancelPayrunButton, isCancelledTerminalStatus } from '../utils/payrunCancelClient';
import { Page, Card, CardHeader, Banner, Stack, Grid, TabsBar, Tab } from '../ui/layout';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#f1f5f9', text: '#475569' },
  SNAPSHOT: { bg: '#eff6ff', text: '#2563eb' },
  CALCULATING: { bg: '#fef3c7', text: '#d97706' },
  CALCULATED: { bg: '#dbeafe', text: '#1d4ed8' },
  IN_REVIEW: { bg: '#fef9c3', text: '#ca8a04' },
  APPROVED: { bg: '#dcfce7', text: '#16a34a' },
  PAID: { bg: '#d1fae5', text: '#059669' },
  POSTED: { bg: '#e0e7ff', text: '#4f46e5' },
  FINALIZED: { bg: '#f0fdf4', text: '#15803d' },
  CANCELLED: { bg: '#fef2f2', text: '#dc2626' },
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: '#fef2f2', text: '#dc2626' },
  HIGH: { bg: '#fff7ed', text: '#ea580c' },
  MEDIUM: { bg: '#fffbeb', text: '#d97706' },
  LOW: { bg: '#f0fdf4', text: '#16a34a' },
};

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEVERITY_COLORS[severity] ?? { bg: '#f1f5f9', text: '#475569' };
  return <span style={{ background: c.bg, color: c.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const }}>{severity}</span>;
}

const EXCSTATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: '#fef2f2', text: '#dc2626' },
  ASSIGNED: { bg: '#eff6ff', text: '#2563eb' },
  RESOLVED: { bg: '#f0fdf4', text: '#16a34a' },
  DISMISSED: { bg: '#f1f5f9', text: '#94a3b8' },
};

function ExceptionStatusBadge({ status }: { status: string }) {
  const c = EXCSTATUS_COLORS[status] ?? { bg: '#f1f5f9', text: '#475569' };
  return <span style={{ background: c.bg, color: c.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{status}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: '#f1f5f9', text: '#475569' };
  return <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999, background: c.bg, color: c.text }}>{status.replace(/_/g, ' ')}</span>;
}

function fmt(n: number | undefined | null, currency?: string) {
  if (n == null) return '—';
  const cur = currency || 'ZAR';
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n);
  } catch {
    return new Intl.NumberFormat('en-ZA', { minimumFractionDigits: 2 }).format(n);
  }
}

type DisplaySchema = {
  schema_key: string;
  country_code: string;
  version: number;
  summary_columns: Array<{
    key: string; label: string; source: string;
    core_field?: string; line_code?: string;
    order: number; visible: boolean; format: string; align: string;
  }>;
  detail_groups: Array<{
    key: string; label: string;
    include_buckets?: string[]; include_line_codes?: string[];
    exclude_line_codes?: string[]; order: number;
  }>;
  totals_panel: {
    show_employee_deductions_total: boolean;
    show_employer_contributions_total: boolean;
    show_employer_levies_total: boolean;
    show_employer_cost: boolean;
    show_taxable_income: boolean;
  };
  exports: { include_hidden_lines: boolean; include_employer_items: boolean };
  payslip: { show_employer_section: boolean; show_taxable_income: boolean };
};

type NormalizedLine = {
  code: string; label: string; amount: number; currency: string;
  bucket: string; category: string;
  is_statutory: boolean; statutory_group?: string;
  affects_net_pay: boolean; affects_employer_cost: boolean;
  visibility: string; sort_order: number;
  period_amount: number; ytd_amount?: number;
};

type StatutoryLineSummary = {
  code: string; label: string; total: number;
  statutory_group?: string; side: 'employee' | 'employer';
};

type NormalizedEmployeeResult = {
  employee_id: string; employee_code?: string; employee_number?: string;
  employee_name?: string; country_code: string; currency: string;
  gross: number; taxable_income?: number; earnings_total: number;
  employee_deductions_total: number; employer_contributions_total: number;
  employer_levies_total: number; net_pay: number; employer_cost: number;
  lines: NormalizedLine[]; summary_line_amounts: Record<string, number>;
  display_schema_key: string;
};

function getSummaryCellValue(
  result: NormalizedEmployeeResult,
  column: DisplaySchema['summary_columns'][0],
): string | number | null {
  if (column.source === 'employee_identity') {
    return result.employee_name || result.employee_code || result.employee_id;
  }
  if (column.source === 'core_field' && column.core_field) {
    return (result as any)[column.core_field] ?? null;
  }
  if (column.source === 'summary_line' && column.line_code) {
    return result.summary_line_amounts[column.line_code] ?? 0;
  }
  return null;
}

function getDetailGroupLines(
  result: NormalizedEmployeeResult,
  group: DisplaySchema['detail_groups'][0],
): NormalizedLine[] {
  return result.lines.filter((line) => {
    const bucketMatch = !group.include_buckets || group.include_buckets.includes(line.bucket);
    const includeCodeMatch = !group.include_line_codes || group.include_line_codes.includes(line.code);
    const excludeCodeMatch = group.exclude_line_codes?.includes(line.code) ?? false;
    const included = (group.include_buckets && !group.include_line_codes ? bucketMatch : true) &&
                     (group.include_line_codes ? includeCodeMatch : true) &&
                     (!group.include_buckets || !group.include_line_codes ? true : bucketMatch);
    return included && !excludeCodeMatch;
  }).filter((line) => line.visibility !== 'hidden');
}

type TabKey = 'overview' | 'employees' | 'results' | 'exceptions' | 'approvals' | 'payments' | 'reconciliation' | 'audit';

const LIFECYCLE_STEPS = ['DRAFT', 'SNAPSHOT', 'CALCULATED', 'IN_REVIEW', 'APPROVED', 'PAID', 'POSTED', 'FINALIZED'];

/** Fresh values from the last successful payrun reload (avoids trusting React state before batched updates). */
type PayrunReloadSnapshot = {
  payrun: any;
  summary: any | null;
  resultsLength: number;
  registerEmployeeCount: number;
};

/** Actions that map to readiness-gated backend endpoints (keep in sync with drift script). */
const READINESS_GATED_ACTIONS = new Set([
  'snapshot',
  'calculate',
  'submit-for-approval',
  'approve',
  'mark-paid',
  'mark-posted',
  'finalize',
]);

const STATUTORY_PAYROLL_READINESS_CODES = new Set([
  'MISSING_COMPUTE_PACK',
  'MISSING_PAYE_TAX_TABLE',
  'INCOMPLETE_STATUTORY_BOOTSTRAP',
]);

function payrunDetailHasStatutoryReadinessBlockers(blocking?: { code: string }[]): boolean {
  return (blocking ?? []).some((b) => STATUTORY_PAYROLL_READINESS_CODES.has(b.code));
}

/** Surfaces structured `details` from payroll snapshot errors in the admin banner. */
function appendPayrunActionErrorDetails(message: string, details: Record<string, unknown> | undefined): string {
  if (!details || typeof details !== 'object') return message;
  const parts: string[] = [];
  if (details.exclusion_summary && typeof details.exclusion_summary === 'object') {
    parts.push(`Exclusion breakdown: ${JSON.stringify(details.exclusion_summary)}`);
  }
  if (details.employment_scope && typeof details.employment_scope === 'object') {
    parts.push(`Employment scope: ${JSON.stringify(details.employment_scope)}`);
  }
  if (parts.length === 0) return message;
  return `${message}\n\n${parts.join('\n')}`;
}

/** Register ↔ export financial gate (GOV-3A); keep in sync with drift script. */
const FINANCIAL_GATED_PAY_ACTIONS = new Set(['mark-paid', 'mark-posted']);

/** Export ↔ bank confirmation (GOV-3B) — mark posted only; keep in sync with drift script. */
const BANK_GATED_POST_ACTIONS = new Set(['mark-posted']);

export default function PayrunDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAccess();
  const [searchParams, setSearchParams] = useSearchParams();

  const [payrun, setPayrun] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [results, setResults] = useState<NormalizedEmployeeResult[]>([]);
  const [displaySchema, setDisplaySchema] = useState<DisplaySchema | null>(null);
  const [normalizedTotals, setNormalizedTotals] = useState<any>(null);
  const [statutoryTotals, setStatutoryTotals] = useState<StatutoryLineSummary[]>([]);
  const [resultsCurrency, setResultsCurrency] = useState<string>('ZAR');
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [excSummary, setExcSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const VALID_TABS: TabKey[] = ['overview', 'employees', 'results', 'exceptions', 'approvals', 'payments', 'reconciliation', 'audit'];
  const initialTab = (searchParams.get('tab') as TabKey) || 'overview';
  const [tab, setTab] = useState<TabKey>(VALID_TABS.includes(initialTab) ? initialTab : 'overview');
  const [selectedEmployee, setSelectedEmployee] = useState<NormalizedEmployeeResult | null>(null);
  const [payGroup, setPayGroup] = useState<any>(null);
  const [payGroupReadiness, setPayGroupReadiness] = useState<{
    canCreatePayrun: boolean;
    readinessPercent?: number;
    blockingReasons?: { code: string; message: string }[];
  } | null>(null);
  const [readinessOverrideUse, setReadinessOverrideUse] = useState(false);
  const [readinessOverrideJustification, setReadinessOverrideJustification] = useState('');
  const [financialControl, setFinancialControl] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [financialOverrideUse, setFinancialOverrideUse] = useState(false);
  const [financialOverrideJustification, setFinancialOverrideJustification] = useState('');
  const [bankControl, setBankControl] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [bankImportReference, setBankImportReference] = useState('');
  const [bankImportTotal, setBankImportTotal] = useState('');
  const [bankImportCount, setBankImportCount] = useState('');
  const [bankImportSource, setBankImportSource] = useState<'MANUAL' | 'BANK_ACK' | 'BANK_RETURN'>('MANUAL');
  const [bankOverrideUse, setBankOverrideUse] = useState(false);
  const [bankOverrideJustification, setBankOverrideJustification] = useState('');
  const [glControl, setGlControl] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [glImportRef, setGlImportRef] = useState('');
  const [glImportGross, setGlImportGross] = useState('');
  const [glImportNet, setGlImportNet] = useState('');
  const [glImportPaye, setGlImportPaye] = useState('');
  const [glImportDed, setGlImportDed] = useState('');
  const [glImportSource, setGlImportSource] = useState<'MANUAL' | 'ERP_IMPORT' | 'GL_FILE'>('MANUAL');
  const [glOverrideUse, setGlOverrideUse] = useState(false);
  const [glOverrideJustification, setGlOverrideJustification] = useState('');
  const [postCloseImpact, setPostCloseImpact] = useState<Record<string, unknown> | null>(null);
  const [postCloseAckNote, setPostCloseAckNote] = useState('');
  const [lockRules, setLockRules] = useState<{ period_closed?: boolean; rules?: Record<string, boolean> } | null>(null);
  const [excFilter, setExcFilter] = useState({ severity: '', status: '' });

  const changeTab = (newTab: TabKey) => {
    setTab(newTab);
    setSearchParams({ tab: newTab }, { replace: true });
  };
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const loadPayrun = useCallback(async (): Promise<PayrunReloadSnapshot | null> => {
    if (!id) return null;
    let loadedPayrun: any = null;
    let loadedSummary: any | null = null;
    let loadedResultsLen = 0;
    try {
      setLoading(true);
      setError(null);
      setLockRules(null);
      const prRes = await api.get(`/payruns/${id}`);
      const pr = prRes.data;
      loadedPayrun = pr;
      setPayrun(pr);

      try {
        const lrRes = await api.get(`/payruns/${id}/lock-rules`);
        setLockRules(lrRes.data ?? null);
      } catch {
        setLockRules(null);
      }

      const pgId = pr.payGroupId ?? pr.pay_group_id;
      if (pgId) {
        try { const pgRes = await api.get(`/pay-groups?limit=200`); const pgs = pgRes.data?.items ?? pgRes.data ?? []; const pg = pgs.find((g: any) => g.id === pgId); setPayGroup(pg); } catch {}
        try {
          const rRes = await api.get(`/payroll/readiness/pay-groups/${pgId}`);
          setPayGroupReadiness(rRes.data);
        } catch {
          setPayGroupReadiness(null);
        }
        try {
          const fcRes = await api.get(`/payruns/${id}/financial-control`);
          setFinancialControl(fcRes.data ?? null);
        } catch {
          setFinancialControl(null);
        }
      } else {
        setPayGroupReadiness(null);
        setFinancialControl(null);
      }

      try {
        const brRes = await api.get(`/payruns/${id}/bank-reconciliation`);
        setBankControl(brRes.data ?? null);
      } catch {
        setBankControl(null);
      }

      try {
        const glRes = await api.get(`/payruns/${id}/gl-reconciliation`);
        setGlControl(glRes.data ?? null);
      } catch {
        setGlControl(null);
      }

      try {
        const impRes = await api.get(`/payruns/${id}/post-close-reconciliation-impact`);
        setPostCloseImpact(impRes.data ?? null);
      } catch {
        setPostCloseImpact(null);
      }

      try {
        const sRes = await api.get(`/payruns/${id}/summary`);
        loadedSummary = sRes.data;
        setSummary(sRes.data);
      } catch {
        loadedSummary = null;
        setSummary(null);
      }
      try {
        const rRes = await api.get(`/payroll/results/payruns/${id}?limit=500`);
        const data = rRes.data;
        const items = data.employee_results ?? [];
        loadedResultsLen = items.length;
        setResults(items);
        setDisplaySchema(data.display_schema ?? null);
        setNormalizedTotals(data.totals ?? null);
        setStatutoryTotals(data.statutory_totals ?? []);
        setResultsCurrency(data.currency ?? 'ZAR');
      } catch {
        try {
          const rRes = await api.get(`/payruns/${id}/results?limit=500`);
          const items = rRes.data?.items ?? rRes.data ?? [];
          loadedResultsLen = Array.isArray(items) ? items.length : 0;
          setResults(items);
        } catch {
          loadedResultsLen = 0;
          setResults([]);
        }
      }
      try {
        const eRes = await api.get(`/payruns/${id}/exceptions`);
        setExceptions(eRes.data?.items ?? []);
        setExcSummary(eRes.data?.summary ?? null);
      } catch { setExceptions([]); }
      return {
        payrun: loadedPayrun,
        summary: loadedSummary,
        resultsLength: loadedResultsLen,
        registerEmployeeCount: Number(loadedSummary?.register_employee_count ?? 0),
      };
    } catch {
      setError('Failed to load payrun');
      setLockRules(null);
      setPostCloseImpact(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadPayrun(); }, [loadPayrun]);

  const doAction = async (action: string, method = 'post', body?: any) => {
    if (!id) return;
    if (String(payrun?.status ?? '') === 'CANCELLED') {
      setError('This payrun is cancelled; lifecycle actions are disabled.');
      return;
    }
    const runType = String(payrun?.payrun_type ?? payrun?.payrunType ?? 'REGULAR');
    if (lockRules?.period_closed === true && runType !== 'ADJUSTMENT') {
      setError(
        'This pay period is closed (GOV-3D-1). Register and lifecycle changes are blocked for this regular payrun.',
      );
      return;
    }
    const gated = READINESS_GATED_ACTIONS.has(action);
    const canExec =
      !gated ||
      !payGroupReadiness ||
      canProceedPayrunExecutionWithReadiness({
        canCreatePayrun: !!payGroupReadiness.canCreatePayrun,
        hasOverridePermission: can('payrun:readiness_override'),
        useReadinessOverride: readinessOverrideUse,
        overrideJustification: readinessOverrideJustification,
      });
    if (!canExec) {
      setError('Payroll readiness is not green. Resolve blockers or provide an audited override with justification.');
      return;
    }
    const financialGated = FINANCIAL_GATED_PAY_ACTIONS.has(action);
    const financialOk =
      !financialGated ||
      canProceedMarkPaidOrPostedWithFinancialControl({
        control: financialControl as { status: string; reviewed_at?: string | null } | null | undefined,
        hasFinancialOverridePermission: can('payrun:financial_override'),
        useFinancialOverride: financialOverrideUse,
        overrideJustification: financialOverrideJustification,
      });
    if (!financialOk) {
      setError('Register vs payment export is not cleared for mark paid/posted. Reconcile, resolve variance review, or use an audited financial override.');
      return;
    }
    const bankGated = BANK_GATED_POST_ACTIONS.has(action);
    const bankOk =
      !bankGated ||
      canProceedMarkPostedWithBankControl({
        control: bankControl as { status: string; reviewed_at?: string | null; review_required?: boolean } | null | undefined,
        hasBankOverridePermission: can('payrun:bank_override'),
        useBankOverride: bankOverrideUse,
        overrideJustification: bankOverrideJustification,
      });
    if (!bankOk) {
      setError('Bank confirmation is not cleared for mark posted. Import settlement data, complete review, or use an audited bank override.');
      return;
    }
    const headers: Record<string, string> = {};
    if (
      gated &&
      payGroupReadiness &&
      !payGroupReadiness.canCreatePayrun &&
      can('payrun:readiness_override') &&
      readinessOverrideUse
    ) {
      Object.assign(headers, readinessOverrideRequestHeaders(readinessOverrideJustification));
    }
    if (
      financialGated &&
      financialControl &&
      financialControl.status !== 'MATCH' &&
      !(financialControl.status === 'VARIANCE' && (financialControl as { reviewed_at?: string | null }).reviewed_at) &&
      can('payrun:financial_override') &&
      financialOverrideUse
    ) {
      Object.assign(headers, financialOverrideRequestHeaders(financialOverrideJustification));
    }
    const bankCtrl = bankControl as {
      status?: string;
      reviewed_at?: string | null;
      review_required?: boolean;
    } | null | undefined;
    const bankNaturallyOk =
      !!bankCtrl &&
      (bankCtrl.status === 'MATCH' ||
        (bankCtrl.status === 'VARIANCE' &&
          (!!bankCtrl.reviewed_at || bankCtrl.review_required === false)) ||
        ((bankCtrl.status === 'REJECTED' || bankCtrl.status === 'PARTIAL') && !!bankCtrl.reviewed_at));
    if (bankGated && bankCtrl && !bankNaturallyOk && can('payrun:bank_override') && bankOverrideUse) {
      Object.assign(headers, bankOverrideRequestHeaders(bankOverrideJustification));
    }
    try {
      setActionLoading(true); setActionMsg(null); setError(null);
      await (api as any)[method](`/payruns/${id}/${action}`, body ?? {}, { headers });
      const bundle = await loadPayrun();
      if (!bundle?.payrun) {
        setError('The server accepted the request but this page could not reload the payrun. Refresh before continuing.');
        return;
      }
      if (action === 'snapshot') {
        if (bundle.payrun.status !== 'SNAPSHOT') {
          setError(
            `Snapshot did not persist: refreshed status is ${String(bundle.payrun.status)}. Do not assume the register was committed; resolve blockers and try again.`,
          );
          return;
        }
        if (bundle.registerEmployeeCount < 1) {
          setError(
            'Data integrity warning: status is SNAPSHOT but the payroll register reports no included employees. Do not calculate or pay; contact engineering.',
          );
          return;
        }
      }
      if (action === 'calculate') {
        if (bundle.payrun.status !== 'CALCULATED') {
          setError(
            `Calculate did not finish in the expected state (refreshed status: ${String(bundle.payrun.status)}). Review blockers and try again.`,
          );
          return;
        }
        if (bundle.resultsLength < 1) {
          setError(
            'Calculate returned CALCULATED but no payroll results rows were found. Do not submit or pay until this is resolved.',
          );
          return;
        }
      }
      setActionMsg(`${action.replace(/-/g, ' ')} completed`);
    } catch (e: unknown) {
      if (isPayrollReadinessGateBlockedError(e)) {
        const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
        setError(typeof msg === 'string' ? msg : `Failed: ${action} (readiness gate)`);
      } else if (isPayrunFinancialGateBlockedError(e)) {
        const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
        setError(typeof msg === 'string' ? msg : `Failed: ${action} (financial gate)`);
      } else if (isPayrunBankGateBlockedError(e)) {
        const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
        setError(typeof msg === 'string' ? msg : `Failed: ${action} (bank gate)`);
      } else {
        const anyE = e as {
          response?: { data?: { message?: string; details?: Record<string, unknown> } };
        };
        const d = anyE?.response?.data;
        const base = typeof d?.message === 'string' ? d.message : `Failed: ${action}`;
        setError(appendPayrunActionErrorDetails(base, d?.details));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const filteredExceptions = exceptions.filter((exc: any) => {
    if (excFilter.severity && exc.severity !== excFilter.severity) return false;
    if (excFilter.status && exc.status !== excFilter.status) return false;
    return true;
  });

  const [resolveModal, setResolveModal] = useState<{ id: string; note: string; type: string } | null>(null);
  const [dismissModal, setDismissModal] = useState<{ id: string; reason: string } | null>(null);

  const resolveExc = async () => {
    if (!resolveModal?.note) return;
    const runType = String(payrun?.payrun_type ?? payrun?.payrunType ?? 'REGULAR');
    if (lockRules?.period_closed === true && runType !== 'ADJUSTMENT') {
      setError(
        'This pay period is closed (GOV-3D-1). Exception workflow changes are blocked for this regular payrun.',
      );
      return;
    }
    try {
      setActionLoading(true);
      await api.post(`/payrun-exceptions/${resolveModal.id}/resolve`, { resolutionType: resolveModal.type || 'DATA_FIXED', resolutionNote: resolveModal.note });
      await loadPayrun();
      setActionMsg('Exception resolved');
      setResolveModal(null);
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to resolve exception'); }
    finally { setActionLoading(false); }
  };

  const dismissExc = async () => {
    if (!dismissModal?.reason) return;
    const runType = String(payrun?.payrun_type ?? payrun?.payrunType ?? 'REGULAR');
    if (lockRules?.period_closed === true && runType !== 'ADJUSTMENT') {
      setError(
        'This pay period is closed (GOV-3D-1). Exception workflow changes are blocked for this regular payrun.',
      );
      return;
    }
    try {
      setActionLoading(true);
      await api.post(`/payrun-exceptions/${dismissModal.id}/dismiss`, { dismissalReason: dismissModal.reason });
      await loadPayrun();
      setActionMsg('Exception dismissed');
      setDismissModal(null);
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to dismiss exception'); }
    finally { setActionLoading(false); }
  };

  if (loading) return <Page title="Payrun Detail"><div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div></Page>;
  if (!payrun) return <Page title="Payrun Detail"><Banner variant="error">Payrun not found</Banner></Page>;

  const status: string = payrun.status ?? 'DRAFT';
  const payrunType = String(payrun.payrun_type ?? payrun.payrunType ?? 'REGULAR');
  const periodClosedImmutable = lockRules?.period_closed === true && payrunType !== 'ADJUSTMENT';
  const totals = summary?.totals ?? summary ?? {};
  const registerCountRaw = summary?.register_employee_count;
  const registerCount = typeof registerCountRaw === 'number' ? registerCountRaw : 0;
  const persistedCalcRows =
    typeof summary?.employee_count === 'number' ? summary.employee_count : results.length;
  const displayHeadcount = Math.max(registerCount, persistedCalcRows, results.length);
  const snapshotRegisterIntegrityError =
    status === 'SNAPSHOT' && typeof registerCountRaw === 'number' && registerCountRaw === 0;

  const hasSubmissionBlockers = summary?.readiness?.hasSubmissionBlockers || (excSummary?.blockingSubmissionCount ?? 0) > 0;
  const hasPaymentBlockers = summary?.readiness?.hasPaymentBlockers || (excSummary?.blockingPaymentCount ?? 0) > 0;

  const payrunLifecycleFrozen = isCancelledTerminalStatus(status);

  const primaryAction = (() => {
    if (actionLoading) return { label: 'Processing…', disabled: true, action: '', disabledReason: '' };
    if (periodClosedImmutable || payrunLifecycleFrozen) return null;
    switch (status) {
      case 'DRAFT': return can('payrun:snapshot') ? { label: 'Snapshot', action: 'snapshot', body: { snapshot_effective_at: new Date().toISOString() } } : null;
      case 'SNAPSHOT': return can('payrun:calculate') ? { label: 'Calculate', action: 'calculate', body: { mode: 'FULL' } } : null;
      case 'CALCULATED': {
        if (!can('payrun:submit')) return null;
        return { label: 'Submit for Approval', action: 'submit-for-approval', disabled: hasSubmissionBlockers, disabledReason: hasSubmissionBlockers ? 'Resolve blocking payroll exceptions before submission.' : '' };
      }
      case 'IN_REVIEW': return can('payrun:approve') ? { label: 'Approve', action: 'approve' } : null;
      case 'APPROVED': {
        if (!can('payrun:pay')) return null;
        return { label: 'Mark Paid', action: 'mark-paid', body: { paid_at: new Date().toISOString(), payment_reference: 'manual' }, disabled: hasPaymentBlockers, disabledReason: hasPaymentBlockers ? 'Resolve payment-blocking exceptions before marking paid.' : '' };
      }
      case 'PAID': {
        if (can('payrun:post')) {
          return {
            label: 'Mark posted to GL',
            action: 'mark-posted',
            body: { posted_at: new Date().toISOString(), gl_reference: 'manual-gl-ref' },
          };
        }
        if (can('payrun:finalize')) return { label: 'Finalize', action: 'finalize' };
        return null;
      }
      default: return null;
    }
  })();

  const readinessBlockedForAction = (action: string) =>
    READINESS_GATED_ACTIONS.has(action) &&
    !!payGroupReadiness &&
    !canProceedPayrunExecutionWithReadiness({
      canCreatePayrun: !!payGroupReadiness.canCreatePayrun,
      hasOverridePermission: can('payrun:readiness_override'),
      useReadinessOverride: readinessOverrideUse,
      overrideJustification: readinessOverrideJustification,
    });

  const financialBlockedForAction = (action: string) =>
    FINANCIAL_GATED_PAY_ACTIONS.has(action) &&
    !canProceedMarkPaidOrPostedWithFinancialControl({
      control: financialControl as { status: string; reviewed_at?: string | null } | null | undefined,
      hasFinancialOverridePermission: can('payrun:financial_override'),
      useFinancialOverride: financialOverrideUse,
      overrideJustification: financialOverrideJustification,
    });

  const bankBlockedForAction = (action: string) =>
    BANK_GATED_POST_ACTIONS.has(action) &&
    !canProceedMarkPostedWithBankControl({
      control: bankControl as { status: string; reviewed_at?: string | null; review_required?: boolean } | null | undefined,
      hasBankOverridePermission: can('payrun:bank_override'),
      useBankOverride: bankOverrideUse,
      overrideJustification: bankOverrideJustification,
    });

  const primaryReadinessBlocked =
    !!(primaryAction?.action && readinessBlockedForAction(primaryAction.action));

  const primaryFinancialBlocked =
    !!(primaryAction?.action && financialBlockedForAction(primaryAction.action));

  const primaryBankBlocked = !!(primaryAction?.action && bankBlockedForAction(primaryAction.action));

  const bankGateNeedsTreasuryOverride =
    !!bankControl &&
    !canProceedMarkPostedWithBankControl({
      control: bankControl as { status: string; reviewed_at?: string | null; review_required?: boolean },
      hasBankOverridePermission: false,
      useBankOverride: false,
      overrideJustification: '',
    });

  const glGateNeedsAccountingOverride =
    !!glControl &&
    !canProceedPeriodCloseWithGlControl({
      control: glControl as { status: string; reviewed_at?: string | null; review_required?: boolean },
      hasGlOverridePermission: false,
      useGlOverride: false,
      overrideJustification: '',
    });

  const currentStepIdx = LIFECYCLE_STEPS.indexOf(status);

  const canOfferCancelPayrun = canShowCancelPayrunButton({
    status,
    hasPermission: can('payrun:cancel'),
    periodClosedImmutable,
  });

  const performCancelPayrun = async () => {
    if (!id || !cancelReason.trim()) return;
    try {
      setActionLoading(true);
      setError(null);
      setActionMsg(null);
      await api.post(`/payruns/${id}/cancel`, { reason: cancelReason.trim() });
      setShowCancelModal(false);
      setCancelReason('');
      await loadPayrun();
      setActionMsg('Payrun cancelled');
    } catch (e: unknown) {
      const anyE = e as {
        response?: { data?: { message?: string; details?: Record<string, unknown> } };
      };
      const d = anyE?.response?.data;
      const base = typeof d?.message === 'string' ? d.message : 'Cancel failed';
      setError(appendPayrunActionErrorDetails(base, d?.details));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Page
      title={payGroup?.name ? `${payGroup.name} — Payrun` : 'Payrun Detail'}
      subtitle={[payGroup?.code, payrun.periodStart ? `${new Date(payrun.periodStart ?? payrun.period_start).toLocaleDateString()} – ${new Date(payrun.periodEnd ?? payrun.period_end).toLocaleDateString()}` : null, payrun.payDate ?? payrun.pay_date ? `Pay: ${new Date(payrun.payDate ?? payrun.pay_date).toLocaleDateString()}` : null].filter(Boolean).join(' | ')}
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {can('payrun:read') && id && (
            <Link to={`/payroll/payruns/${id}/governance`} style={{ fontSize: 13, fontWeight: 600, color: styles.colors.primary }}>
              Governance cockpit
            </Link>
          )}
          <StatusBadge status={status} />
          {status === 'IN_REVIEW' && can('payrun:approve') && !periodClosedImmutable && (
            <button style={{ ...styles.buttonSecondary, color: '#dc2626', borderColor: '#fecaca' }} disabled={actionLoading} onClick={() => setShowRejectModal(true)}>Reject</button>
          )}
          {canOfferCancelPayrun && (
            <button
              type="button"
              style={{ ...styles.buttonSecondary, color: '#b45309', borderColor: '#fde68a' }}
              disabled={actionLoading}
              onClick={() => { setCancelReason(''); setShowCancelModal(true); }}
            >
              Cancel payrun
            </button>
          )}
          {primaryAction && (
            <div
              style={{ position: 'relative' }}
              title={
                primaryBankBlocked && primaryAction?.action === 'mark-posted'
                  ? 'Bank confirmation must clear before mark posted (GOV-3B).'
                  : primaryFinancialBlocked
                    ? 'Register vs payment export must reconcile before mark paid / posted (GOV-3A).'
                    : primaryReadinessBlocked
                      ? 'Payroll readiness is not green for this pay group.'
                      : primaryAction.disabledReason || ''
              }
            >
              <button
                style={styles.buttonPrimary}
                disabled={
                  primaryAction.disabled ||
                  actionLoading ||
                  primaryReadinessBlocked ||
                  primaryFinancialBlocked ||
                  primaryBankBlocked
                }
                onClick={() => doAction(primaryAction.action, 'post', primaryAction.body)}
              >
                {primaryAction.label}
              </button>
            </div>
          )}
        </div>
      }
    >
      {error && <Banner variant="error">{error}</Banner>}
      {actionMsg && <Banner variant="success">{actionMsg}</Banner>}
      {payrunLifecycleFrozen && (
        <Banner variant="warn">
          This payrun is <strong>cancelled</strong> (terminal). Snapshot, calculate, approval, and payment actions are disabled. Historical register and results remain for audit.
        </Banner>
      )}
      {snapshotRegisterIntegrityError && (
        <Banner variant="error">
          Data integrity: payrun is SNAPSHOT but the register has no included employees. Do not calculate or pay; contact engineering.
        </Banner>
      )}

      {postCloseImpact && postCloseImpact.any_impact === true && (
        <Banner variant="warn">
          <strong>Reconciliation impact (GOV-4):</strong> this payrun had a governed reversal or correction linked. Financial, bank, and GL controls for this <em>source</em> run may be stale until re-truthed and impact is acknowledged. Payroll period close stays blocked until flags clear.
        </Banner>
      )}

      {payGroupReadiness && !payGroupReadiness.canCreatePayrun && (
        <Banner variant="error">
          Payroll readiness is not green ({payGroupReadiness.readinessPercent ?? 0}%).
          {payGroupReadiness.blockingReasons && payGroupReadiness.blockingReasons.length > 0 && (
            <span> {payGroupReadiness.blockingReasons.map((b) => b.message).join(' · ')}</span>
          )}
          {payrunDetailHasStatutoryReadinessBlockers(payGroupReadiness.blockingReasons) && (
            <span>
              {' '}
              <Link to="/admin/statutory-config" style={{ color: 'inherit', fontWeight: 600 }}>
                Statutory config / bootstrap
              </Link>
            </span>
          )}
        </Banner>
      )}
      {financialControl !== undefined && (
        <Card>
          <CardHeader
            title="Financial control (register ↔ export)"
            right={
              can('payrun:edit') ? (
                <button
                  type="button"
                  style={{ ...styles.buttonSecondary, fontSize: 12 }}
                  disabled={actionLoading || payrunLifecycleFrozen}
                  onClick={async () => {
                    if (!id) return;
                    try {
                      setActionLoading(true);
                      setError(null);
                      await api.post(`/payruns/${id}/financial-control/reconcile`);
                      await loadPayrun();
                      setActionMsg('Financial control reconciled');
                    } catch (e: any) {
                      setError(e?.response?.data?.message ?? 'Reconcile failed');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  Reconcile
                </button>
              ) : null
            }
          />
          <div style={{ padding: '0 16px 16px', fontSize: 13, color: styles.colors.text }}>
            {!financialControl ? (
              <Banner variant="warn">No financial control record yet. Create a payment batch, export it, then reconcile (export triggers reconcile automatically).</Banner>
            ) : (
              <>
                {financialControl.post_close_reconciliation_impact_pending === true && (
                  <Banner variant="warn" style={{ marginBottom: 12 }}>
                    Post-close impact: register ↔ export truth for this source may be superseded by a linked adjustment. Re-reconcile if needed, then use the Post-Close Impact card to acknowledge.
                  </Banner>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div><span style={{ color: styles.colors.textMuted }}>Status</span><div style={{ fontWeight: 700 }}>{String(financialControl.status ?? '—')}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Register net</span><div style={{ fontWeight: 600 }}>{fmt(Number(financialControl.total_net_register), resultsCurrency)}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Export net</span><div style={{ fontWeight: 600 }}>{fmt(Number(financialControl.total_net_export), resultsCurrency)}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Variance</span><div style={{ fontWeight: 600 }}>{fmt(Number(financialControl.variance_amount), resultsCurrency)}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Employees (reg / exp)</span><div>{Number(financialControl.employee_count_register)} / {Number(financialControl.employee_count_export)}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Threshold policy</span><div>{String(financialControl.threshold_policy ?? '—')}</div></div>
                </div>
                {Array.isArray(financialControl.blocked_reasons) && (financialControl.blocked_reasons as string[]).length > 0 && (
                  <Banner variant="error" style={{ marginTop: 10 }}>Blocked: {(financialControl.blocked_reasons as string[]).join(', ')}</Banner>
                )}
                {Array.isArray(financialControl.soft_warnings) && (financialControl.soft_warnings as string[]).length > 0 && (
                  <Banner variant="warn" style={{ marginTop: 10 }}>Warnings: {(financialControl.soft_warnings as string[]).join(', ')}</Banner>
                )}
                {financialControl.status === 'VARIANCE' && !(financialControl as { reviewed_at?: string | null }).reviewed_at && can('payrun:approve') && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      style={styles.buttonPrimary}
                      disabled={actionLoading}
                      onClick={async () => {
                        if (!id) return;
                        try {
                          setActionLoading(true);
                          setError(null);
                          await api.post(`/payruns/${id}/financial-control/review`, {});
                          await loadPayrun();
                          setActionMsg('Variance review recorded');
                        } catch (e: any) {
                          setError(e?.response?.data?.message ?? 'Review failed');
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                    >
                      Acknowledge variance review
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {bankControl !== undefined && (
        <Card>
          <CardHeader title="Bank confirmation (export ↔ settlement)" />
          <div style={{ padding: '0 16px 16px', fontSize: 13, color: styles.colors.text }}>
            {!bankControl ? (
              <Banner variant="warn">
                No bank reconciliation yet. After export (GOV-3A), import the bank acknowledgment or settlement file summary for this batch before marking posted (GOV-3B).
              </Banner>
            ) : (
              <>
                {bankControl.post_close_reconciliation_impact_pending === true && (
                  <Banner variant="warn" style={{ marginBottom: 12 }}>
                    Post-close impact: export ↔ bank settlement for this source may be stale. Re-import or review as needed, then acknowledge impact when governance is satisfied.
                  </Banner>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div><span style={{ color: styles.colors.textMuted }}>Status</span><div style={{ fontWeight: 700 }}>{String(bankControl.status ?? '—')}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Export total</span><div style={{ fontWeight: 600 }}>{fmt(Number(bankControl.export_total), resultsCurrency)}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Bank confirmed</span><div style={{ fontWeight: 600 }}>{fmt(Number(bankControl.bank_confirmed_total), resultsCurrency)}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Variance</span><div style={{ fontWeight: 600 }}>{fmt(Number(bankControl.variance_amount), resultsCurrency)}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Rejected / partial</span><div>{Number(bankControl.rejected_count ?? 0)} / {Number(bankControl.partial_count ?? 0)}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Source</span><div>{String(bankControl.source_type ?? '—')}</div></div>
                </div>
                {Array.isArray(bankControl.blocked_reasons) && (bankControl.blocked_reasons as string[]).length > 0 && (
                  <Banner variant="error" style={{ marginTop: 10 }}>Blocked: {(bankControl.blocked_reasons as string[]).join(', ')}</Banner>
                )}
                {Array.isArray(bankControl.soft_warnings) && (bankControl.soft_warnings as string[]).length > 0 && (
                  <Banner variant="warn" style={{ marginTop: 10 }}>Warnings: {(bankControl.soft_warnings as string[]).join(', ')}</Banner>
                )}
                {(bankControl.status === 'VARIANCE' || bankControl.status === 'REJECTED' || bankControl.status === 'PARTIAL') &&
                  !(bankControl as { reviewed_at?: string | null }).reviewed_at &&
                  (bankControl as { review_required?: boolean }).review_required !== false &&
                  can('payrun:approve') && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      style={styles.buttonPrimary}
                      disabled={actionLoading}
                      onClick={async () => {
                        if (!id) return;
                        try {
                          setActionLoading(true);
                          setError(null);
                          await api.post(`/payruns/${id}/bank-confirmation/review`, {});
                          await loadPayrun();
                          setActionMsg('Bank reconciliation review recorded');
                        } catch (e: any) {
                          setError(e?.response?.data?.message ?? 'Review failed');
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                    >
                      Acknowledge bank reconciliation review
                    </button>
                  </div>
                )}
              </>
            )}
            {can('payrun:edit') && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${styles.colors.border}` }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Import bank file summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <span style={{ color: styles.colors.textMuted }}>File reference</span>
                    <input value={bankImportReference} onChange={(e) => setBankImportReference(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}` }} placeholder="e.g. bank_ack_jan.csv" />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <span style={{ color: styles.colors.textMuted }}>Source</span>
                    <select value={bankImportSource} onChange={(e) => setBankImportSource(e.target.value as typeof bankImportSource)} style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}` }}>
                      <option value="MANUAL">MANUAL</option>
                      <option value="BANK_ACK">BANK_ACK</option>
                      <option value="BANK_RETURN">BANK_RETURN</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <span style={{ color: styles.colors.textMuted }}>Bank confirmed total</span>
                    <input value={bankImportTotal} onChange={(e) => setBankImportTotal(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}` }} placeholder="0.00" />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <span style={{ color: styles.colors.textMuted }}>Bank employee count</span>
                    <input value={bankImportCount} onChange={(e) => setBankImportCount(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}` }} placeholder="0" />
                  </label>
                </div>
                <button
                  type="button"
                  style={{ ...styles.buttonSecondary, marginTop: 12 }}
                  disabled={
                    actionLoading ||
                    !bankImportReference.trim() ||
                    bankImportTotal.trim() === '' ||
                    bankImportCount.trim() === ''
                  }
                  onClick={async () => {
                    if (!id) return;
                    try {
                      setActionLoading(true);
                      setError(null);
                      await api.post(`/payruns/${id}/bank-confirmation/import`, {
                        bank_file_reference: bankImportReference.trim(),
                        source_type: bankImportSource,
                        bank_confirmed_total: Number(bankImportTotal),
                        bank_confirmed_employee_count: Number.parseInt(bankImportCount, 10),
                      });
                      setBankImportReference('');
                      setBankImportTotal('');
                      setBankImportCount('');
                      await loadPayrun();
                      setActionMsg('Bank confirmation imported');
                    } catch (e: any) {
                      setError(e?.response?.data?.message ?? 'Import failed');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  Upload / import summary
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {postCloseImpact && (
        <Card>
          <CardHeader title="Post-close impact (GOV-4)" />
          <div style={{ padding: '0 16px 16px', fontSize: 13, color: styles.colors.text }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <span style={{ color: styles.colors.textMuted }}>Original status / type</span>
                <div style={{ fontWeight: 600 }}>
                  {String(postCloseImpact.original_status ?? '—')} · {String(postCloseImpact.original_payrun_type ?? '—')}
                </div>
              </div>
              <div>
                <span style={{ color: styles.colors.textMuted }}>Reconciliation outstanding</span>
                <div style={{ fontWeight: 600 }}>
                  {postCloseImpact.any_impact === true || postCloseImpact.downstream_reconciliation_outstanding === true ? 'Yes' : 'No'}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              <div style={{ padding: 8, borderRadius: 6, background: postCloseImpact.financial_control_impacted === true ? '#fff7ed' : '#f8fafc' }}>
                <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Financial (3A)</div>
                <div style={{ fontWeight: 700 }}>{postCloseImpact.financial_control_impacted === true ? 'Impacted' : 'OK'}</div>
              </div>
              <div style={{ padding: 8, borderRadius: 6, background: postCloseImpact.bank_reconciliation_impacted === true ? '#fff7ed' : '#f8fafc' }}>
                <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Bank (3B)</div>
                <div style={{ fontWeight: 700 }}>{postCloseImpact.bank_reconciliation_impacted === true ? 'Impacted' : 'OK'}</div>
              </div>
              <div style={{ padding: 8, borderRadius: 6, background: postCloseImpact.gl_reconciliation_impacted === true ? '#fff7ed' : '#f8fafc' }}>
                <div style={{ fontSize: 11, color: styles.colors.textMuted }}>GL (3C)</div>
                <div style={{ fontWeight: 700 }}>{postCloseImpact.gl_reconciliation_impacted === true ? 'Impacted' : 'OK'}</div>
              </div>
            </div>
            {Array.isArray(postCloseImpact.reversal_workflows) && (postCloseImpact.reversal_workflows as object[]).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Reversal workflows</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(postCloseImpact.reversal_workflows as Record<string, unknown>[]).map((w) => (
                    <li key={String(w.id)}>
                      {String(w.status)} → adjustment payrun{' '}
                      <code style={{ fontSize: 12 }}>{String(w.reversal_payrun_id ?? '—')}</code>
                      {w.downstream_reconciliation_required === true ? ' · downstream flag set' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(postCloseImpact.correction_approvals) && (postCloseImpact.correction_approvals as object[]).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Correction approvals</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(postCloseImpact.correction_approvals as Record<string, unknown>[]).map((c) => (
                    <li key={String(c.id)}>
                      {String(c.approval_reference)} — {String(c.status)} →{' '}
                      <code style={{ fontSize: 12 }}>{String(c.resulting_adjustment_payrun_id ?? '—')}</code>
                      {c.downstream_reconciliation_required === true ? ' · downstream flag set' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(postCloseImpact.any_impact === true || postCloseImpact.downstream_reconciliation_outstanding === true) && can('payrun:approve') && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${styles.colors.border}` }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  <span style={{ color: styles.colors.textMuted }}>Acknowledgement note (optional)</span>
                  <textarea
                    value={postCloseAckNote}
                    onChange={(e) => setPostCloseAckNote(e.target.value)}
                    rows={2}
                    style={{ padding: 8, borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontFamily: 'inherit' }}
                    placeholder="e.g. Re-ran 3A/3B/3C; CFO sign-off reference …"
                  />
                </label>
                <button
                  type="button"
                  style={{ ...styles.buttonPrimary, marginTop: 10 }}
                  disabled={actionLoading}
                  onClick={async () => {
                    if (!id) return;
                    try {
                      setActionLoading(true);
                      setError(null);
                      await api.post(`/payruns/${id}/post-close-reconciliation-impact/acknowledge`, {
                        note: postCloseAckNote.trim() || undefined,
                      });
                      setPostCloseAckNote('');
                      await loadPayrun();
                      setActionMsg('Post-close reconciliation impact acknowledged');
                    } catch (e: any) {
                      setError(e?.response?.data?.message ?? 'Acknowledge failed');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  Acknowledge reconciliation impact
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {glControl !== undefined && (
        <Card>
          <CardHeader title="GL reconciliation (register ↔ posting)" />
          <div style={{ padding: '0 16px 16px', fontSize: 13, color: styles.colors.text }}>
            <Banner variant="info" style={{ marginBottom: 12 }}>
              Required for <strong>payroll period close</strong> together with readiness, financial (3A), and bank (3B) gates (GOV-3C).
            </Banner>
            {!glControl ? (
              <Banner variant="warn">
                No GL reconciliation yet. Import GL or ERP posting totals after the payrun register is calculated.
              </Banner>
            ) : (
              <>
                {glControl.post_close_reconciliation_impact_pending === true && (
                  <Banner variant="warn" style={{ marginBottom: 12 }}>
                    Post-close impact: register ↔ GL posting for this source may be stale. Re-import GL confirmation if needed, then acknowledge impact when satisfied.
                  </Banner>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div><span style={{ color: styles.colors.textMuted }}>Status</span><div style={{ fontWeight: 700 }}>{String(glControl.status ?? '—')}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>GL batch ref</span><div style={{ fontWeight: 600 }}>{String(glControl.gl_batch_reference ?? '—')}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Source</span><div>{String(glControl.source_type ?? '—')}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Register gross / GL</span><div>{fmt(Number(glControl.register_gross), resultsCurrency)} / {fmt(Number(glControl.gl_gross), resultsCurrency)}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Register net / GL</span><div>{fmt(Number(glControl.register_net), resultsCurrency)} / {fmt(Number(glControl.gl_net), resultsCurrency)}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Register PAYE / GL</span><div>{fmt(Number(glControl.register_paye), resultsCurrency)} / {fmt(Number(glControl.gl_paye), resultsCurrency)}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Register ded. / GL</span><div>{fmt(Number(glControl.register_deductions), resultsCurrency)} / {fmt(Number(glControl.gl_deductions), resultsCurrency)}</div></div>
                  <div><span style={{ color: styles.colors.textMuted }}>Max |variance|</span><div style={{ fontWeight: 600 }}>{fmt(Number(glControl.variance_amount), resultsCurrency)}</div></div>
                </div>
                {Array.isArray(glControl.blocked_reasons) && (glControl.blocked_reasons as string[]).length > 0 && (
                  <Banner variant="error" style={{ marginTop: 10 }}>Blocked: {(glControl.blocked_reasons as string[]).join(', ')}</Banner>
                )}
                {Array.isArray(glControl.soft_warnings) && (glControl.soft_warnings as string[]).length > 0 && (
                  <Banner variant="warn" style={{ marginTop: 10 }}>Warnings: {(glControl.soft_warnings as string[]).join(', ')}</Banner>
                )}
                {glControl.status === 'VARIANCE' &&
                  (glControl as { review_required?: boolean }).review_required === true &&
                  !(glControl as { reviewed_at?: string | null }).reviewed_at &&
                  can('payrun:approve') && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      style={styles.buttonPrimary}
                      disabled={actionLoading}
                      onClick={async () => {
                        if (!id) return;
                        try {
                          setActionLoading(true);
                          setError(null);
                          await api.post(`/payruns/${id}/gl-confirmation/review`, {});
                          await loadPayrun();
                          setActionMsg('GL variance review recorded');
                        } catch (e: any) {
                          setError(e?.response?.data?.message ?? 'Review failed');
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                    >
                      Acknowledge GL variance review
                    </button>
                  </div>
                )}
              </>
            )}
            {can('payrun:edit') && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${styles.colors.border}` }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Import GL / ERP totals</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <span style={{ color: styles.colors.textMuted }}>GL batch reference</span>
                    <input value={glImportRef} onChange={(e) => setGlImportRef(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}` }} placeholder="e.g. GL_JAN2026" />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <span style={{ color: styles.colors.textMuted }}>Source</span>
                    <select value={glImportSource} onChange={(e) => setGlImportSource(e.target.value as typeof glImportSource)} style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}` }}>
                      <option value="MANUAL">MANUAL</option>
                      <option value="ERP_IMPORT">ERP_IMPORT</option>
                      <option value="GL_FILE">GL_FILE</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}><span style={{ color: styles.colors.textMuted }}>GL gross</span><input value={glImportGross} onChange={(e) => setGlImportGross(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}` }} /></label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}><span style={{ color: styles.colors.textMuted }}>GL net</span><input value={glImportNet} onChange={(e) => setGlImportNet(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}` }} /></label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}><span style={{ color: styles.colors.textMuted }}>GL PAYE</span><input value={glImportPaye} onChange={(e) => setGlImportPaye(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}` }} /></label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}><span style={{ color: styles.colors.textMuted }}>GL deductions</span><input value={glImportDed} onChange={(e) => setGlImportDed(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}` }} /></label>
                </div>
                <button
                  type="button"
                  style={{ ...styles.buttonSecondary, marginTop: 12 }}
                  disabled={
                    actionLoading ||
                    !glImportRef.trim() ||
                    glImportGross.trim() === '' ||
                    glImportNet.trim() === '' ||
                    glImportPaye.trim() === '' ||
                    glImportDed.trim() === ''
                  }
                  onClick={async () => {
                    if (!id) return;
                    try {
                      setActionLoading(true);
                      setError(null);
                      await api.post(`/payruns/${id}/gl-confirmation/import`, {
                        gl_batch_reference: glImportRef.trim(),
                        source_type: glImportSource,
                        gl_gross: Number(glImportGross),
                        gl_net: Number(glImportNet),
                        gl_paye: Number(glImportPaye),
                        gl_deductions: Number(glImportDed),
                      });
                      setGlImportRef('');
                      setGlImportGross('');
                      setGlImportNet('');
                      setGlImportPaye('');
                      setGlImportDed('');
                      await loadPayrun();
                      setActionMsg('GL confirmation imported');
                    } catch (e: any) {
                      setError(e?.response?.data?.message ?? 'Import failed');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  Import GL totals
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {financialControl && financialControl.status !== 'MATCH' && !(financialControl.status === 'VARIANCE' && (financialControl as { reviewed_at?: string | null }).reviewed_at) && can('payrun:financial_override') && (
        <Card>
          <CardHeader title="Financial gate override (audited)" />
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={financialOverrideUse} onChange={(e) => setFinancialOverrideUse(e.target.checked)} />
              I am explicitly overriding the register↔export financial gate for mark paid / mark posted.
            </label>
            <textarea
              value={financialOverrideJustification}
              onChange={(e) => setFinancialOverrideJustification(e.target.value)}
              placeholder="Justification (min. 20 characters; sent as x-financial-override-justification)"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 13 }}
            />
          </div>
        </Card>
      )}

      {bankGateNeedsTreasuryOverride && can('payrun:bank_override') && (
        <Card>
          <CardHeader title="Bank gate override (treasury, audited)" />
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={bankOverrideUse} onChange={(e) => setBankOverrideUse(e.target.checked)} />
              I am explicitly overriding the export↔bank confirmation gate for mark posted only.
            </label>
            <textarea
              value={bankOverrideJustification}
              onChange={(e) => setBankOverrideJustification(e.target.value)}
              placeholder="Justification (min. 20 characters; sent as x-bank-override-justification)"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 13 }}
            />
          </div>
        </Card>
      )}

      {glGateNeedsAccountingOverride && can('payrun:gl_override') && (
        <Card>
          <CardHeader title="GL gate override (accounting, audited)" />
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={glOverrideUse} onChange={(e) => setGlOverrideUse(e.target.checked)} />
              I am explicitly overriding the register↔GL gate for payroll period close (use Payroll Calendars → Period close overrides when closing a period).
            </label>
            <textarea
              value={glOverrideJustification}
              onChange={(e) => setGlOverrideJustification(e.target.value)}
              placeholder="Justification (min. 20 characters; sent as x-gl-override-justification)"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 13 }}
            />
          </div>
        </Card>
      )}

      {payGroupReadiness && !payGroupReadiness.canCreatePayrun && can('payrun:readiness_override') && (
        <Card>
          <CardHeader title="Readiness override (audited)" />
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={readinessOverrideUse} onChange={(e) => setReadinessOverrideUse(e.target.checked)} />
              I am explicitly overriding the readiness gate for gated payrun actions.
            </label>
            <textarea
              value={readinessOverrideJustification}
              onChange={(e) => setReadinessOverrideJustification(e.target.value)}
              placeholder="Justification (min. 20 characters; sent as x-readiness-override-justification)"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 13 }}
            />
          </div>
        </Card>
      )}

      {/* Lifecycle progress strip */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 0 }}>
          {LIFECYCLE_STEPS.map((s, i) => {
            const reached = i <= currentStepIdx;
            const isCurrent = s === status;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: isCurrent ? styles.colors.primary : reached ? '#16a34a' : '#e2e8f0',
                  color: reached ? '#fff' : '#94a3b8',
                }}>
                  {reached && !isCurrent ? '✓' : i + 1}
                </div>
                <div style={{ marginLeft: 6, fontSize: 11, color: isCurrent ? styles.colors.primary : reached ? '#16a34a' : '#94a3b8', fontWeight: isCurrent ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {s.replace(/_/g, ' ')}
                </div>
                {i < LIFECYCLE_STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: reached ? '#16a34a' : '#e2e8f0', margin: '0 8px' }} />}
              </div>
            );
          })}
        </div>
      </Card>

      <TabsBar>
        {(['overview', 'employees', 'results', 'exceptions', 'approvals', 'payments', 'audit'] as TabKey[]).map((t) => (
          <Tab key={t} active={tab === t} onClick={() => changeTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'exceptions' && excSummary && excSummary.openTotal > 0 && (
              <span style={{ marginLeft: 6, background: excSummary.criticalOpen > 0 ? '#dc2626' : '#ea580c', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                {excSummary.openTotal}
              </span>
            )}
          </Tab>
        ))}
      </TabsBar>

      {tab === 'overview' && (
        <Stack gap={16}>
          {periodClosedImmutable && (
            <Banner variant="error">
              This pay period is closed (GOV-3D-1). Register and lifecycle actions are disabled for this regular payrun in the admin UI.
            </Banner>
          )}
          {hasSubmissionBlockers && status === 'CALCULATED' && (
            <Banner variant="error">{excSummary?.blockingSubmissionCount ?? 0} exception(s) block approval submission. <a href="#" onClick={e => { e.preventDefault(); changeTab('exceptions'); }} style={{ color: '#dc2626', fontWeight: 600 }}>View Exceptions</a></Banner>
          )}
          {hasPaymentBlockers && ['APPROVED', 'POSTED'].includes(status) && (
            <Banner variant="error">{excSummary?.blockingPaymentCount ?? 0} exception(s) block payment. <a href="#" onClick={e => { e.preventDefault(); changeTab('exceptions'); }} style={{ color: '#dc2626', fontWeight: 600 }}>View Exceptions</a></Banner>
          )}
          <Grid cols="1fr 1fr 1fr 1fr 1fr" gap={16}>
            <Card><div style={{ fontSize: 12, color: styles.colors.textMuted }}>Employees</div><div style={{ fontSize: 24, fontWeight: 700 }}>{displayHeadcount}</div></Card>
            <Card><div style={{ fontSize: 12, color: styles.colors.textMuted }}>Gross Pay</div><div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(totals.gross ?? totals.total_gross)}</div></Card>
            <Card><div style={{ fontSize: 12, color: styles.colors.textMuted }}>Deductions</div><div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(totals.total_deductions ?? totals.deductions)}</div></Card>
            <Card><div style={{ fontSize: 12, color: styles.colors.textMuted }}>PAYE</div><div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(totals.paye ?? totals.total_paye)}</div></Card>
            <Card><div style={{ fontSize: 12, color: styles.colors.textMuted }}>Net Pay</div><div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{fmt(totals.net ?? totals.total_net)}</div></Card>
          </Grid>
          {/* Exception + Readiness summary on overview */}
          {excSummary && excSummary.openTotal > 0 && (
            <Card>
              <CardHeader title="Exception Summary" right={<a href="#" onClick={e => { e.preventDefault(); changeTab('exceptions'); }} style={{ fontSize: 12, color: styles.colors.primary, textDecoration: 'none' }}>View all exceptions →</a>} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, padding: '0 16px 16px' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: '#dc2626' }}>Critical</div><div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{excSummary.criticalOpen}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: '#ea580c' }}>High</div><div style={{ fontSize: 20, fontWeight: 700, color: '#ea580c' }}>{excSummary.highOpen}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: '#d97706' }}>Medium</div><div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{excSummary.mediumOpen}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: '#16a34a' }}>Low</div><div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{excSummary.lowOpen}</div></div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Payrun Context" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '0 16px 16px' }}>
              <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Pay Group</div><div style={{ fontWeight: 500, fontSize: 13 }}>{payGroup?.name ?? '—'}</div></div>
              <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Legal Entity</div><div style={{ fontWeight: 500, fontSize: 13 }}>{payGroup?.legalEntity?.name ?? '—'}</div></div>
              <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Country</div><div style={{ fontWeight: 500, fontSize: 13 }}>{payGroup?.country ?? '—'}</div></div>
              <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Run Type</div><div style={{ fontWeight: 500, fontSize: 13 }}>{payrun.payrunType ?? payrun.payrun_type ?? 'REGULAR'}</div></div>
              <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Created</div><div style={{ fontWeight: 500, fontSize: 13 }}>{new Date(payrun.createdAt ?? payrun.created_at).toLocaleString()}</div></div>
              <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Last Calculated</div><div style={{ fontWeight: 500, fontSize: 13 }}>{payrun.lastCalculatedAt ?? payrun.last_calculated_at ? new Date(payrun.lastCalculatedAt ?? payrun.last_calculated_at).toLocaleString() : 'Not yet'}</div></div>
            </div>
          </Card>
        </Stack>
      )}

      {tab === 'employees' && (
        <Card>
          <CardHeader
            title="Employee Results"
            right={
              <span style={{ fontSize: 12, color: styles.colors.textMuted }}>
                {displayHeadcount} on register / {results.length} with calculated rows
              </span>
            }
          />
          {results.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: styles.colors.textMuted }}>
              {status === 'SNAPSHOT' && registerCount > 0
                ? 'Register has snapshotted employees; run Calculate to produce payroll result rows here.'
                : ['DRAFT', 'SNAPSHOT'].includes(status)
                  ? 'Snapshot and calculate the payrun to see employee results.'
                  : 'No employee results available.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    {(displaySchema?.summary_columns ?? [])
                      .filter((c) => c.visible)
                      .sort((a, b) => a.order - b.order)
                      .map((col) => (
                        <th key={col.key} style={{ ...styles.tableHeaderCell, textAlign: (col.align as any) || 'left' }}>{col.label}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.employee_id} style={{ ...styles.tableRow, cursor: 'pointer', background: selectedEmployee?.employee_id === r.employee_id ? '#f0f9ff' : undefined }}
                      onClick={() => setSelectedEmployee(selectedEmployee?.employee_id === r.employee_id ? null : r)}>
                      {(displaySchema?.summary_columns ?? [])
                        .filter((c) => c.visible)
                        .sort((a, b) => a.order - b.order)
                        .map((col) => {
                          const value = getSummaryCellValue(r, col);
                          const isNetPay = col.core_field === 'net_pay';
                          const isText = col.format === 'text';
                          return (
                            <td key={col.key} style={{
                              ...styles.tableCell,
                              textAlign: (col.align as any) || 'left',
                              fontWeight: isNetPay ? 600 : undefined,
                              color: isNetPay ? '#16a34a' : undefined,
                            }}>
                              {isText
                                ? (value ?? '—')
                                : fmt(typeof value === 'number' ? value : null, resultsCurrency)}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
                {normalizedTotals && displaySchema && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                      {displaySchema.summary_columns
                        .filter((c) => c.visible)
                        .sort((a, b) => a.order - b.order)
                        .map((col) => {
                          if (col.source === 'employee_identity') {
                            return <td key={col.key} style={{ ...styles.tableCell, fontWeight: 700 }}>Totals</td>;
                          }
                          let total: number | null = null;
                          if (col.source === 'core_field' && col.core_field) {
                            total = (normalizedTotals as any)[col.core_field] ?? null;
                          }
                          if (col.source === 'summary_line' && col.line_code) {
                            total = normalizedTotals.summary_line_totals?.[col.line_code] ?? 0;
                          }
                          return (
                            <td key={col.key} style={{
                              ...styles.tableCell,
                              textAlign: (col.align as any) || 'right',
                              fontWeight: 700,
                              color: col.core_field === 'net_pay' ? '#16a34a' : undefined,
                            }}>
                              {fmt(total, resultsCurrency)}
                            </td>
                          );
                        })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {selectedEmployee && displaySchema && (
            <div style={{ borderTop: `1px solid ${styles.colors.border}`, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h4 style={{ margin: 0 }}>
                  {selectedEmployee.employee_name || selectedEmployee.employee_code || selectedEmployee.employee_id}
                  {selectedEmployee.employee_number && <span style={{ fontWeight: 400, fontSize: 13, color: styles.colors.textMuted, marginLeft: 8 }}>({selectedEmployee.employee_number})</span>}
                </h4>
                <button style={{ ...styles.buttonSecondary, fontSize: 12 }} onClick={() => setSelectedEmployee(null)}>Close</button>
              </div>

              {/* Totals cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Gross</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(selectedEmployee.gross, resultsCurrency)}</div>
                </div>
                {displaySchema.totals_panel.show_taxable_income && (
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Taxable Income</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(selectedEmployee.taxable_income, resultsCurrency)}</div>
                  </div>
                )}
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Employee Deductions</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(selectedEmployee.employee_deductions_total, resultsCurrency)}</div>
                </div>
                {displaySchema.totals_panel.show_employer_contributions_total && (
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Employer Contributions</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(selectedEmployee.employer_contributions_total, resultsCurrency)}</div>
                  </div>
                )}
                {displaySchema.totals_panel.show_employer_levies_total && (
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: styles.colors.textMuted }}>Employer Levies</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(selectedEmployee.employer_levies_total, resultsCurrency)}</div>
                  </div>
                )}
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: '#16a34a' }}>Net Pay</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{fmt(selectedEmployee.net_pay, resultsCurrency)}</div>
                </div>
                {displaySchema.totals_panel.show_employer_cost && (
                  <div style={{ background: '#fef3c7', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: '#92400e' }}>Employer Cost</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#92400e' }}>{fmt(selectedEmployee.employer_cost, resultsCurrency)}</div>
                  </div>
                )}
              </div>

              {/* Grouped line breakdown */}
              {displaySchema.detail_groups
                .sort((a, b) => a.order - b.order)
                .map((group) => {
                  const groupLines = getDetailGroupLines(selectedEmployee, group);
                  if (groupLines.length === 0) return null;
                  const groupTotal = groupLines.reduce((s, l) => s + l.amount, 0);
                  return (
                    <div key={group.key} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: styles.colors.textMuted, textTransform: 'uppercase' as const, marginBottom: 8, letterSpacing: '0.5px' }}>
                        {group.label}
                      </div>
                      <div style={{ background: '#f8fafc', borderRadius: 8, overflow: 'hidden' }}>
                        {groupLines.map((line, idx) => (
                          <div key={`${line.code}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: idx < groupLines.length - 1 ? `1px solid ${styles.colors.border}` : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13 }}>{line.label}</span>
                              {line.is_statutory && <span style={{ fontSize: 9, background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>STATUTORY</span>}
                              {line.statutory_group && <span style={{ fontSize: 9, background: '#e0e7ff', color: '#4f46e5', padding: '1px 5px', borderRadius: 3 }}>{line.statutory_group}</span>}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmt(line.amount, resultsCurrency)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#e2e8f0', fontWeight: 700, fontSize: 13 }}>
                          <span>Total</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(groupTotal, resultsCurrency)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      )}

      {tab === 'results' && (
        <Stack gap={16}>
          {/* Core payroll totals */}
          <Grid cols="1fr 1fr 1fr 1fr" gap={16}>
            <Card>
              <div style={{ fontSize: 12, color: styles.colors.textMuted }}>Total Gross</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(normalizedTotals?.gross ?? totals.gross ?? totals.total_gross, resultsCurrency)}</div>
            </Card>
            <Card>
              <div style={{ fontSize: 12, color: styles.colors.textMuted }}>Employee Deductions</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(normalizedTotals?.employee_deductions_total ?? totals.total_deductions ?? totals.deductions, resultsCurrency)}</div>
            </Card>
            <Card>
              <div style={{ fontSize: 12, color: styles.colors.textMuted }}>Total PAYE</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(normalizedTotals?.summary_line_totals?.PAYE ?? totals.paye ?? totals.total_paye, resultsCurrency)}</div>
            </Card>
            <Card>
              <div style={{ fontSize: 12, color: styles.colors.textMuted }}>Total Net Pay</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{fmt(normalizedTotals?.net_pay ?? totals.net ?? totals.total_net, resultsCurrency)}</div>
            </Card>
          </Grid>

          {/* Employer obligations -- only show if display schema says so */}
          {displaySchema?.totals_panel.show_employer_contributions_total && (
            <Grid cols={displaySchema?.totals_panel.show_employer_levies_total ? '1fr 1fr 1fr' : '1fr 1fr'} gap={16}>
              <Card>
                <div style={{ fontSize: 12, color: styles.colors.textMuted }}>Employer Contributions</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(normalizedTotals?.employer_contributions_total, resultsCurrency)}</div>
                {normalizedTotals?.summary_line_totals?.UIF_EMPLOYER != null && normalizedTotals.summary_line_totals.UIF_EMPLOYER > 0 && (
                  <div style={{ fontSize: 11, color: styles.colors.textMuted, marginTop: 4 }}>UIF Employer: {fmt(normalizedTotals.summary_line_totals.UIF_EMPLOYER, resultsCurrency)}</div>
                )}
              </Card>
              {displaySchema?.totals_panel.show_employer_levies_total && (
                <Card>
                  <div style={{ fontSize: 12, color: styles.colors.textMuted }}>Employer Levies</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(normalizedTotals?.employer_levies_total, resultsCurrency)}</div>
                  {normalizedTotals?.summary_line_totals?.SDL != null && normalizedTotals.summary_line_totals.SDL > 0 && (
                    <div style={{ fontSize: 11, color: styles.colors.textMuted, marginTop: 4 }}>SDL: {fmt(normalizedTotals.summary_line_totals.SDL, resultsCurrency)}</div>
                  )}
                </Card>
              )}
              {displaySchema?.totals_panel.show_employer_cost && (
                <Card>
                  <div style={{ fontSize: 12, color: '#92400e' }}>Total Employer Cost</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#92400e' }}>{fmt(normalizedTotals?.employer_cost, resultsCurrency)}</div>
                </Card>
              )}
            </Grid>
          )}

          {/* Statutory totals panel */}
          {statutoryTotals.length > 0 && (
            <Card>
              <CardHeader title="Statutory Obligations" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '0 16px 16px' }}>
                {/* Employee-side statutory */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: styles.colors.textMuted, textTransform: 'uppercase' as const, marginBottom: 8, letterSpacing: '0.5px' }}>Employee Statutory Deductions</div>
                  <div style={{ background: '#f8fafc', borderRadius: 8, overflow: 'hidden' }}>
                    {statutoryTotals.filter((s) => s.side === 'employee').map((s, i, arr) => (
                      <div key={s.code} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${styles.colors.border}` : 'none' }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</span>
                          {s.statutory_group && <span style={{ marginLeft: 8, fontSize: 10, background: '#e0e7ff', color: '#4f46e5', padding: '1px 6px', borderRadius: 4 }}>{s.statutory_group}</span>}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(s.total, resultsCurrency)}</span>
                      </div>
                    ))}
                    {statutoryTotals.filter((s) => s.side === 'employee').length === 0 && (
                      <div style={{ padding: '12px 16px', color: styles.colors.textMuted, fontSize: 12 }}>None</div>
                    )}
                  </div>
                </div>
                {/* Employer-side statutory */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: styles.colors.textMuted, textTransform: 'uppercase' as const, marginBottom: 8, letterSpacing: '0.5px' }}>Employer Statutory Obligations</div>
                  <div style={{ background: '#fef3c7', borderRadius: 8, overflow: 'hidden' }}>
                    {statutoryTotals.filter((s) => s.side === 'employer').map((s, i, arr) => (
                      <div key={s.code} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${styles.colors.border}` : 'none' }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</span>
                          {s.statutory_group && <span style={{ marginLeft: 8, fontSize: 10, background: '#e0e7ff', color: '#4f46e5', padding: '1px 6px', borderRadius: 4 }}>{s.statutory_group}</span>}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(s.total, resultsCurrency)}</span>
                      </div>
                    ))}
                    {statutoryTotals.filter((s) => s.side === 'employer').length === 0 && (
                      <div style={{ padding: '12px 16px', color: styles.colors.textMuted, fontSize: 12 }}>None</div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Summary breakdown */}
          <Card>
            <CardHeader title="Payroll Summary" />
            <div style={{ padding: '0 16px 16px', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${styles.colors.border}` }}>
                <span>Employee Count</span>
                <span style={{ fontWeight: 600 }}>{totals.employee_count ?? results.length}</span>
              </div>
              {displaySchema?.totals_panel.show_taxable_income && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${styles.colors.border}` }}>
                  <span>Total Taxable Income</span>
                  <span style={{ fontWeight: 600 }}>{fmt(normalizedTotals?.summary_line_totals?.TAXABLE_INCOME ?? totals.taxable_income ?? totals.total_taxable_income, resultsCurrency)}</span>
                </div>
              )}
            </div>
          </Card>
        </Stack>
      )}

      {tab === 'exceptions' && (
        <Stack gap={16}>
          {/* Exception summary cards */}
          {excSummary && (
            <Grid cols="1fr 1fr 1fr 1fr 1fr" gap={12}>
              <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Open</div><div style={{ fontSize: 22, fontWeight: 700 }}>{excSummary.openTotal}</div></Card>
              <Card><div style={{ fontSize: 11, color: '#dc2626' }}>Critical</div><div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{excSummary.criticalOpen}</div></Card>
              <Card><div style={{ fontSize: 11, color: '#ea580c' }}>High</div><div style={{ fontSize: 22, fontWeight: 700, color: '#ea580c' }}>{excSummary.highOpen}</div></Card>
              <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Blocks Submission</div><div style={{ fontSize: 22, fontWeight: 700, color: hasSubmissionBlockers ? '#dc2626' : '#16a34a' }}>{excSummary.blockingSubmissionCount}</div></Card>
              <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Blocks Payment</div><div style={{ fontSize: 22, fontWeight: 700, color: hasPaymentBlockers ? '#dc2626' : '#16a34a' }}>{excSummary.blockingPaymentCount}</div></Card>
            </Grid>
          )}

          {hasSubmissionBlockers && (
            <Banner variant="error">This payrun has {excSummary?.blockingSubmissionCount ?? 0} exception(s) that block submission for approval. Resolve or dismiss them to proceed.</Banner>
          )}

          {/* Filters */}
          <Card>
            <div style={{ display: 'flex', gap: 8, padding: '12px 16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 120 }} value={excFilter.severity} onChange={e => setExcFilter(f => ({ ...f, severity: e.target.value }))}>
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
              <select style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 120 }} value={excFilter.status} onChange={e => setExcFilter(f => ({ ...f, status: e.target.value }))}>
                <option value="">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
              </select>
              {can('payrun:calculate') && status !== 'DRAFT' && !periodClosedImmutable && (
                <button style={styles.buttonSecondary} disabled={actionLoading} onClick={async () => {
                  try {
                    setActionLoading(true);
                    await api.post(`/payruns/${id}/detect-exceptions`);
                    await loadPayrun();
                    setActionMsg('Exception detection completed');
                  } catch { setError('Exception detection failed'); }
                  finally { setActionLoading(false); }
                }}>Re-detect Exceptions</button>
              )}
            </div>
          </Card>

          {/* Exception table */}
          <Card>
            <CardHeader title="Exceptions" right={<span style={{ fontSize: 12, color: styles.colors.textMuted }}>{filteredExceptions.length} exception(s)</span>} />
            {filteredExceptions.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: styles.colors.textMuted }}>
                {exceptions.length === 0 ? 'No exceptions detected. Calculate the payrun to run detection.' : 'No exceptions match the current filters.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th style={styles.tableHeaderCell}>Severity</th>
                      <th style={styles.tableHeaderCell}>Exception</th>
                      <th style={styles.tableHeaderCell}>Employee</th>
                      <th style={styles.tableHeaderCell}>Blockers</th>
                      <th style={styles.tableHeaderCell}>Status</th>
                      <th style={styles.tableHeaderCell}>Detected</th>
                      <th style={styles.tableHeaderCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExceptions.map((exc: any) => (
                      <tr key={exc.id} style={styles.tableRow}>
                        <td style={styles.tableCell}><SeverityBadge severity={exc.severity} /></td>
                        <td style={styles.tableCell}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{exc.title}</div>
                          <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{exc.description}</div>
                        </td>
                        <td style={styles.tableCell}>{exc.employeeName ?? '—'}</td>
                        <td style={styles.tableCell}>
                          {exc.blocksSubmission && <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 6px', borderRadius: 4, fontSize: 10, marginRight: 4 }}>Submit</span>}
                          {exc.blocksPayment && <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>Payment</span>}
                          {!exc.blocksSubmission && !exc.blocksPayment && <span style={{ color: styles.colors.textMuted, fontSize: 11 }}>—</span>}
                        </td>
                        <td style={styles.tableCell}><ExceptionStatusBadge status={exc.status} /></td>
                        <td style={styles.tableCell}><span style={{ fontSize: 11, color: styles.colors.textMuted }}>{new Date(exc.detectedAt).toLocaleString()}</span></td>
                        <td style={styles.tableCell}>
                          {['OPEN', 'ASSIGNED'].includes(exc.status) && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              {can('payrun:edit') && !periodClosedImmutable && (
                                <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px' }} onClick={() => setResolveModal({ id: exc.id, note: '', type: 'DATA_FIXED' })}>Resolve</button>
                              )}
                              {can('payrun:edit') && !periodClosedImmutable && (
                                <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px', color: '#94a3b8' }} onClick={() => setDismissModal({ id: exc.id, reason: '' })}>Dismiss</button>
                              )}
                            </div>
                          )}
                          {exc.status === 'RESOLVED' && <span style={{ fontSize: 11, color: '#16a34a' }}>Resolved</span>}
                          {exc.status === 'DISMISSED' && <span style={{ fontSize: 11, color: '#94a3b8' }}>Dismissed</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </Stack>
      )}

      {tab === 'approvals' && (
        <Stack gap={16}>
          {hasSubmissionBlockers && status === 'CALCULATED' && (
            <Banner variant="error">Cannot submit for approval: {excSummary?.blockingSubmissionCount ?? 0} blocking exception(s) must be resolved first.</Banner>
          )}
          <Card>
            <CardHeader title="Approval Workflow" />
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Submitted By</div><div style={{ fontWeight: 500, fontSize: 13 }}>{payrun.submittedByUserId ?? payrun.submitted_by_user_id ?? 'Not submitted'}</div></div>
                <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Submitted At</div><div style={{ fontWeight: 500, fontSize: 13 }}>{payrun.submittedAt ?? payrun.submitted_at ? new Date(payrun.submittedAt ?? payrun.submitted_at).toLocaleString() : '—'}</div></div>
                <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Approved By</div><div style={{ fontWeight: 500, fontSize: 13 }}>{payrun.approvedByUserId ?? payrun.approved_by_user_id ?? '—'}</div></div>
                <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Approved At</div><div style={{ fontWeight: 500, fontSize: 13 }}>{payrun.approvedAt ?? payrun.approved_at ? new Date(payrun.approvedAt ?? payrun.approved_at).toLocaleString() : '—'}</div></div>
              </div>
              {status === 'IN_REVIEW' && can('payrun:approve') && !periodClosedImmutable && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={styles.buttonPrimary}
                    disabled={actionLoading || readinessBlockedForAction('approve')}
                    onClick={() => doAction('approve')}
                  >
                    Approve
                  </button>
                  <button style={{ ...styles.buttonSecondary, color: '#dc2626', borderColor: '#fecaca' }} disabled={actionLoading} onClick={() => setShowRejectModal(true)}>Reject</button>
                </div>
              )}
              {status === 'CALCULATED' && can('payrun:submit') && !periodClosedImmutable && (
                <div>
                  <button
                    style={styles.buttonPrimary}
                    disabled={actionLoading || hasSubmissionBlockers || readinessBlockedForAction('submit-for-approval')}
                    onClick={() => doAction('submit-for-approval')}
                    title={hasSubmissionBlockers ? 'Resolve blocking exceptions first' : ''}
                  >
                    Submit for Approval
                  </button>
                  {hasSubmissionBlockers && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>Resolve blocking payroll exceptions before submission.</div>}
                </div>
              )}
            </div>
          </Card>
        </Stack>
      )}

      {tab === 'payments' && (
        <Stack gap={16}>
          {hasPaymentBlockers && ['APPROVED', 'POSTED'].includes(status) && (
            <Banner variant="error">Cannot mark payrun as paid: {excSummary?.blockingPaymentCount ?? 0} payment-blocking exception(s) must be resolved first.</Banner>
          )}
          <Card>
            <CardHeader title="Payment Information" />
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Paid By</div><div style={{ fontWeight: 500, fontSize: 13 }}>{payrun.paidByUserId ?? payrun.paid_by_user_id ?? '—'}</div></div>
                <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Paid At</div><div style={{ fontWeight: 500, fontSize: 13 }}>{payrun.paidAt ?? payrun.paid_at ? new Date(payrun.paidAt ?? payrun.paid_at).toLocaleString() : '—'}</div></div>
                <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Payment Status</div><div style={{ fontWeight: 500, fontSize: 13 }}>{['PAID', 'POSTED', 'FINALIZED'].includes(status) ? 'Paid' : status === 'APPROVED' ? (hasPaymentBlockers ? 'Blocked by exceptions' : 'Ready for payment') : 'Pending'}</div></div>
                <div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Net Pay Total</div><div style={{ fontWeight: 500, fontSize: 13, color: '#16a34a' }}>{fmt(totals.net ?? totals.total_net)}</div></div>
              </div>
              {status === 'APPROVED' && can('payrun:pay') && !periodClosedImmutable && (
                <div>
                  <button
                    style={styles.buttonPrimary}
                    disabled={actionLoading || hasPaymentBlockers || readinessBlockedForAction('mark-paid') || financialBlockedForAction('mark-paid')}
                    onClick={() => doAction('mark-paid', 'post', { paid_at: new Date().toISOString(), payment_reference: 'manual' })}
                    title={hasPaymentBlockers ? 'Resolve payment-blocking exceptions first' : ''}
                  >
                    Mark Paid
                  </button>
                  {hasPaymentBlockers && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>Resolve payment-blocking exceptions before marking paid.</div>}
                </div>
              )}
              {['PAID', 'POSTED'].includes(status) && (
                <Link to="/payroll/payment-batches" style={{ ...styles.buttonSecondary, textDecoration: 'none' }}>View Payment Batches</Link>
              )}
            </div>
          </Card>
        </Stack>
      )}

      {/* Cancel payrun (terminal) */}
      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 12px' }}>Cancel payrun</h3>
            <p style={{ fontSize: 13, color: styles.colors.textMuted, margin: '0 0 16px' }}>
              This sets the payrun to <strong>CANCELLED</strong> (cannot be undone from the UI). Allowed only before approval, payment, posting, or finalization, and not when a payment batch exists or an export was generated. Provide an audited reason.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (required)…"
              rows={4}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, boxSizing: 'border-box' as const }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" style={styles.buttonSecondary} onClick={() => { setShowCancelModal(false); setCancelReason(''); }}>Back</button>
              <button
                type="button"
                style={{ ...styles.buttonPrimary, background: '#b45309' }}
                disabled={!cancelReason.trim() || actionLoading}
                onClick={() => void performCancelPayrun()}
              >
                Confirm cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 12px' }}>Reject Payrun</h3>
            <p style={{ fontSize: 13, color: styles.colors.textMuted, margin: '0 0 16px' }}>Provide a reason for rejecting this payrun. The payrun will be reverted to CALCULATED status.</p>
            <textarea style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minHeight: 80, resize: 'vertical' as const, boxSizing: 'border-box' as const }} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection (required)..." />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={styles.buttonSecondary} onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>Cancel</button>
              <button style={{ ...styles.buttonPrimary, background: '#dc2626' }} disabled={!rejectReason.trim() || actionLoading} onClick={async () => {
                await doAction('revert-to-draft', 'post', { revert_reason: rejectReason });
                setShowRejectModal(false); setRejectReason('');
              }}>Reject Payrun</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <Card>
          <CardHeader title="Audit Trail" />
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: 'Created', time: payrun.createdAt ?? payrun.created_at, actor: payrun.createdByUserId ?? payrun.created_by_user_id },
                { label: 'Snapshotted', time: payrun.snapshotAt ?? payrun.snapshot_at },
                { label: 'Last Calculated', time: payrun.lastCalculatedAt ?? payrun.last_calculated_at },
                { label: 'Submitted', time: payrun.submittedAt ?? payrun.submitted_at, actor: payrun.submittedByUserId ?? payrun.submitted_by_user_id },
                { label: 'Approved', time: payrun.approvedAt ?? payrun.approved_at, actor: payrun.approvedByUserId ?? payrun.approved_by_user_id },
                { label: 'Paid', time: payrun.paidAt ?? payrun.paid_at, actor: payrun.paidByUserId ?? payrun.paid_by_user_id },
                { label: 'Finalized', time: payrun.finalizedAt ?? payrun.finalized_at, actor: payrun.finalizedByUserId ?? payrun.finalized_by_user_id },
              ].filter((e) => e.time).map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${styles.colors.border}` }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{e.label}</div>
                    {e.actor && <div style={{ fontSize: 11, color: styles.colors.textMuted }}>By: {e.actor}</div>}
                  </div>
                  <div style={{ fontSize: 12, color: styles.colors.textMuted }}>{new Date(e.time).toLocaleString()}</div>
                </div>
              ))}
            </div>
            {![payrun.createdAt, payrun.created_at].some(Boolean) && (
              <div style={{ padding: 20, textAlign: 'center', color: styles.colors.textMuted }}>No audit events recorded yet.</div>
            )}
          </div>
        </Card>
      )}
      {resolveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Resolve Exception</h3>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: styles.colors.textMuted }}>Resolution Type</label>
            <select value={resolveModal.type} onChange={e => setResolveModal({ ...resolveModal, type: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, marginBottom: 12 }}>
              <option value="DATA_FIXED">Data Fixed</option>
              <option value="ACCEPTED_WITH_JUSTIFICATION">Accepted with Justification</option>
              <option value="NOT_APPLICABLE">Not Applicable</option>
              <option value="MANUAL_OVERRIDE_APPROVED">Manual Override Approved</option>
            </select>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: styles.colors.textMuted }}>Resolution Note *</label>
            <textarea value={resolveModal.note} onChange={e => setResolveModal({ ...resolveModal, note: e.target.value })} rows={3} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, resize: 'vertical' as const }} placeholder="Describe what was fixed or why this is acceptable..." />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={styles.buttonSecondary} onClick={() => setResolveModal(null)}>Cancel</button>
              <button style={styles.buttonPrimary} disabled={!resolveModal.note.trim() || actionLoading} onClick={resolveExc}>{actionLoading ? 'Resolving...' : 'Resolve'}</button>
            </div>
          </div>
        </div>
      )}

      {dismissModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Dismiss Exception</h3>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: styles.colors.textMuted }}>Dismissal Reason *</label>
            <textarea value={dismissModal.reason} onChange={e => setDismissModal({ ...dismissModal, reason: e.target.value })} rows={3} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, resize: 'vertical' as const }} placeholder="Explain why this exception is being dismissed..." />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={styles.buttonSecondary} onClick={() => setDismissModal(null)}>Cancel</button>
              <button style={{ ...styles.buttonPrimary, background: '#94a3b8' }} disabled={!dismissModal.reason.trim() || actionLoading} onClick={dismissExc}>{actionLoading ? 'Dismissing...' : 'Dismiss'}</button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
