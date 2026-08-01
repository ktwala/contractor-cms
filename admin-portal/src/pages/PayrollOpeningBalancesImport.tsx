import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner } from '../ui/layout';

type FlowStep = 'console' | 'server_validate' | 'preview' | 'execute' | 'results';

interface ValidationIssue {
  sheet: string;
  rowNumber: number;
  code: string;
  severity: string;
  message: string;
  fieldName?: string;
  currentValue?: string;
  suggestedFix?: string;
  referenceSource?: string;
  allowedValuesHint?: string[];
}

interface FinancialControl {
  countryCode: string;
  taxYear: number;
  asOfDate: string | null;
  employeeCount: number;
  ytdGross: number;
  ytdTaxable: number;
  ytdPaye: number;
  ytdNet: number;
  alerts: Array<{ code: string; severity: string; message: string }>;
}

interface PrecheckResponse {
  ready: boolean;
  summary: { errors: number; warnings: number; totalRows: number; sheetsDetected: number };
  financialControl: FinancialControl;
  issues: ValidationIssue[];
}

const STEPPER: { key: FlowStep | 'done'; label: string; description: string }[] = [
  { key: 'console', label: '1. Context & precheck', description: 'Template, context, file, precheck, financial review' },
  { key: 'server_validate', label: '2. Server upload', description: 'Create import job after precheck passes' },
  { key: 'preview', label: '3. Preview & sign-off', description: 'Totals, alerts, confirm before publish' },
  { key: 'execute', label: '4. Publish', description: 'Write opening balances' },
  { key: 'done', label: '5. Results', description: 'Outcome' },
];

const SHEET_HELP = [
  { key: 'payrollopeningbalances', label: 'payrollopeningbalances (required)' },
  { key: 'leavebalances', label: 'leavebalances (optional)' },
  { key: 'loanbalances', label: 'loanbalances (optional)' },
];

function fileIdentity(f: File): string {
  return `${f.name}:${f.size}:${f.lastModified}`;
}

function contextKey(countryCode: string, taxYear: number, asOfDate: string): string {
  return `${countryCode}|${taxYear}|${asOfDate || ''}`;
}

function currencyForCountry(code: string): string {
  return code.toUpperCase() === 'LS' ? 'LSL' : 'ZAR';
}

function fmtCurrency(n: number, countryCode: string) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currencyForCountry(countryCode),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const fmtNum = (n: number) => new Intl.NumberFormat().format(n);

function FinancialControlPanel({
  fc,
  title,
}: {
  fc: FinancialControl;
  title: string;
}) {
  return (
    <div style={{ border: `1px solid ${styles.colors.border}`, borderRadius: 10, padding: 16, background: '#fafafa' }}>
      <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 12, color: styles.colors.textMuted, marginBottom: 12 }}>
        Tax year {fc.taxYear} · {fc.countryCode}
        {fc.asOfDate ? ` · As-of ${fc.asOfDate}` : ''} · {fmtNum(fc.employeeCount)} employees (opening balance rows)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {[
          { label: 'Total YTD gross', value: fc.ytdGross, tone: '#0f172a' },
          { label: 'Total YTD taxable', value: fc.ytdTaxable, tone: '#334155' },
          { label: 'Total YTD PAYE', value: fc.ytdPaye, tone: '#b91c1c' },
          { label: 'Total YTD net', value: fc.ytdNet, tone: '#1d4ed8' },
        ].map((cell) => (
          <div key={cell.label} style={{ padding: 12, background: '#fff', borderRadius: 8, border: `1px solid ${styles.colors.border}` }}>
            <div style={{ fontSize: 11, color: styles.colors.textMuted, marginBottom: 4 }}>{cell.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: cell.tone }}>{fmtCurrency(cell.value, fc.countryCode)}</div>
          </div>
        ))}
      </div>
      {fc.alerts.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Cross-row checks</div>
          {fc.alerts.map((a) => (
            <Banner key={a.code} variant="warn" style={{ marginTop: 8 }}>
              <strong>{a.code}:</strong> {a.message}
            </Banner>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PayrollOpeningBalancesImport() {
  const navigate = useNavigate();

  const [flowStep, setFlowStep] = useState<FlowStep>('console');
  const [countryCode, setCountryCode] = useState('ZA');
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [asOfDate, setAsOfDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [precheckResult, setPrecheckResult] = useState<PrecheckResponse | null>(null);
  const [precheckPassFileKey, setPrecheckPassFileKey] = useState<string | null>(null);
  const [precheckPassContextKey, setPrecheckPassContextKey] = useState<string | null>(null);
  const [importGateSatisfied, setImportGateSatisfied] = useState(false);
  const [totalsReviewed, setTotalsReviewed] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [validationSummary, setValidationSummary] = useState<Record<string, number> | null>(null);
  const [structureErrors, setStructureErrors] = useState<ValidationIssue[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [executionResult, setExecutionResult] = useState<Record<string, unknown> | null>(null);

  const ctxKey = useMemo(() => contextKey(countryCode, taxYear, asOfDate), [countryCode, taxYear, asOfDate]);

  const currentFileKey = file ? fileIdentity(file) : null;
  const precheckAligned =
    Boolean(currentFileKey && precheckPassFileKey && currentFileKey === precheckPassFileKey) &&
    Boolean(precheckPassContextKey && precheckPassContextKey === ctxKey);

  const canUploadToServer = Boolean(file && precheckResult?.ready && precheckAligned);

  const sortedIssues = useMemo(() => {
    const issues = precheckResult?.issues ?? [];
    return [...issues].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'ERROR' ? -1 : 1;
      if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet);
      return a.rowNumber - b.rowNumber;
    });
  }, [precheckResult]);

  const clearPrecheck = useCallback(() => {
    setPrecheckResult(null);
    setPrecheckPassFileKey(null);
    setPrecheckPassContextKey(null);
    setImportGateSatisfied(false);
    setTotalsReviewed(false);
  }, []);

  const resetFlow = useCallback(() => {
    setFlowStep('console');
    setFile(null);
    setError(null);
    clearPrecheck();
    setJobId(null);
    setValidationSummary(null);
    setStructureErrors([]);
    setPreview(null);
    setExecutionResult(null);
  }, [clearPrecheck]);

  const onSelectFile = useCallback(
    (next: File | null) => {
      setFile(next);
      setError(null);
      clearPrecheck();
      setJobId(null);
      setValidationSummary(null);
      setStructureErrors([]);
      setPreview(null);
      setExecutionResult(null);
      setFlowStep('console');
    },
    [clearPrecheck],
  );

  const onContextChange = useCallback(() => {
    clearPrecheck();
    setJobId(null);
    setValidationSummary(null);
    setStructureErrors([]);
    setPreview(null);
    setExecutionResult(null);
    setFlowStep('console');
  }, [clearPrecheck]);

  const downloadTenantTemplate = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get('/payroll/templates/opening-balances.xlsx', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'opening_balances_import_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to download template');
    }
  }, []);

  const appendContext = useCallback(
    (fd: FormData) => {
      fd.append('countryCode', countryCode);
      fd.append('taxYear', String(taxYear));
      if (asOfDate) fd.append('asOfDate', asOfDate);
    },
    [countryCode, taxYear, asOfDate],
  );

  const runPrecheck = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    clearPrecheck();
    try {
      const formData = new FormData();
      formData.append('file', file);
      appendContext(formData);
      const res = await api.post<PrecheckResponse>('/data-imports/payroll-opening-balances/precheck', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPrecheckResult(res.data);
      if (res.data.ready) {
        setPrecheckPassFileKey(fileIdentity(file));
        setPrecheckPassContextKey(ctxKey);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Precheck failed');
    } finally {
      setLoading(false);
    }
  }, [file, appendContext, clearPrecheck, ctxKey]);

  const downloadPrecheckWorkbook = useCallback(
    async (format: 'csv' | 'xlsx') => {
      if (!file) return;
      setError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        appendContext(formData);
        const res = await api.post(`/data-imports/payroll-opening-balances/precheck/export-errors?format=${format}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `opening-balances-precheck-validation.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch {
        setError('Failed to download validation workbook');
      }
    },
    [file, appendContext],
  );

  const handleUploadToServer = useCallback(async () => {
    if (!file || !precheckResult?.ready || !precheckAligned) {
      setError('Run precheck successfully for this file and context before uploading.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      appendContext(formData);
      const res = await api.post('/data-imports/payroll-opening-balances/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportGateSatisfied(true);
      setTotalsReviewed(false);
      setJobId(res.data.importJobId);
      setValidationSummary(res.data.summary);
      setStructureErrors(res.data.structureErrors ?? []);
      if (res.data.status === 'VALIDATED') {
        setFlowStep('preview');
        const jid = res.data.importJobId as string;
        const pv = await api.get(`/data-imports/payroll-opening-balances/${jid}/preview`);
        setPreview(pv.data);
      } else {
        setFlowStep('server_validate');
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Upload failed');
      setImportGateSatisfied(false);
    } finally {
      setLoading(false);
    }
  }, [file, precheckResult, precheckAligned, appendContext]);

  const loadPreview = useCallback(async (id?: string) => {
    const jid = id ?? jobId;
    if (!jid) return;
    setLoading(true);
    try {
      const res = await api.get(`/data-imports/payroll-opening-balances/${jid}/preview`);
      setPreview(res.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const handleExecute = useCallback(async () => {
    if (!jobId || !importGateSatisfied || !totalsReviewed) return;
    setLoading(true);
    setError(null);
    setFlowStep('execute');
    try {
      const res = await api.post(`/data-imports/payroll-opening-balances/${jobId}/execute`, { confirm: true });
      setExecutionResult(res.data);
      setFlowStep('results');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Import execution failed');
      setFlowStep('preview');
    } finally {
      setLoading(false);
    }
  }, [jobId, importGateSatisfied, totalsReviewed]);

  const downloadJobErrors = useCallback(
    async (format: 'csv' | 'xlsx') => {
      if (!jobId) return;
      try {
        const res = await api.get(`/data-imports/payroll-opening-balances/${jobId}/export-errors?format=${format}`, {
          responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `validation-errors-${jobId}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch {
        setError('Failed to download error report');
      }
    },
    [jobId],
  );

  const sectionLabel = (key: string) => {
    const labels: Record<string, string> = {
      payrollOpeningBalances: 'Payroll opening balances',
      leaveBalances: 'Leave balances',
      loanBalances: 'Loan balances',
    };
    return labels[key] ?? key;
  };

  const stepperIndex = (() => {
    if (flowStep === 'console') return 0;
    if (flowStep === 'server_validate') return 1;
    if (flowStep === 'preview') return 2;
    if (flowStep === 'execute') return 3;
    return 4;
  })();

  const previewFc = preview?.financialControl as FinancialControl | undefined;
  const previewCountry = previewFc?.countryCode ?? countryCode;

  return (
    <Page
      title="Payroll opening balances import"
      subtitle="Guided console with financial control: tenant template → context → precheck → YTD rollups & cross-row checks → error workbook → server upload → preview sign-off → publish."
      actions={
        <button type="button" style={styles.buttonSecondary} onClick={() => navigate('/enterprise/data-imports')}>
          Back to Data Imports
        </button>
      }
    >
      {error && <Banner variant="error">{error}</Banner>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {STEPPER.map((s, i) => (
          <div
            key={s.key}
            style={{
              flex: '1 1 160px',
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: stepperIndex === i ? styles.colors.primary : '#f1f5f9',
              color: stepperIndex === i ? '#fff' : styles.colors.textMuted,
            }}
          >
            <div>{s.label}</div>
            <div style={{ fontWeight: 400, fontSize: 11, marginTop: 4, opacity: stepperIndex === i ? 0.95 : 1 }}>{s.description}</div>
          </div>
        ))}
      </div>

      {flowStep === 'console' && (
        <Card>
          <CardHeader title="Import console" />
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Banner variant="info">
              Employees must exist in Workforce. Changing country, tax year, as-of date, or the workbook clears precheck
              so you always validate against the same context you will upload.
            </Banner>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Import context</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Country</label>
                  <select
                    value={countryCode}
                    onChange={(e) => {
                      setCountryCode(e.target.value);
                      onContextChange();
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 14 }}
                  >
                    <option value="ZA">South Africa (ZA)</option>
                    <option value="LS">Lesotho (LS)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Tax year</label>
                  <select
                    value={taxYear}
                    onChange={(e) => {
                      setTaxYear(Number(e.target.value));
                      onContextChange();
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 14 }}
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>As-of date (optional)</label>
                  <input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => {
                      setAsOfDate(e.target.value);
                      onContextChange();
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${styles.colors.border}`, fontSize: 14 }}
                  />
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Download tenant template</div>
              <button type="button" style={styles.buttonSecondary} onClick={downloadTenantTemplate}>
                Download opening balances template (.xlsx)
              </button>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Sheets (lowercase tab names)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SHEET_HELP.map((s) => (
                  <span key={s.key} style={{ padding: '4px 10px', background: '#f1f5f9', borderRadius: 6, fontSize: 12 }}>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Workbook</div>
              <div
                style={{
                  border: `2px dashed ${styles.colors.border}`,
                  borderRadius: 12,
                  padding: 28,
                  textAlign: 'center',
                  background: file ? '#f0fdf4' : '#fafafa',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('ob-file-input')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f?.name?.toLowerCase().endsWith('.xlsx')) onSelectFile(f);
                  else setError('Only .xlsx files are supported');
                }}
              >
                <input
                  id="ob-file-input"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onSelectFile(f);
                  }}
                />
                {file ? (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#16a34a' }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: styles.colors.textMuted, marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: styles.colors.textMuted }}>Drop .xlsx here or click to browse</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button type="button" style={styles.buttonSecondary} disabled={!file || loading} onClick={runPrecheck}>
                {loading ? 'Running…' : 'Run precheck'}
              </button>
              {precheckResult && (
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: precheckResult.ready ? '#dcfce7' : '#fee2e2',
                    color: precheckResult.ready ? '#166534' : '#991b1b',
                  }}
                >
                  {precheckResult.ready ? 'Ready for server upload' : 'Not ready — fix errors'}
                </span>
              )}
            </div>

            {precheckResult?.financialControl && (
              <FinancialControlPanel fc={precheckResult.financialControl} title="Financial control (precheck file totals)" />
            )}

            {precheckResult && sortedIssues.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Validation issues</div>
                <div style={{ overflowX: 'auto', border: `1px solid ${styles.colors.border}`, borderRadius: 8 }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: `2px solid ${styles.colors.border}` }}>
                        {['Severity', 'Sheet', 'Row', 'Field', 'Code', 'Message', 'Suggested fix', 'Value'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: 8 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedIssues.map((issue, i) => (
                        <tr key={`${issue.code}-${issue.sheet}-${issue.rowNumber}-${i}`} style={{ borderBottom: `1px solid ${styles.colors.border}` }}>
                          <td style={{ padding: 8, fontWeight: 600, color: issue.severity === 'ERROR' ? '#b91c1c' : '#a16207' }}>{issue.severity}</td>
                          <td style={{ padding: 8 }}>{issue.sheet}</td>
                          <td style={{ padding: 8 }}>{issue.rowNumber}</td>
                          <td style={{ padding: 8 }}>{issue.fieldName ?? '—'}</td>
                          <td style={{ padding: 8, fontFamily: 'monospace' }}>{issue.code}</td>
                          <td style={{ padding: 8, maxWidth: 280 }}>{issue.message}</td>
                          <td style={{ padding: 8, maxWidth: 200 }}>{issue.suggestedFix ?? '—'}</td>
                          <td style={{ padding: 8 }}>{issue.currentValue ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {precheckResult && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Customer-ready error workbook</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={styles.buttonSecondary} onClick={() => downloadPrecheckWorkbook('xlsx')}>
                    Download workbook (.xlsx)
                  </button>
                  <button type="button" style={styles.buttonSecondary} onClick={() => downloadPrecheckWorkbook('csv')}>
                    Download CSV
                  </button>
                </div>
              </div>
            )}

            <div style={{ borderTop: `1px solid ${styles.colors.border}`, paddingTop: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Upload & validate on server</div>
              {!canUploadToServer && (
                <p style={{ margin: '0 0 10px', fontSize: 13, color: styles.colors.textMuted }}>
                  Disabled until precheck returns <strong>ready = true</strong> for this file and the same country / tax year /
                  as-of context.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={styles.buttonPrimary} disabled={!canUploadToServer || loading} onClick={handleUploadToServer}>
                  {loading ? 'Uploading…' : 'Upload & validate on server'}
                </button>
                <button type="button" style={styles.buttonSecondary} onClick={resetFlow}>
                  Start over
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {flowStep === 'server_validate' && validationSummary && (
        <Card>
          <CardHeader title="Server validation" />
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Total rows', value: validationSummary.totalRows as number, color: styles.colors.textPrimary },
                { label: 'Valid', value: validationSummary.validRows as number, color: '#16a34a' },
                { label: 'Warnings', value: validationSummary.warningRows as number, color: '#d97706' },
                { label: 'Failed', value: validationSummary.failedRows as number, color: '#dc2626' },
              ].map((item) => (
                <div key={item.label} style={{ padding: 16, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: item.color }}>{fmtNum(item.value ?? 0)}</div>
                  <div style={{ fontSize: 12, color: styles.colors.textMuted }}>{item.label}</div>
                </div>
              ))}
            </div>
            {structureErrors.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8, color: '#dc2626' }}>Structure errors</div>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${styles.colors.border}` }}>
                      <th style={{ textAlign: 'left', padding: 8 }}>Sheet</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structureErrors.map((e, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${styles.colors.border}` }}>
                        <td style={{ padding: 8 }}>{e.sheet}</td>
                        <td style={{ padding: 8 }}>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" style={styles.buttonSecondary} onClick={() => setFlowStep('console')}>
                Back to console
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                {jobId && (validationSummary.failedRows as number) > 0 && (
                  <>
                    <button type="button" style={styles.buttonSecondary} onClick={() => downloadJobErrors('xlsx')}>
                      Export errors (.xlsx)
                    </button>
                    <button type="button" style={styles.buttonSecondary} onClick={() => downloadJobErrors('csv')}>
                      Export errors (CSV)
                    </button>
                  </>
                )}
                {(validationSummary.failedRows as number) === 0 && (
                  <button
                    type="button"
                    style={styles.buttonPrimary}
                    onClick={() => {
                      setFlowStep('preview');
                      loadPreview();
                    }}
                  >
                    View preview
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {flowStep === 'preview' && preview && (
        <Card>
          <CardHeader title="Preview & financial sign-off" />
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {previewFc && <FinancialControlPanel fc={previewFc} title="Financial control (validated import job)" />}

            {previewFc && (
              <div style={{ fontSize: 12, color: styles.colors.textMuted }}>
                Quick check: net {fmtCurrency(previewFc.ytdNet, previewCountry)} vs gross {fmtCurrency(previewFc.ytdGross, previewCountry)}{' '}
                · taxable {fmtCurrency(previewFc.ytdTaxable, previewCountry)} · PAYE {fmtCurrency(previewFc.ytdPaye, previewCountry)}
              </div>
            )}

            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${styles.colors.border}`, background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: 10 }}>Section</th>
                  <th style={{ textAlign: 'right', padding: 10 }}>Rows</th>
                  <th style={{ textAlign: 'right', padding: 10 }}>Insert</th>
                  <th style={{ textAlign: 'right', padding: 10 }}>Update</th>
                  <th style={{ textAlign: 'right', padding: 10 }}>Skip</th>
                  <th style={{ textAlign: 'right', padding: 10 }}>Failed</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(preview.sections as Record<string, { rows: number; toInsert: number; toUpdate: number; toSkip: number; failed: number } | undefined>)
                  .filter(([, s]) => s)
                  .map(([key, sec]) => (
                    <tr key={key} style={{ borderBottom: `1px solid ${styles.colors.border}` }}>
                      <td style={{ padding: 10, fontWeight: 500 }}>{sectionLabel(key)}</td>
                      <td style={{ padding: 10, textAlign: 'right' }}>{fmtNum(sec!.rows)}</td>
                      <td style={{ padding: 10, textAlign: 'right', color: '#16a34a' }}>{fmtNum(sec!.toInsert)}</td>
                      <td style={{ padding: 10, textAlign: 'right', color: '#2563eb' }}>{fmtNum(sec!.toUpdate)}</td>
                      <td style={{ padding: 10, textAlign: 'right', color: styles.colors.textMuted }}>{fmtNum(sec!.toSkip)}</td>
                      <td style={{ padding: 10, textAlign: 'right', color: sec!.failed > 0 ? '#dc2626' : styles.colors.textMuted }}>{fmtNum(sec!.failed)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {(preview.warnings as ValidationIssue[])?.length > 0 && (
              <Banner variant="warn">{(preview.warnings as ValidationIssue[]).length} warning(s) on the job — review before publishing.</Banner>
            )}

            {!importGateSatisfied && (
              <Banner variant="error">Publish unavailable: complete precheck and upload from the console for this import.</Banner>
            )}

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={totalsReviewed} onChange={(e) => setTotalsReviewed(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                I have reviewed the YTD totals, employee count, tax year, and cross-row warnings above. I understand that publishing will
                write these opening balances to payroll.
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" style={styles.buttonSecondary} onClick={resetFlow}>
                Start over
              </button>
              <button
                type="button"
                style={{ ...styles.buttonPrimary, background: '#16a34a' }}
                disabled={loading || preview.status === 'FAILED' || !importGateSatisfied || !totalsReviewed}
                title={
                  !importGateSatisfied
                    ? 'Use the guided console and pass precheck before upload.'
                    : !totalsReviewed
                      ? 'Confirm you have reviewed totals and warnings.'
                      : preview.status === 'FAILED'
                        ? 'Resolve validation errors first.'
                        : undefined
                }
                onClick={handleExecute}
              >
                {loading ? 'Publishing…' : 'Publish opening balances'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {flowStep === 'execute' && (
        <Card>
          <CardHeader title="Publishing…" />
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={styles.loadingSpinner} />
            <div style={{ marginTop: 16, color: styles.colors.textMuted }}>Writing opening balances. Please wait…</div>
            <style>{styles.spinKeyframes}</style>
          </div>
        </Card>
      )}

      {flowStep === 'results' && executionResult && (
        <Card>
          <CardHeader title="Import complete" />
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Banner variant={executionResult.status === 'COMPLETED' ? 'success' : 'error'}>
              {executionResult.status === 'COMPLETED' ? 'Opening balances published successfully.' : 'Import finished with errors.'}
            </Banner>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Inserted', value: (executionResult.results as Record<string, number>).insertedRows, color: '#16a34a' },
                { label: 'Updated', value: (executionResult.results as Record<string, number>).updatedRows, color: '#2563eb' },
                { label: 'Skipped', value: (executionResult.results as Record<string, number>).skippedRows, color: styles.colors.textMuted },
                { label: 'Failed', value: (executionResult.results as Record<string, number>).failedRows, color: '#dc2626' },
              ].map((item) => (
                <div key={item.label} style={{ padding: 16, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: item.color }}>{fmtNum(item.value ?? 0)}</div>
                  <div style={{ fontSize: 12, color: styles.colors.textMuted }}>{item.label}</div>
                </div>
              ))}
            </div>

            {preview?.sections != null ? (
              <div>
                <h4 style={{ margin: '8px 0', fontSize: 14, fontWeight: 600 }}>Results by sheet</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Sheet</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rows</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Insert</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Update</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Skip</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(preview.sections as Record<string, Record<string, number>>).map(([key, sec]) => (
                      <tr key={key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{sectionLabel(key)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtNum(sec.rows)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#16a34a' }}>{fmtNum(sec.toInsert)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#2563eb' }}>{fmtNum(sec.toUpdate)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: styles.colors.textMuted }}>{fmtNum(sec.toSkip)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: sec.failed > 0 ? '#dc2626' : styles.colors.textMuted }}>
                          {fmtNum(sec.failed)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {previewFc && <FinancialControlPanel fc={previewFc} title="Financial snapshot (pre-publish totals)" />}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {jobId && (executionResult.results as Record<string, number>).failedRows > 0 && (
                <>
                  <button type="button" style={styles.buttonSecondary} onClick={() => downloadJobErrors('csv')}>
                    Export errors (CSV)
                  </button>
                  <button type="button" style={styles.buttonSecondary} onClick={() => downloadJobErrors('xlsx')}>
                    Export errors (.xlsx)
                  </button>
                </>
              )}
              {jobId && (
                <button type="button" style={styles.buttonSecondary} onClick={() => navigate(`/enterprise/data-imports/${jobId}`)}>
                  Job details
                </button>
              )}
              <button type="button" style={styles.buttonSecondary} onClick={() => navigate('/enterprise/data-imports')}>
                Import history
              </button>
              <button type="button" style={styles.buttonPrimary} onClick={resetFlow}>
                New import
              </button>
            </div>
          </div>
        </Card>
      )}
    </Page>
  );
}
