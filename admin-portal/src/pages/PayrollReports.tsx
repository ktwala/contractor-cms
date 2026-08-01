import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner, Grid } from '../ui/layout';
import { classifyError } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageBlockedView } from '../ui/PageStateViews';
import type { PageState } from '../utils/pageState';

interface SavedReport {
  id: string;
  report_name: string;
  report_type: string;
  description: string;
  is_scheduled: boolean;
  schedule_frequency: string;
  output_format: string;
  created_at: string;
}

interface TaxSummary {
  tax_type: string;
  tax_name: string;
  payrun_count: number;
  total_employee_tax: number;
  total_employer_tax: number;
  total_tax: number;
}

export default function PayrollReports() {
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState('ZAF');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportType, setReportType] = useState<string>('tax_summary');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newReportName, setNewReportName] = useState('');
  const [newReportDescription, setNewReportDescription] = useState('');
  const [blockedState, setBlockedState] = useState<PageState | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    loadSavedReports();
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(threeMonthsAgo.toISOString().split('T')[0]);
  }, []);

  const loadSavedReports = async () => {
    try {
      setSavedReports((await api.get('/analytics/reports/saved')).data);
    } catch (err: any) {
      const state = classifyError(err);
      if (state.kind === 'blocked') setBlockedState(state);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      let response;
      switch (reportType) {
        case 'tax_summary': response = await api.get('/analytics/tax/summary', { params: { country, date_from: dateFrom, date_to: dateTo } }); break;
        case 'turnover': response = await api.get('/analytics/turnover', { params: { country, period_months: 12 } }); break;
        case 'expenses': response = await api.get('/analytics/expenses', { params: { country, date_from: dateFrom, date_to: dateTo } }); break;
        case 'loans': response = await api.get('/analytics/loans/portfolio', { params: { country } }); break;
        default: response = await api.get('/analytics/dashboard', { params: { country } });
      }
      setReportData(response.data);
      setGenError(null);
    } catch (err: any) {
      const state = classifyError(err);
      if (state.kind === 'blocked') {
        setBlockedState(state);
      } else {
        setGenError(state.kind === 'error' ? state.message : 'Failed to generate report');
      }
      setReportData(null);
    } finally { setLoading(false); }
  };

  const saveReport = async () => {
    try {
      await api.post('/analytics/reports/saved', { report_name: newReportName, report_type: reportType, description: newReportDescription, filters: { country, date_from: dateFrom, date_to: dateTo }, output_format: 'csv', visibility: 'private', country });
      setShowSaveModal(false); setNewReportName(''); setNewReportDescription(''); loadSavedReports();
    } catch { }
  };

  const exportToCsv = () => {
    if (!reportData) return;
    let csvContent = '';
    if (reportType === 'tax_summary' && Array.isArray(reportData)) {
      csvContent = 'Tax Type,Tax Name,Payrun Count,Employee Tax,Employer Tax,Total Tax\n';
      reportData.forEach((row: TaxSummary) => { csvContent += `${row.tax_type},${row.tax_name},${row.payrun_count},${row.total_employee_tax},${row.total_employer_tax},${row.total_tax}\n`; });
    }
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${reportType}_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount || 0);

  const pageState: PageState = blockedState ?? { kind: 'ready' };
  usePageStateTelemetry('payroll.reports', 'payroll', pageState);

  if (blockedState && blockedState.kind === 'blocked') {
    return (
      <Page title="Payroll Reports & Analytics" subtitle="Generate custom reports and export data">
        <PageBlockedView code={blockedState.code} message={blockedState.message} page="payroll.reports" module="payroll" />
      </Page>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Payroll Reports & Analytics</h1>
        <p style={styles.pageSubtitle}>Generate custom reports and export data</p>
      </div>

      {genError && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          {genError}
        </div>
      )}

      {/* Report Configuration */}
      <div style={styles.card}>
        <h2 style={{ ...styles.sectionTitle, marginTop: 0 }}>Report Configuration</h2>
        <div style={styles.grid4}>
          <div>
            <label style={styles.formLabel}>Report Type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} style={styles.formSelect}>
              <option value="tax_summary">Tax Summary</option>
              <option value="turnover">Employee Turnover</option>
              <option value="expenses">Expense Analytics</option>
              <option value="loans">Loan Portfolio</option>
              <option value="performance">Performance Stats</option>
            </select>
          </div>
          <div>
            <label style={styles.formLabel}>Country</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} style={styles.formSelect}>
              <option value="ZAF">South Africa</option>
              <option value="LSO">Lesotho</option>
            </select>
          </div>
          <div>
            <label style={styles.formLabel}>Date From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={styles.formInput} />
          </div>
          <div>
            <label style={styles.formLabel}>Date To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={styles.formInput} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button onClick={generateReport} disabled={loading} style={styles.buttonPrimary}>{loading ? 'Generating...' : 'Generate Report'}</button>
          <button onClick={() => setShowSaveModal(true)} style={{ ...styles.buttonPrimary, background: styles.colors.success }}>Save Configuration</button>
          {reportData && <button onClick={exportToCsv} style={styles.buttonSecondary}>Export to CSV</button>}
        </div>
      </div>

      {/* Saved Reports */}
      <h2 style={styles.sectionTitle}>Saved Reports</h2>
      {savedReports.length === 0 ? (
        <div style={{ ...styles.card, ...styles.emptyState }}>
          <svg style={styles.emptyStateIcon} width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <p style={styles.emptyStateText}>No saved reports yet</p>
        </div>
      ) : (
        <div style={styles.grid3}>
          {savedReports.map((report) => (
            <div key={report.id} style={styles.card}>
              <div style={{ ...styles.flexBetween, marginBottom: '0.5rem' }}>
                <h3 style={{ fontWeight: 600 }}>{report.report_name}</h3>
                {report.is_scheduled && <span style={styles.badge('info')}>Scheduled</span>}
              </div>
              <p style={{ fontSize: '0.875rem', color: styles.colors.textSecondary, marginBottom: '0.75rem' }}>{report.description}</p>
              <div style={{ ...styles.flexBetween, fontSize: '0.75rem', color: styles.colors.textMuted }}>
                <span style={{ textTransform: 'capitalize' }}>{report.report_type.replace('_', ' ')}</span>
                <span>{new Date(report.created_at).toLocaleDateString()}</span>
              </div>
              <button style={{ ...styles.buttonSecondary, width: '100%', justifyContent: 'center', marginTop: '1rem' }}>Run Report</button>
            </div>
          ))}
        </div>
      )}

      {/* Report Results */}
      {reportData && (
        <>
          <h2 style={styles.sectionTitle}>Report Results</h2>
          {reportType === 'tax_summary' && Array.isArray(reportData) && (
            <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
              <table style={styles.table}>
                <thead><tr style={styles.tableHeader}>
                  <th style={styles.tableHeaderCell}>Tax Type</th>
                  <th style={styles.tableHeaderCell}>Tax Name</th>
                  <th style={styles.tableHeaderCell}>Payruns</th>
                  <th style={styles.tableHeaderCell}>Employee Tax</th>
                  <th style={styles.tableHeaderCell}>Employer Tax</th>
                  <th style={styles.tableHeaderCell}>Total Tax</th>
                </tr></thead>
                <tbody>
                  {reportData.map((row: TaxSummary, idx: number) => (
                    <tr key={idx} style={{ ...styles.tableRow, borderBottom: idx === reportData.length - 1 ? 'none' : undefined }}>
                      <td style={styles.tableCell}><span style={styles.badge('info')}>{row.tax_type}</span></td>
                      <td style={{ ...styles.tableCell, fontWeight: 500 }}>{row.tax_name}</td>
                      <td style={styles.tableCell}>{row.payrun_count}</td>
                      <td style={styles.tableCell}>{formatCurrency(row.total_employee_tax)}</td>
                      <td style={styles.tableCell}>{formatCurrency(row.total_employer_tax)}</td>
                      <td style={{ ...styles.tableCell, fontWeight: 600 }}>{formatCurrency(row.total_tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reportType === 'turnover' && !Array.isArray(reportData) && (
            <div style={styles.grid3}>
              {[
                { label: 'Turnover Rate', value: `${reportData.turnover_rate}%`, sub: `Last ${reportData.period_months} months`, color: styles.colors.info },
                { label: 'New Hires', value: reportData.hired_count, color: styles.colors.success },
                { label: 'Terminations', value: reportData.terminated_count, color: styles.colors.danger },
                { label: 'Current Active', value: reportData.current_active, color: styles.colors.gradientAdmin },
                { label: 'Avg Tenure', value: `${reportData.avg_tenure_months.toFixed(1)} mo`, color: styles.colors.warning },
              ].map((stat, i) => (
                <div key={i} style={{ ...styles.card, borderTop: `4px solid ${stat.color}` }}>
                  <p style={{ fontSize: '0.75rem', color: styles.colors.textMuted }}>{stat.label}</p>
                  <p style={{ fontSize: '2rem', fontWeight: 700, color: styles.colors.textPrimary }}>{stat.value}</p>
                  {stat.sub && <p style={{ fontSize: '0.7rem', color: styles.colors.textMuted }}>{stat.sub}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ ...styles.card, maxWidth: '400px', width: '90%' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.25rem' }}>Save Report Configuration</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><label style={styles.formLabel}>Report Name</label><input type="text" value={newReportName} onChange={(e) => setNewReportName(e.target.value)} style={styles.formInput} placeholder="Monthly Tax Summary" /></div>
              <div><label style={styles.formLabel}>Description</label><textarea value={newReportDescription} onChange={(e) => setNewReportDescription(e.target.value)} style={{ ...styles.formInput, resize: 'vertical' }} rows={3} placeholder="Detailed tax breakdown..." /></div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={saveReport} style={{ ...styles.buttonPrimary, flex: 1, justifyContent: 'center' }}>Save Report</button>
              <button onClick={() => setShowSaveModal(false)} style={{ ...styles.buttonSecondary, flex: 1, justifyContent: 'center' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
