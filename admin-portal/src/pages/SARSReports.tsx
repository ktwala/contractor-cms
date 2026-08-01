import { useState, useEffect } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';

interface TaxPeriod {
  id: string;
  period_type: string;
  tax_year: string;
  period_start: string;
  period_end: string;
  month_number?: number;
  submission_due_date: string;
  is_submitted: boolean;
}

interface IRP5Certificate {
  id: string;
  employee_number: string;
  first_names: string;
  surname: string;
  total_remuneration: number;
  taxable_income: number;
  total_tax: number;
  status: string;
  certificate_number: string;
}

interface EMP201Return {
  id: string;
  tax_year: string;
  month_number: number;
  period_start: string;
  period_end: string;
  total_employees: number;
  paye_total: number;
  uif_total: number;
  sdl_total: number;
  total_liability: number;
  status: string;
  submission_due_date: string;
}

export default function SARSReports() {
  const [activeTab, setActiveTab] = useState<'irp5' | 'emp201'>('irp5');
  const [taxPeriods, setTaxPeriods] = useState<TaxPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [irp5Certificates, setIrp5Certificates] = useState<IRP5Certificate[]>([]);
  const [emp201Returns, setEMP201Returns] = useState<EMP201Return[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadTaxPeriods(); }, []);
  useEffect(() => { if (selectedPeriod) activeTab === 'irp5' ? loadIRP5() : loadEMP201(); }, [selectedPeriod, activeTab]);

  const loadTaxPeriods = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sars/tax-periods');
      setTaxPeriods(res.data);
      const annual = res.data.find((p: TaxPeriod) => p.period_type === 'annual' && p.tax_year === new Date().getFullYear().toString());
      if (annual) setSelectedPeriod(annual.id);
    } catch {
      setTaxPeriods([
        { id: '1', period_type: 'annual', tax_year: '2025', period_start: '2025-03-01', period_end: '2026-02-28', submission_due_date: '2026-05-31', is_submitted: false },
        { id: '2', period_type: 'monthly', tax_year: '2026', month_number: 1, period_start: '2026-01-01', period_end: '2026-01-31', submission_due_date: '2026-02-07', is_submitted: false },
      ]);
      setSelectedPeriod('1');
    } finally { setLoading(false); }
  };

  const loadIRP5 = async () => {
    if (!selectedPeriod) return;
    setLoading(true);
    try { setIrp5Certificates((await api.get(`/sars/irp5/${selectedPeriod}`)).data); } catch {
      setIrp5Certificates([
        { id: '1', employee_number: 'EMP001', first_names: 'Sarah', surname: 'Johnson', total_remuneration: 850000, taxable_income: 720000, total_tax: 215000, status: 'generated', certificate_number: 'IRP5-2025-00001' },
        { id: '2', employee_number: 'EMP002', first_names: 'Michael', surname: 'Chen', total_remuneration: 720000, taxable_income: 610000, total_tax: 175000, status: 'generated', certificate_number: 'IRP5-2025-00002' },
        { id: '3', employee_number: 'EMP003', first_names: 'Emily', surname: 'Davis', total_remuneration: 540000, taxable_income: 460000, total_tax: 118000, status: 'draft', certificate_number: 'IRP5-2025-00003' },
      ]);
    } finally { setLoading(false); }
  };

  const loadEMP201 = async () => {
    setLoading(true);
    try { setEMP201Returns((await api.get('/sars/emp201')).data); } catch {
      setEMP201Returns([
        { id: '1', tax_year: '2026', month_number: 1, period_start: '2026-01-01', period_end: '2026-01-31', total_employees: 450, paye_total: 2150000, uif_total: 125000, sdl_total: 185000, total_liability: 2460000, status: 'ready', submission_due_date: '2026-02-07' },
        { id: '2', tax_year: '2025', month_number: 12, period_start: '2025-12-01', period_end: '2025-12-31', total_employees: 445, paye_total: 2100000, uif_total: 122000, sdl_total: 180000, total_liability: 2402000, status: 'submitted', submission_due_date: '2026-01-07' },
      ]);
    } finally { setLoading(false); }
  };

  const handleGenerateIRP5 = async () => {
    if (!confirm('Generate IRP5 certificates for all employees?')) return;
    setGenerating(true);
    try { await api.post(`/sars/irp5/generate/${selectedPeriod}`); alert('Generated!'); await loadIRP5(); } catch { alert('Failed'); } finally { setGenerating(false); }
  };

  const handleGenerateEMP201 = async () => {
    if (!confirm('Generate EMP201 return?')) return;
    setGenerating(true);
    try { await api.post(`/sars/emp201/generate/${selectedPeriod}`); alert('Generated!'); await loadEMP201(); } catch { alert('Failed'); } finally { setGenerating(false); }
  };

  const handleSubmitEMP201 = async (returnId: string) => {
    const reference = prompt('Enter SARS reference number:');
    if (!reference) return;
    try { await api.post(`/sars/emp201/${returnId}/submit`, { sars_reference: reference }); alert('Submitted!'); await loadEMP201(); } catch { alert('Failed'); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount || 0);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  const statusBadge = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => ({ submitted: 'success', issued: 'success', generated: 'info', ready: 'warning', overdue: 'danger', draft: 'default' }[status] || 'default') as any;

  const selectedPeriodData = taxPeriods.find(p => p.id === selectedPeriod);
  const tabStyle = (active: boolean) => ({ padding: '1rem 1.5rem', border: 'none', background: 'none', borderBottom: `3px solid ${active ? styles.colors.primary : 'transparent'}`, color: active ? styles.colors.primary : styles.colors.textSecondary, fontWeight: active ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s' });

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>SARS Tax Forms</h1>
        <p style={styles.pageSubtitle}>Generate and manage IRP5 certificates and EMP201 returns</p>
      </div>

      {/* Period Selector */}
      <div style={styles.card}>
        <label style={styles.formLabel}>Select Tax Period</label>
        <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} style={{ ...styles.formSelect, maxWidth: '400px' }}>
          <option value="">-- Select Period --</option>
          <optgroup label="Annual Periods (IRP5)">
            {taxPeriods.filter(p => p.period_type === 'annual').map(p => (
              <option key={p.id} value={p.id}>Tax Year {p.tax_year} ({formatDate(p.period_start)} - {formatDate(p.period_end)})</option>
            ))}
          </optgroup>
          <optgroup label="Monthly Periods (EMP201)">
            {taxPeriods.filter(p => p.period_type === 'monthly').map(p => (
              <option key={p.id} value={p.id}>{p.tax_year} Month {p.month_number} ({formatDate(p.period_start)} - {formatDate(p.period_end)})</option>
            ))}
          </optgroup>
        </select>
        {selectedPeriodData && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#eff6ff', borderRadius: '8px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div><span style={{ fontWeight: 500, color: '#1e40af', fontSize: '0.8rem' }}>Period Type:</span> <span style={{ textTransform: 'capitalize' }}>{selectedPeriodData.period_type}</span></div>
            <div><span style={{ fontWeight: 500, color: '#1e40af', fontSize: '0.8rem' }}>Due Date:</span> {formatDate(selectedPeriodData.submission_due_date)}</div>
            <div><span style={{ fontWeight: 500, color: '#1e40af', fontSize: '0.8rem' }}>Status:</span> <span style={styles.badge(selectedPeriodData.is_submitted ? 'success' : 'warning')}>{selectedPeriodData.is_submitted ? 'Submitted' : 'Pending'}</span></div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ borderBottom: `1px solid ${styles.colors.borderLight}`, display: 'flex' }}>
          <button onClick={() => setActiveTab('irp5')} style={tabStyle(activeTab === 'irp5')}>IRP5 Certificates (Annual)</button>
          <button onClick={() => setActiveTab('emp201')} style={tabStyle(activeTab === 'emp201')}>EMP201 Returns (Monthly)</button>
        </div>

        {/* IRP5 Tab */}
        {activeTab === 'irp5' && (
          <div style={{ padding: '1.5rem' }}>
            <div style={{ ...styles.flexBetween, marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>IRP5 Certificates</h2>
              <button onClick={handleGenerateIRP5} disabled={!selectedPeriod || generating} style={{ ...styles.buttonPrimary, opacity: !selectedPeriod || generating ? 0.5 : 1 }}>{generating ? 'Generating...' : 'Generate All IRP5s'}</button>
            </div>

            {loading ? (
              <div style={styles.loadingContainer}><div style={styles.loadingSpinner}></div><p style={{ color: styles.colors.textSecondary }}>Loading...</p><style>{styles.spinKeyframes}</style></div>
            ) : irp5Certificates.length === 0 ? (
              <div style={styles.emptyState}><p style={styles.emptyStateText}>No IRP5 certificates found. Click "Generate All IRP5s" to create.</p></div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead><tr style={styles.tableHeader}>
                      <th style={styles.tableHeaderCell}>Employee</th>
                      <th style={styles.tableHeaderCell}>Certificate No</th>
                      <th style={styles.tableHeaderCell}>Remuneration</th>
                      <th style={styles.tableHeaderCell}>Taxable Income</th>
                      <th style={styles.tableHeaderCell}>Total Tax</th>
                      <th style={styles.tableHeaderCell}>Status</th>
                      <th style={styles.tableHeaderCell}>Actions</th>
                    </tr></thead>
                    <tbody>
                      {irp5Certificates.map((cert, idx) => (
                        <tr key={cert.id} style={{ ...styles.tableRow, borderBottom: idx === irp5Certificates.length - 1 ? 'none' : undefined }}>
                          <td style={styles.tableCell}><p style={{ fontWeight: 600 }}>{cert.surname}, {cert.first_names}</p><p style={{ fontSize: '0.75rem', color: styles.colors.textMuted }}>{cert.employee_number}</p></td>
                          <td style={{ ...styles.tableCell, fontFamily: 'monospace', fontSize: '0.8rem' }}>{cert.certificate_number}</td>
                          <td style={styles.tableCell}>{formatCurrency(cert.total_remuneration)}</td>
                          <td style={styles.tableCell}>{formatCurrency(cert.taxable_income)}</td>
                          <td style={{ ...styles.tableCell, fontWeight: 600 }}>{formatCurrency(cert.total_tax)}</td>
                          <td style={styles.tableCell}><span style={styles.badge(statusBadge(cert.status))}>{cert.status}</span></td>
                          <td style={styles.tableCell}><button style={{ ...styles.buttonSecondary, padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>View PDF</button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr style={{ background: styles.colors.background }}>
                      <td colSpan={2} style={{ ...styles.tableCell, fontWeight: 700 }}>Total ({irp5Certificates.length} employees)</td>
                      <td style={{ ...styles.tableCell, fontWeight: 700 }}>{formatCurrency(irp5Certificates.reduce((s, c) => s + c.total_remuneration, 0))}</td>
                      <td style={{ ...styles.tableCell, fontWeight: 700 }}>{formatCurrency(irp5Certificates.reduce((s, c) => s + c.taxable_income, 0))}</td>
                      <td style={{ ...styles.tableCell, fontWeight: 700 }}>{formatCurrency(irp5Certificates.reduce((s, c) => s + c.total_tax, 0))}</td>
                      <td colSpan={2}></td>
                    </tr></tfoot>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button style={{ ...styles.buttonPrimary, background: styles.colors.success }}>Export All to CSV</button>
                  <button style={{ ...styles.buttonPrimary, background: '#7c3aed' }}>Download All PDFs (ZIP)</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* EMP201 Tab */}
        {activeTab === 'emp201' && (
          <div style={{ padding: '1.5rem' }}>
            <div style={{ ...styles.flexBetween, marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>EMP201 Monthly Returns</h2>
              <button onClick={handleGenerateEMP201} disabled={!selectedPeriod || generating} style={{ ...styles.buttonPrimary, opacity: !selectedPeriod || generating ? 0.5 : 1 }}>{generating ? 'Generating...' : 'Generate EMP201'}</button>
            </div>

            {loading ? (
              <div style={styles.loadingContainer}><div style={styles.loadingSpinner}></div><p style={{ color: styles.colors.textSecondary }}>Loading...</p><style>{styles.spinKeyframes}</style></div>
            ) : emp201Returns.length === 0 ? (
              <div style={styles.emptyState}><p style={styles.emptyStateText}>No EMP201 returns found. Select a monthly period and click "Generate EMP201".</p></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead><tr style={styles.tableHeader}>
                    <th style={styles.tableHeaderCell}>Period</th>
                    <th style={styles.tableHeaderCell}>Employees</th>
                    <th style={styles.tableHeaderCell}>PAYE</th>
                    <th style={styles.tableHeaderCell}>UIF</th>
                    <th style={styles.tableHeaderCell}>SDL</th>
                    <th style={styles.tableHeaderCell}>Total Liability</th>
                    <th style={styles.tableHeaderCell}>Due Date</th>
                    <th style={styles.tableHeaderCell}>Status</th>
                    <th style={styles.tableHeaderCell}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {emp201Returns.map((ret, idx) => (
                      <tr key={ret.id} style={{ ...styles.tableRow, borderBottom: idx === emp201Returns.length - 1 ? 'none' : undefined }}>
                        <td style={styles.tableCell}><p style={{ fontWeight: 600 }}>{ret.tax_year} M{ret.month_number}</p><p style={{ fontSize: '0.75rem', color: styles.colors.textMuted }}>{formatDate(ret.period_start)} - {formatDate(ret.period_end)}</p></td>
                        <td style={styles.tableCell}>{ret.total_employees}</td>
                        <td style={styles.tableCell}>{formatCurrency(ret.paye_total)}</td>
                        <td style={styles.tableCell}>{formatCurrency(ret.uif_total)}</td>
                        <td style={styles.tableCell}>{formatCurrency(ret.sdl_total)}</td>
                        <td style={{ ...styles.tableCell, fontWeight: 700 }}>{formatCurrency(ret.total_liability)}</td>
                        <td style={{ ...styles.tableCell, color: styles.colors.textMuted }}>{formatDate(ret.submission_due_date)}</td>
                        <td style={styles.tableCell}><span style={styles.badge(statusBadge(ret.status))}>{ret.status}</span></td>
                        <td style={styles.tableCell}>
                          {ret.status !== 'submitted' ? <button onClick={() => handleSubmitEMP201(ret.id)} style={{ ...styles.buttonPrimary, padding: '0.375rem 0.75rem', fontSize: '0.75rem', background: styles.colors.success }}>Mark Submitted</button> : <button style={{ ...styles.buttonSecondary, padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>Export CSV</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
