import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import { Page, Card, CardHeader, Banner, Stack } from '../ui/layout';

type Portfolio = {
  scope: string;
  scope_id: string;
  label: string | null;
  total_payruns: number;
  blocked_payruns_count: number;
  stale_post_close_impact_count: number;
  override_event_count: number;
  financial_exception_payruns: number;
  bank_exception_payruns: number;
  gl_exception_payruns: number;
  open_payrun_exceptions_count: number;
};

type PayGroup = { id: string; code: string; name: string; legal_entity_id?: string };
type Period = { id: string; year: number; period_num?: number; periodNum?: number; start_date?: string; startDate?: string };
type LegalEntity = { id: string; code: string; name: string };

export default function GovernancePortfolio() {
  const { can } = useAccess();
  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [selectedPg, setSelectedPg] = useState('');
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedLe, setSelectedLe] = useState('');
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [exportTarget, setExportTarget] = useState<{ kind: 'period' | 'pay_group' | 'legal_entity'; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [pgRes, leRes] = await Promise.all([
          api.get('/pay-groups?limit=200'),
          api.get('/legal-entities', { params: { limit: 200 } }),
        ]);
        setPayGroups(pgRes.data?.items ?? pgRes.data ?? []);
        setLegalEntities(leRes.data?.items ?? leRes.data ?? []);
      } catch {
        setPayGroups([]);
        setLegalEntities([]);
      }
    })();
  }, []);

  const loadPeriods = useCallback(async (pgId: string) => {
    if (!pgId) {
      setPeriods([]);
      return;
    }
    try {
      const res = await api.get(`/pay-groups/${pgId}/periods?limit=50`);
      setPeriods(res.data?.items ?? res.data ?? []);
    } catch {
      setPeriods([]);
    }
  }, []);

  useEffect(() => {
    void loadPeriods(selectedPg);
  }, [selectedPg, loadPeriods]);

  const fetchPortfolio = async (kind: 'period' | 'pay_group' | 'legal_entity', id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setPortfolio(null);
    setExportTarget(null);
    try {
      let path = '';
      if (kind === 'period') path = `/api/payroll-cycle/governance-portfolio/periods/${id}`;
      if (kind === 'pay_group') path = `/api/payroll-cycle/governance-portfolio/pay-groups/${id}`;
      if (kind === 'legal_entity') path = `/api/payroll-cycle/governance-portfolio/legal-entities/${id}`;
      const res = await api.get(path);
      setPortfolio(res.data as Portfolio);
      setExportTarget({ kind, id });
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  };

  const downloadEvidenceExport = async (format: 'csv' | 'xlsx') => {
    if (!exportTarget) return;
    let path = '';
    if (exportTarget.kind === 'period') path = `/api/payroll-cycle/governance-portfolio/periods/${exportTarget.id}/export`;
    if (exportTarget.kind === 'pay_group') path = `/api/payroll-cycle/governance-portfolio/pay-groups/${exportTarget.id}/export`;
    if (exportTarget.kind === 'legal_entity') path = `/api/payroll-cycle/governance-portfolio/legal-entities/${exportTarget.id}/export`;
    try {
      const res = await api.get(path, { responseType: 'blob', params: { format } });
      const cd = res.headers['content-disposition'] as string | undefined;
      const match = cd?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `governance_portfolio_evidence.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
      const blob = new Blob([res.data], { type: res.headers['content-type'] ?? 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? `Failed to download ${format.toUpperCase()} evidence`);
    }
  };

  if (!can('payrun:read')) {
    return (
      <Page title="Governance portfolio">
        <Banner variant="error">You need payrun:read to view governance portfolio rollups.</Banner>
      </Page>
    );
  }

  return (
    <Page
      title="Governance portfolio"
      subtitle="GOV-5B — period, pay group, and legal entity rollups · GOV-5C — evidence export (.csv / .xlsx)"
      breadcrumbs={
        <Stack direction="row" gap={8} style={{ fontSize: 13 }}>
          <Link to="/payroll/payruns" style={{ color: styles.colors.primary }}>Payruns</Link>
          <span style={{ color: styles.colors.textMuted }}>/</span>
          <span style={{ color: styles.colors.textMuted }}>Portfolio</span>
        </Stack>
      }
    >
      {error && <Banner variant="error">{error}</Banner>}
      {loading && <Banner variant="info">Loading…</Banner>}

      <Card>
        <CardHeader title="Scope" />
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>By pay period</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <select value={selectedPg} onChange={(e) => { setSelectedPg(e.target.value); setSelectedPeriod(''); }} style={{ minWidth: 200, padding: 8, borderRadius: 6, border: `1px solid ${styles.colors.border}` }}>
                <option value="">Pay group…</option>
                {payGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                ))}
              </select>
              <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} style={{ minWidth: 220, padding: 8, borderRadius: 6, border: `1px solid ${styles.colors.border}` }}>
                <option value="">Period…</option>
                {periods.map((p) => {
                  const num = p.period_num ?? p.periodNum ?? '';
                  const sd = p.start_date ?? p.startDate ?? '';
                  return <option key={p.id} value={p.id}>{p.year}-{num} ({String(sd).slice(0, 10)})</option>;
                })}
              </select>
              <button type="button" style={styles.buttonPrimary} disabled={!selectedPeriod || loading} onClick={() => void fetchPortfolio('period', selectedPeriod)}>
                Load period rollup
              </button>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>By pay group (all payruns in group)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <select value={selectedPg} onChange={(e) => setSelectedPg(e.target.value)} style={{ minWidth: 200, padding: 8, borderRadius: 6, border: `1px solid ${styles.colors.border}` }}>
                <option value="">Pay group…</option>
                {payGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                ))}
              </select>
              <button type="button" style={styles.buttonSecondary} disabled={!selectedPg || loading} onClick={() => void fetchPortfolio('pay_group', selectedPg)}>
                Load pay group rollup
              </button>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>By legal entity</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <select value={selectedLe} onChange={(e) => setSelectedLe(e.target.value)} style={{ minWidth: 220, padding: 8, borderRadius: 6, border: `1px solid ${styles.colors.border}` }}>
                <option value="">Legal entity…</option>
                {legalEntities.map((le) => (
                  <option key={le.id} value={le.id}>{le.code} — {le.name}</option>
                ))}
              </select>
              <button type="button" style={styles.buttonSecondary} disabled={!selectedLe || loading} onClick={() => void fetchPortfolio('legal_entity', selectedLe)}>
                Load entity rollup
              </button>
            </div>
          </div>
        </div>
      </Card>

      {portfolio && (
        <Card>
          <CardHeader
            title="Summary"
            right={
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 12, color: styles.colors.textMuted }}>{portfolio.label ?? portfolio.scope_id}</span>
                {exportTarget && (
                  <>
                    <button type="button" style={styles.buttonSecondary} onClick={() => void downloadEvidenceExport('csv')}>
                      Download .csv
                    </button>
                    <button type="button" style={styles.buttonSecondary} onClick={() => void downloadEvidenceExport('xlsx')}>
                      Download .xlsx
                    </button>
                  </>
                )}
              </div>
            }
          />
          <div style={{ padding: '0 16px 16px', fontSize: 13, color: styles.colors.text }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              <div><span style={{ color: styles.colors.textMuted }}>Total payruns</span><div style={{ fontWeight: 700 }}>{portfolio.total_payruns}</div></div>
              <div><span style={{ color: styles.colors.textMuted }}>Blocked (3A/3B/3C BLOCKED)</span><div style={{ fontWeight: 700 }}>{portfolio.blocked_payruns_count}</div></div>
              <div><span style={{ color: styles.colors.textMuted }}>Stale post-close impact</span><div style={{ fontWeight: 700 }}>{portfolio.stale_post_close_impact_count}</div></div>
              <div><span style={{ color: styles.colors.textMuted }}>Override / bypass events</span><div style={{ fontWeight: 700 }}>{portfolio.override_event_count}</div></div>
              <div><span style={{ color: styles.colors.textMuted }}>Financial exception payruns</span><div style={{ fontWeight: 700 }}>{portfolio.financial_exception_payruns}</div></div>
              <div><span style={{ color: styles.colors.textMuted }}>Bank exception payruns</span><div style={{ fontWeight: 700 }}>{portfolio.bank_exception_payruns}</div></div>
              <div><span style={{ color: styles.colors.textMuted }}>GL exception payruns</span><div style={{ fontWeight: 700 }}>{portfolio.gl_exception_payruns}</div></div>
              <div><span style={{ color: styles.colors.textMuted }}>Open payrun exceptions</span><div style={{ fontWeight: 700 }}>{portfolio.open_payrun_exceptions_count}</div></div>
            </div>
            <p style={{ marginTop: 14, fontSize: 12, color: styles.colors.textMuted }}>
              Drill into a payrun via <Link to="/payroll/payruns" style={{ color: styles.colors.primary }}>Payruns</Link> → <strong>Governance cockpit</strong> (GOV-5A).
            </p>
          </div>
        </Card>
      )}
    </Page>
  );
}
