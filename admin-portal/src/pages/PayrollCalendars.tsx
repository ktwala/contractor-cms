import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import {
  PERIOD_CLOSE_OVERRIDE_JUSTIFICATION_MIN,
  buildPeriodCloseOverrideHeaders,
  hasInvalidPeriodCloseOverrideSelection,
  isPeriodCloseRetryBlocked,
  periodCloseGateLabel,
} from '../utils/periodCloseGovernanceClient';
import type { PeriodCloseOverrideSelection } from '../utils/periodCloseGovernanceClient';
import { Page, Card, CardHeader, Banner, Grid } from '../ui/layout';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: '#f0fdf4', text: '#16a34a' },
  LOCKED: { bg: '#fffbeb', text: '#d97706' },
  CLOSED: { bg: '#f1f5f9', text: '#94a3b8' },
};

function PeriodStatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: '#f1f5f9', text: '#475569' };
  return <span style={{ background: c.bg, color: c.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{status}</span>;
}

export default function PayrollCalendars() {
  const { can } = useAccess();
  const [calendars, setCalendars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCalendar, setSelectedCalendar] = useState<any>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  /** Last period-close 403 `code` per period (first failing gate in backend chain). */
  const [closeFailureByPeriodId, setCloseFailureByPeriodId] = useState<
    Record<string, { code: string; message: string }>
  >({});
  const [periodCloseJustification, setPeriodCloseJustification] = useState('');
  const [useReadinessOverride, setUseReadinessOverride] = useState(false);
  const [useFinancialOverride, setUseFinancialOverride] = useState(false);
  const [useBankOverride, setUseBankOverride] = useState(false);
  const [useGlOverride, setUseGlOverride] = useState(false);

  const loadCalendars = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res = await api.get('/api/payroll-cycle/calendars');
      setCalendars(res.data?.items ?? res.data ?? []);
    } catch {
      setError('Failed to load calendars');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadCalendars(); }, [loadCalendars]);

  const loadPeriods = async (calId: string) => {
    try {
      setPeriodsLoading(true);
      const res = await api.get(`/api/payroll-cycle/calendars/${calId}/periods`);
      const items = res.data?.items ?? res.data ?? [];
      const enriched = items.map((p: any) => {
        const run = p.payRuns?.[0];
        return run
          ? { ...p, linkedPayrunId: run.id, linkedPayrunStatus: run.status }
          : p;
      });
      setPeriods(enriched);
      setCloseFailureByPeriodId({});
    } catch {
      setPeriods([]);
    } finally { setPeriodsLoading(false); }
  };

  const selectCalendar = (cal: any) => {
    setSelectedCalendar(cal);
    setCloseFailureByPeriodId({});
    void loadPeriods(cal.id);
  };

  const periodCloseSelection = (): PeriodCloseOverrideSelection => ({
    justification: periodCloseJustification,
    useReadinessOverride,
    useFinancialOverride,
    useBankOverride,
    useGlOverride,
    canReadinessOverride: can('payrun:readiness_override'),
    canFinancialOverride: can('payrun:financial_override'),
    canBankOverride: can('payrun:bank_override'),
    canGlOverride: can('payrun:gl_override'),
  });

  const closePeriodWithGovernance = async (periodId: string) => {
    try {
      setActionLoading(true);
      setActionMsg(null);
      setError(null);
      const headers = buildPeriodCloseOverrideHeaders(periodCloseSelection());
      await api.post(`/api/payroll-cycle/periods/${periodId}/close`, {}, { headers });
      setActionMsg('Period close completed');
      setCloseFailureByPeriodId((prev) => {
        const next = { ...prev };
        delete next[periodId];
        return next;
      });
      if (selectedCalendar) void loadPeriods(selectedCalendar.id);
    } catch (e: any) {
      const code = e?.response?.data?.code;
      const msg = e?.response?.data?.message;
      if (e?.response?.status === 403 && typeof code === 'string') {
        setCloseFailureByPeriodId((prev) => ({
          ...prev,
          [periodId]: { code, message: typeof msg === 'string' ? msg : 'Period close blocked by governance gate.' },
        }));
        setError(
          typeof msg === 'string'
            ? `${periodCloseGateLabel(code)}: ${msg}`
            : periodCloseGateLabel(code),
        );
      } else {
        setError(typeof msg === 'string' ? msg : 'Period close failed');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const periodAction = async (periodId: string, action: string) => {
    try {
      setActionLoading(true); setActionMsg(null);
      await api.post(`/api/payroll-cycle/periods/${periodId}/${action}`);
      setActionMsg(`Period ${action} completed`);
      if (selectedCalendar) void loadPeriods(selectedCalendar.id);
    } catch (e: any) { setError(e?.response?.data?.message ?? `Failed: ${action}`); }
    finally { setActionLoading(false); }
  };

  const generatePeriods = async () => {
    if (!selectedCalendar) return;
    try {
      setActionLoading(true); setActionMsg(null);
      await api.post(`/api/payroll-cycle/calendars/${selectedCalendar.id}/generate-periods`, { year: generateYear });
      setActionMsg(`Periods generated for ${generateYear}`);
      setShowGenerate(false);
      void loadPeriods(selectedCalendar.id);
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to generate periods'); }
    finally { setActionLoading(false); }
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';

  if (loading) return <Page title="Payroll Calendars"><div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div></Page>;

  const activeCount = calendars.length;
  const openPeriodCount = periods.filter(p => (p.status ?? '').toUpperCase() === 'OPEN').length;

  return (
    <Page
      title="Payroll Calendars"
      subtitle="Manage payroll cycles, periods, payment dates, and period controls."
    >
      {error && <Banner variant="error">{error}</Banner>}
      {actionMsg && <Banner variant="success">{actionMsg}</Banner>}

      {/* Summary */}
      <Grid cols="1fr 1fr 1fr" gap={16}>
        <Card><div style={{ fontSize: 12, color: styles.colors.textMuted }}>Calendars (Pay Groups)</div><div style={{ fontSize: 24, fontWeight: 700 }}>{activeCount}</div></Card>
        <Card><div style={{ fontSize: 12, color: styles.colors.textMuted }}>Selected Calendar Periods</div><div style={{ fontSize: 24, fontWeight: 700 }}>{periods.length}</div></Card>
        <Card><div style={{ fontSize: 12, color: styles.colors.textMuted }}>Open Periods</div><div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{openPeriodCount}</div></Card>
      </Grid>

      {/* Calendars list */}
      <Card>
        <CardHeader title="All Calendars" right={<span style={{ fontSize: 12, color: styles.colors.textMuted }}>{calendars.length} calendar(s)</span>} />
        {calendars.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: styles.colors.textMuted }}>No calendars found. Create a pay group to get started.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Name</th>
                <th style={styles.tableHeaderCell}>Code</th>
                <th style={styles.tableHeaderCell}>Frequency</th>
                <th style={styles.tableHeaderCell}>Country</th>
                <th style={styles.tableHeaderCell}>Currency</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr></thead>
              <tbody>
                {calendars.map((cal: any) => (
                  <tr key={cal.id} style={{ ...styles.tableRow, background: selectedCalendar?.id === cal.id ? '#eff6ff' : undefined, cursor: 'pointer' }} onClick={() => selectCalendar(cal)}>
                    <td style={styles.tableCell}><div style={{ fontWeight: 500 }}>{cal.name}</div><div style={{ fontSize: 11, color: styles.colors.textMuted }}>{cal.legalEntity?.name ?? ''}</div></td>
                    <td style={styles.tableCell}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{cal.code}</span></td>
                    <td style={styles.tableCell}>{cal.frequency}</td>
                    <td style={styles.tableCell}>{cal.country}</td>
                    <td style={styles.tableCell}>{cal.currency}</td>
                    <td style={styles.tableCell}>
                      <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px' }} onClick={e => { e.stopPropagation(); selectCalendar(cal); }}>View Periods</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Periods for selected calendar */}
      {selectedCalendar && (
        <Card>
          <CardHeader
            title={`Periods — ${selectedCalendar.name}`}
            right={
              <div style={{ display: 'flex', gap: 8 }}>
                {can('payroll:calendars:manage') && <button style={styles.buttonSecondary} onClick={() => setShowGenerate(!showGenerate)}>Generate Periods</button>}
              </div>
            }
          />

          {showGenerate && (
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: `1px solid ${styles.colors.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 13 }}>Year:</label>
              <input type="number" value={generateYear} onChange={e => setGenerateYear(Number(e.target.value))} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, width: 80, fontSize: 13 }} />
              <button style={styles.buttonPrimary} disabled={actionLoading} onClick={generatePeriods}>Generate</button>
              <button style={styles.buttonSecondary} onClick={() => setShowGenerate(false)}>Cancel</button>
            </div>
          )}

          {can('payroll:periods:close') &&
            periods.some((p: any) => ['OPEN', 'LOCKED'].includes((p.status ?? 'OPEN').toUpperCase())) && (
            <div
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${styles.colors.border}`,
                background: '#f8fafc',
                fontSize: 13,
                color: styles.colors.text,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Period close overrides (PR-PAYRUN-GOV-3C-UI)</div>
              <div style={{ fontSize: 12, color: styles.colors.textMuted, marginBottom: 10 }}>
                Close period sends audited override headers only for checked gates you are permitted to use. Minimum{' '}
                {PERIOD_CLOSE_OVERRIDE_JUSTIFICATION_MIN} characters when any override is selected.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={useReadinessOverride} disabled={!can('payrun:readiness_override')} onChange={(e) => setUseReadinessOverride(e.target.checked)} />
                  Readiness
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={useFinancialOverride} disabled={!can('payrun:financial_override')} onChange={(e) => setUseFinancialOverride(e.target.checked)} />
                  Financial (3A)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={useBankOverride} disabled={!can('payrun:bank_override')} onChange={(e) => setUseBankOverride(e.target.checked)} />
                  Bank (3B)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={useGlOverride} disabled={!can('payrun:gl_override')} onChange={(e) => setUseGlOverride(e.target.checked)} />
                  GL (3C)
                </label>
              </div>
              <textarea
                value={periodCloseJustification}
                onChange={(e) => setPeriodCloseJustification(e.target.value)}
                placeholder={`Override justification (min. ${PERIOD_CLOSE_OVERRIDE_JUSTIFICATION_MIN} chars when using overrides)`}
                rows={2}
                style={{
                  width: '100%',
                  maxWidth: 560,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${styles.colors.border}`,
                  fontSize: 13,
                  boxSizing: 'border-box' as const,
                }}
              />
            </div>
          )}

          {periodsLoading ? (
            <div style={{ padding: 32, textAlign: 'center' }}><div style={styles.loadingSpinner} /></div>
          ) : periods.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: styles.colors.textMuted }}>No periods found. Use "Generate Periods" to create them.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead><tr style={styles.tableHeader}>
                  <th style={styles.tableHeaderCell}>Period</th>
                  <th style={styles.tableHeaderCell}>Start</th>
                  <th style={styles.tableHeaderCell}>End</th>
                  <th style={styles.tableHeaderCell}>Pay Date</th>
                  <th style={styles.tableHeaderCell}>Status</th>
                  <th style={styles.tableHeaderCell}>Linked Payrun</th>
                  <th style={styles.tableHeaderCell}>Actions</th>
                </tr></thead>
                <tbody>
                  {periods.map((p: any) => {
                    const st = (p.status ?? 'OPEN').toUpperCase();
                    const closeFail = closeFailureByPeriodId[p.id];
                    const sel = periodCloseSelection();
                    const closeDisabled =
                      actionLoading ||
                      hasInvalidPeriodCloseOverrideSelection(sel) ||
                      isPeriodCloseRetryBlocked(closeFail?.code, sel);
                    return (
                      <tr key={p.id} style={styles.tableRow}>
                        <td style={styles.tableCell}><div style={{ fontWeight: 500 }}>{p.year} P{p.periodNum ?? p.period_num}</div></td>
                        <td style={styles.tableCell}>{fmt(p.startDate ?? p.start_date)}</td>
                        <td style={styles.tableCell}>{fmt(p.endDate ?? p.end_date)}</td>
                        <td style={styles.tableCell}>{fmt(p.payDate ?? p.pay_date)}</td>
                        <td style={styles.tableCell}><PeriodStatusBadge status={st} /></td>
                        <td style={styles.tableCell}>
                          {p.linkedPayrunId ? (
                            <Link to={`/payroll/payruns/${p.linkedPayrunId}`} style={{ color: styles.colors.primary, textDecoration: 'none', fontSize: 12 }}>
                              {p.linkedPayrunStatus ?? 'View'} →
                            </Link>
                          ) : <span style={{ fontSize: 11, color: styles.colors.textMuted }}>—</span>}
                        </td>
                        <td style={styles.tableCell}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {st === 'OPEN' && can('payroll:periods:lock') && <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px' }} disabled={actionLoading} onClick={() => periodAction(p.id, 'lock')}>Lock</button>}
                              {st === 'LOCKED' && can('payroll:periods:unlock') && <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px' }} disabled={actionLoading} onClick={() => periodAction(p.id, 'unlock')}>Unlock</button>}
                              {(st === 'OPEN' || st === 'LOCKED') && can('payroll:periods:close') && (
                                <button
                                  type="button"
                                  style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px', color: '#94a3b8' }}
                                  disabled={closeDisabled}
                                  title={
                                    closeFail
                                      ? `Blocked: ${periodCloseGateLabel(closeFail.code)}. Enable matching override and justification, or resolve data.`
                                      : hasInvalidPeriodCloseOverrideSelection(sel)
                                        ? `Select overrides only with permission; justification min. ${PERIOD_CLOSE_OVERRIDE_JUSTIFICATION_MIN} chars.`
                                        : 'Close payroll period (readiness + GOV-3A/3B/3C)'
                                  }
                                  onClick={() => void closePeriodWithGovernance(p.id)}
                                >
                                  Close
                                </button>
                              )}
                            </div>
                            {closeFail && (
                              <span style={{ fontSize: 11, color: '#b45309', maxWidth: 280, lineHeight: 1.35 }}>
                                Gate: <strong>{periodCloseGateLabel(closeFail.code)}</strong>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </Page>
  );
}
