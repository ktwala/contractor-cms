import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, Grid } from '../ui/layout';
import { classifyError } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageStateView } from '../ui/PageStateViews';
import type { PageState } from '../utils/pageState';

export default function PayrollForecasting() {
  const [selectedPeriod, setSelectedPeriod] = useState('q1_2026');
  const [forecasts, setForecasts] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/forecasting', { params: { period: selectedPeriod } });
      const data = res.data?.items ?? res.data ?? [];
      setForecasts(Array.isArray(data) ? data : []);
      setPageState(data.length > 0 ? { kind: 'ready' } : { kind: 'empty' });
    } catch (err: any) {
      const classified = classifyError(err);
      if (classified.kind === 'blocked') {
        setPageState(classified);
      } else if (err?.response?.status === 404) {
        setForecasts([]);
        setPageState({ kind: 'empty' });
      } else {
        setPageState(classified);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => { void load(); }, [load]);

  usePageStateTelemetry('payroll.forecasting', 'payroll', pageState);

  const displayForecasts = forecasts && forecasts.length > 0 ? forecasts : [
    { month: 'Jan 2026', grossPayroll: 0, taxes: 0, benefits: 0, netCost: 0, variance: 0 },
    { month: 'Feb 2026', grossPayroll: 0, taxes: 0, benefits: 0, netCost: 0, variance: 0 },
    { month: 'Mar 2026', grossPayroll: 0, taxes: 0, benefits: 0, netCost: 0, variance: 0 },
  ];

  const totalGross = displayForecasts.reduce((sum, f) => sum + (f.grossPayroll ?? 0), 0);
  const totalNet = displayForecasts.reduce((sum, f) => sum + (f.netCost ?? 0), 0);
  const fmtM = (v: number) => v > 0 ? `R ${(v / 1000000).toFixed(1)}M` : 'R 0';
  const fmtR = (v: number) => v > 0 ? `R ${v.toLocaleString()}` : 'R 0';

  return (
    <Page
      title="Payroll Forecasting"
      subtitle="Project future payroll costs and trends"
      actions={
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} style={styles.formSelect}>
            <option value="q1_2026">Q1 2026</option>
            <option value="q2_2026">Q2 2026</option>
            <option value="2026">Full Year 2026</option>
          </select>
          <button style={styles.buttonPrimary} disabled={pageState.kind !== 'ready'}>Export Report</button>
        </div>
      }
    >
      {loading ? (
        <div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div>
      ) : pageState.kind !== 'ready' && pageState.kind !== 'empty' ? (
        <PageStateView
          state={pageState}
          page="payroll.forecasting"
          module="payroll"
          onRetry={load}
          emptyTitle="No forecast data available"
          emptyMessage="Forecasts require completed payruns with historical data."
        />
      ) : (
        <>
          <Grid cols="1fr 1fr 1fr 1fr" gap={12}>
            {[
              { label: 'Projected Gross', value: fmtM(totalGross), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: styles.colors.gradientAdmin },
              { label: 'Projected Tax', value: fmtM(displayForecasts.reduce((s, f) => s + (f.taxes ?? 0), 0)), icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', color: styles.colors.warning },
              { label: 'Projected Benefits', value: fmtM(displayForecasts.reduce((s, f) => s + (f.benefits ?? 0), 0)), icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: styles.colors.info },
              { label: 'Total Cost', value: fmtM(totalNet), icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: styles.colors.success },
            ].map((stat, i) => (
              <Card key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
                  <div style={styles.iconContainer(stat.color)}>
                    <svg width="22" height="22" fill="none" stroke="white" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: styles.colors.textMuted, margin: 0 }}>{stat.label}</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: styles.colors.textPrimary, margin: 0 }}>{stat.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </Grid>

          {pageState.kind === 'empty' && (
            <Card>
              <div style={{ padding: 40, textAlign: 'center', color: styles.colors.textMuted }}>
                <p style={{ margin: '0 0 8px', fontSize: 14 }}>No forecast data available yet</p>
                <p style={{ margin: 0, fontSize: 12 }}>Forecasts are generated from completed payruns and historical payroll data.</p>
              </div>
            </Card>
          )}

          {pageState.kind === 'ready' && (
            <>
              <Card>
                <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>Monthly Breakdown</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead><tr style={styles.tableHeader}>
                      <th style={styles.tableHeaderCell}>Month</th>
                      <th style={styles.tableHeaderCell}>Gross Payroll</th>
                      <th style={styles.tableHeaderCell}>Taxes</th>
                      <th style={styles.tableHeaderCell}>Benefits</th>
                      <th style={styles.tableHeaderCell}>Total Cost</th>
                      <th style={styles.tableHeaderCell}>Variance</th>
                    </tr></thead>
                    <tbody>
                      {displayForecasts.map((f, idx) => (
                        <tr key={f.month} style={{ ...styles.tableRow, borderBottom: idx === displayForecasts.length - 1 ? 'none' : undefined }}>
                          <td style={{ ...styles.tableCell, fontWeight: 600 }}>{f.month}</td>
                          <td style={styles.tableCell}>{fmtR(f.grossPayroll)}</td>
                          <td style={styles.tableCell}>{fmtR(f.taxes)}</td>
                          <td style={styles.tableCell}>{fmtR(f.benefits)}</td>
                          <td style={{ ...styles.tableCell, fontWeight: 600 }}>{fmtR(f.netCost)}</td>
                          <td style={styles.tableCell}>
                            <span style={{ color: f.variance >= 0 ? styles.colors.danger : styles.colors.success, fontWeight: 500 }}>
                              {f.variance >= 0 ? '+' : ''}{f.variance}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div style={{ marginTop: 16, padding: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <svg width="20" height="20" fill="none" stroke="#3b82f6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p style={{ fontSize: 13, color: '#1e40af', margin: 0 }}>Forecasts are based on current headcount, approved salary increases, and historical trends. Variance indicates difference from budget.</p>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Page>
  );
}
