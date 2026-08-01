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

interface PrecheckResponse {
  ready: boolean;
  summary: { employeesChecked?: number; errors: number; warnings: number };
  checks: Record<string, string>;
  issues: ValidationIssue[];
}

const STEPPER: { key: FlowStep | 'done'; label: string; description: string }[] = [
  { key: 'console', label: '1. Template & precheck', description: 'Download tenant template, choose file, run precheck' },
  { key: 'server_validate', label: '2. Upload to server', description: 'Create import job (only after precheck passes)' },
  { key: 'preview', label: '3. Preview', description: 'Review row-level actions' },
  { key: 'execute', label: '4. Import', description: 'Publish to payroll' },
  { key: 'done', label: '5. Results', description: 'Outcome summary' },
];

const REQUIRED_SHEET_LABELS = [
  { key: 'compensation', label: 'compensation' },
  { key: 'bankaccounts', label: 'bankaccounts' },
  { key: 'recurringdeductions', label: 'recurringdeductions' },
  { key: 'payrolleligibility', label: 'payrolleligibility' },
];

function fileIdentity(f: File): string {
  return `${f.name}:${f.size}:${f.lastModified}`;
}

export default function PayrollSupplementalImport() {
  const navigate = useNavigate();

  const [flowStep, setFlowStep] = useState<FlowStep>('console');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [precheckResult, setPrecheckResult] = useState<PrecheckResponse | null>(null);
  /** Set only when `precheckResult.ready` for the matching `fileIdentity` */
  const [precheckPassFileKey, setPrecheckPassFileKey] = useState<string | null>(null);
  /** True after a server upload that was started from a passing precheck for the same file */
  const [importGateSatisfied, setImportGateSatisfied] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [validationSummary, setValidationSummary] = useState<Record<string, number> | null>(null);
  const [structureErrors, setStructureErrors] = useState<ValidationIssue[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [executionResult, setExecutionResult] = useState<Record<string, unknown> | null>(null);

  const currentFileKey = file ? fileIdentity(file) : null;
  const precheckAlignedWithFile = Boolean(
    currentFileKey && precheckPassFileKey && currentFileKey === precheckPassFileKey,
  );
  const canUploadToServer = Boolean(file && precheckResult && precheckResult.ready && precheckAlignedWithFile);

  const sortedIssues = useMemo(() => {
    const issues = precheckResult?.issues ?? [];
    return [...issues].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'ERROR' ? -1 : 1;
      if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet);
      return a.rowNumber - b.rowNumber;
    });
  }, [precheckResult]);

  const resetFlow = useCallback(() => {
    setFlowStep('console');
    setFile(null);
    setError(null);
    setPrecheckResult(null);
    setPrecheckPassFileKey(null);
    setImportGateSatisfied(false);
    setJobId(null);
    setValidationSummary(null);
    setStructureErrors([]);
    setPreview(null);
    setExecutionResult(null);
  }, []);

  const onSelectFile = useCallback((next: File | null) => {
    setFile(next);
    setError(null);
    setPrecheckResult(null);
    setPrecheckPassFileKey(null);
    setImportGateSatisfied(false);
    setJobId(null);
    setValidationSummary(null);
    setStructureErrors([]);
    setPreview(null);
    setExecutionResult(null);
    setFlowStep('console');
  }, []);

  const downloadTenantTemplate = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get('/payroll/templates/supplemental.xlsx', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'supplemental_import_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to download template');
    }
  }, []);

  const runPrecheck = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setPrecheckResult(null);
    setPrecheckPassFileKey(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<PrecheckResponse>('/data-imports/payroll-supplemental/precheck', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPrecheckResult(res.data);
      if (res.data.ready) {
        setPrecheckPassFileKey(fileIdentity(file));
      } else {
        setPrecheckPassFileKey(null);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Precheck failed');
    } finally {
      setLoading(false);
    }
  }, [file]);

  const downloadPrecheckErrorWorkbook = useCallback(
    async (format: 'csv' | 'xlsx') => {
      if (!file) return;
      setError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post(`/data-imports/payroll-supplemental/precheck/export-errors?format=${format}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `supplemental-precheck-validation.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch {
        setError('Failed to download validation workbook');
      }
    },
    [file],
  );

  const handleUploadToServer = useCallback(async () => {
    if (!file) return;
    if (!precheckResult?.ready || precheckPassFileKey !== fileIdentity(file)) {
      setError('Run precheck on this file and resolve blocking errors before uploading.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/data-imports/payroll-supplemental/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportGateSatisfied(true);
      setJobId(res.data.importJobId);
      setValidationSummary(res.data.summary);
      setStructureErrors(res.data.structureErrors ?? []);
      if (res.data.status === 'VALIDATED') {
        setFlowStep('preview');
        const jid = res.data.importJobId as string;
        const pv = await api.get(`/data-imports/payroll-supplemental/${jid}/preview`);
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
  }, [file, precheckResult, precheckPassFileKey]);

  const loadPreview = useCallback(async (id?: string) => {
    const jid = id ?? jobId;
    if (!jid) return;
    setLoading(true);
    try {
      const res = await api.get(`/data-imports/payroll-supplemental/${jid}/preview`);
      setPreview(res.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const handleExecute = useCallback(async () => {
    if (!jobId || !importGateSatisfied) return;
    setLoading(true);
    setError(null);
    setFlowStep('execute');
    try {
      const res = await api.post(`/data-imports/payroll-supplemental/${jobId}/execute`, { confirm: true });
      setExecutionResult(res.data);
      setFlowStep('results');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Import execution failed');
      setFlowStep('preview');
    } finally {
      setLoading(false);
    }
  }, [jobId, importGateSatisfied]);

  const downloadJobErrors = useCallback(
    async (format: 'csv' | 'xlsx') => {
      if (!jobId) return;
      try {
        const res = await api.get(`/data-imports/payroll-supplemental/${jobId}/export-errors?format=${format}`, {
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
      compensation: 'Compensation',
      bankAccounts: 'Bank Accounts',
      recurringDeductions: 'Recurring Deductions',
      payrollEligibility: 'Payroll Eligibility',
    };
    return labels[key] ?? key;
  };

  const fmtNum = (n: number) => new Intl.NumberFormat().format(n);

  const stepperIndex = (() => {
    if (flowStep === 'console') return 0;
    if (flowStep === 'server_validate') return 1;
    if (flowStep === 'preview') return 2;
    if (flowStep === 'execute') return 3;
    return 4;
  })();

  return (
    <Page
      title="Payroll supplemental import"
      subtitle="Guided import console: tenant template → local precheck → server validation → preview → publish. Server upload and final import are disabled until precheck reports ready."
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
              flex: '1 1 140px',
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

      {/* ─── Step 1: Import console (template, file, precheck, issues, workbook) ─── */}
      {flowStep === 'console' && (
        <Card>
          <CardHeader title="Import console" />
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Banner variant="info">
              Employees must already exist in Workforce. This flow enriches existing records. Use the tenant-generated
              workbook (same reference data the server validates against).
            </Banner>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>1. Download tenant template</div>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: styles.colors.textSecondary }}>
                Generated from live pay groups and pay items so column codes match your tenant.
              </p>
              <button type="button" style={styles.buttonSecondary} onClick={downloadTenantTemplate}>
                Download supplemental template (.xlsx)
              </button>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>2. Required sheets (lowercase tab names)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {REQUIRED_SHEET_LABELS.map((s) => (
                  <span key={s.key} style={{ padding: '4px 10px', background: '#f1f5f9', borderRadius: 6, fontSize: 12 }}>
                    {s.label}
                  </span>
                ))}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: styles.colors.textMuted }}>
                Extra tabs from older workbooks may still trigger warnings in precheck; only the four required sheets are imported.
              </p>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>3. Select workbook</div>
              <div
                style={{
                  border: `2px dashed ${styles.colors.border}`,
                  borderRadius: 12,
                  padding: 32,
                  textAlign: 'center',
                  background: file ? '#f0fdf4' : '#fafafa',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('supplemental-file-input')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f?.name?.toLowerCase().endsWith('.xlsx')) onSelectFile(f);
                  else setError('Only .xlsx files are supported');
                }}
              >
                <input
                  id="supplemental-file-input"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onSelectFile(f);
                    // Reset so choosing the same path again (or Playwright setInputFiles twice) still fires change.
                    e.currentTarget.value = '';
                  }}
                />
                {file ? (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#16a34a' }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: styles.colors.textMuted, marginTop: 4 }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: styles.colors.textMuted }}>Drop .xlsx here or click to browse</div>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>4. Run precheck (local validation)</div>
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
              {precheckResult && (
                <p style={{ margin: '8px 0 0', fontSize: 13, color: styles.colors.textSecondary }}>
                  {fmtNum(precheckResult.summary.errors)} error(s), {fmtNum(precheckResult.summary.warnings)} warning(s).
                  {precheckResult.summary.employeesChecked != null && (
                    <> Employees referenced: {fmtNum(precheckResult.summary.employeesChecked)}.</>
                  )}
                </p>
              )}
            </div>

            {precheckResult && sortedIssues.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>5. Review issues (grouped)</div>
                <div style={{ overflowX: 'auto', border: `1px solid ${styles.colors.border}`, borderRadius: 8 }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 720 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: `2px solid ${styles.colors.border}` }}>
                        {['Severity', 'Sheet', 'Row', 'Field', 'Code', 'Message', 'Suggested fix', 'Value', 'Reference'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: 8, whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedIssues.map((issue, i) => (
                        <tr key={`${issue.code}-${issue.sheet}-${issue.rowNumber}-${i}`} style={{ borderBottom: `1px solid ${styles.colors.border}` }}>
                          <td style={{ padding: 8, fontWeight: 600, color: issue.severity === 'ERROR' ? '#b91c1c' : '#a16207' }}>
                            {issue.severity}
                          </td>
                          <td style={{ padding: 8 }}>{issue.sheet}</td>
                          <td style={{ padding: 8 }}>{issue.rowNumber}</td>
                          <td style={{ padding: 8 }}>{issue.fieldName ?? '—'}</td>
                          <td style={{ padding: 8, fontFamily: 'monospace' }}>{issue.code}</td>
                          <td style={{ padding: 8, maxWidth: 260 }}>{issue.message}</td>
                          <td style={{ padding: 8, maxWidth: 220 }}>
                            {issue.suggestedFix ?? '—'}
                            {issue.allowedValuesHint?.length ? (
                              <div style={{ marginTop: 4, fontSize: 11, color: styles.colors.textMuted }}>
                                Allowed: {issue.allowedValuesHint.slice(0, 12).join(', ')}
                                {issue.allowedValuesHint.length > 12 ? '…' : ''}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ padding: 8 }}>{issue.currentValue ?? '—'}</td>
                          <td style={{ padding: 8, fontSize: 11, color: styles.colors.textMuted }}>{issue.referenceSource ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {precheckResult && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>6. Download customer-ready validation workbook</div>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: styles.colors.textSecondary }}>
                  Same multi-sheet layout as post-upload exports (Summary, Errors, Warnings, Reference Values, How to Fix).
                  Share with data owners without creating an import job.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={styles.buttonSecondary} onClick={() => downloadPrecheckErrorWorkbook('xlsx')}>
                    Download workbook (.xlsx)
                  </button>
                  <button type="button" style={styles.buttonSecondary} onClick={() => downloadPrecheckErrorWorkbook('csv')}>
                    Download CSV
                  </button>
                </div>
              </div>
            )}

            <div
              style={{
                borderTop: `1px solid ${styles.colors.border}`,
                paddingTop: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 600 }}>7. Upload & validate on server</div>
              {!canUploadToServer && (
                <p style={{ margin: 0, fontSize: 13, color: styles.colors.textMuted }}>
                  This button stays disabled until precheck completes with <strong>ready = true</strong> for the selected
                  file. Changing the file clears precheck.
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

      {/* ─── Step 2: Server validation summary ─── */}
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

      {/* ─── Step 3: Preview ─── */}
      {flowStep === 'preview' && preview && (
        <Card>
          <CardHeader title="Import preview" />
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                {Object.entries(preview.sections as Record<string, Record<string, number>>).map(([key, section]) => (
                  <tr key={key} style={{ borderBottom: `1px solid ${styles.colors.border}` }}>
                    <td style={{ padding: 10, fontWeight: 500 }}>{sectionLabel(key)}</td>
                    <td style={{ padding: 10, textAlign: 'right' }}>{fmtNum(section.rows)}</td>
                    <td style={{ padding: 10, textAlign: 'right', color: '#16a34a' }}>{fmtNum(section.toInsert)}</td>
                    <td style={{ padding: 10, textAlign: 'right', color: '#2563eb' }}>{fmtNum(section.toUpdate)}</td>
                    <td style={{ padding: 10, textAlign: 'right', color: styles.colors.textMuted }}>{fmtNum(section.toSkip)}</td>
                    <td style={{ padding: 10, textAlign: 'right', color: section.failed > 0 ? '#dc2626' : styles.colors.textMuted }}>
                      {fmtNum(section.failed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(preview.warnings as ValidationIssue[])?.length > 0 && (
              <Banner variant="warn">{(preview.warnings as ValidationIssue[]).length} warning(s). Review before importing.</Banner>
            )}

            {!importGateSatisfied && (
              <Banner variant="error">Final import is unavailable: start from the console and pass precheck before uploading.</Banner>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" style={styles.buttonSecondary} onClick={resetFlow}>
                Start over
              </button>
              <button
                type="button"
                style={{ ...styles.buttonPrimary, background: '#16a34a' }}
                disabled={loading || preview.status === 'FAILED' || !importGateSatisfied}
                title={
                  !importGateSatisfied
                    ? 'Precheck must pass before upload; upload again from the console if needed.'
                    : preview.status === 'FAILED'
                      ? 'Resolve validation errors before import.'
                      : undefined
                }
                onClick={handleExecute}
              >
                {loading ? 'Importing…' : 'Run import (publish)'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ─── Step 4: Executing ─── */}
      {flowStep === 'execute' && (
        <Card>
          <CardHeader title="Importing…" />
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={styles.loadingSpinner} />
            <div style={{ marginTop: 16, color: styles.colors.textMuted }}>Publishing supplemental data. Please wait…</div>
            <style>{styles.spinKeyframes}</style>
          </div>
        </Card>
      )}

      {/* ─── Step 5: Results ─── */}
      {flowStep === 'results' && executionResult && (
        <Card>
          <CardHeader title="Import complete" />
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Banner variant={executionResult.status === 'COMPLETED' ? 'success' : 'error'}>
              {executionResult.status === 'COMPLETED' ? 'Import completed successfully.' : 'Import completed with errors.'}
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
