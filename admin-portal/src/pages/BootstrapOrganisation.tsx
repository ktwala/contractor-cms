import { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Stack, Banner, ui } from '../ui/layout';
import { ForbiddenEmptyState } from '../ui/empty-states';
import { useAccess } from '../hooks/useAccess';
import { ImportRemediationPanel } from '../features/workforce-stats/components/ImportRemediationPanel';

type DetectedDataset = {
  datasetType: string;
  source: string;
  rowCount: number;
  status: 'ready' | 'warning' | 'blocked';
  blockReason?: string;
};

type UploadResult = {
  bootstrap_import_id: string;
  file_type: 'XLSX' | 'ZIP';
  datasets_detected: string[];
  datasets: DetectedDataset[];
  row_counts: Record<string, number>;
  warnings: string[];
  missing_required: string[];
  blocked: boolean;
};

type RunDatasetResult = {
  dataset: string;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

type RunResult = {
  bootstrap_import_id: string;
  status: 'COMPLETED' | 'COMPLETED_WITH_WARNINGS' | 'FAILED';
  results: RunDatasetResult[];
  warnings: string[];
  errors: string[];
  report: string[];
};

type BootstrapJob = {
  id: string;
  dataset_type: string;
  data_import_job_id: string | null;
  execution_order: number;
  status: string;
  result: unknown;
};

type BootstrapStatus = {
  bootstrap_import_id: string;
  status: string;
  datasets: unknown;
  summary: {
    user_id?: string;
    datasets_total?: number;
    datasets_processed?: number;
    current_dataset?: string | null;
    results?: RunDatasetResult[];
    warnings?: string[];
    errors?: string[];
    report?: string[];
  } | null;
  jobs: BootstrapJob[];
};

type Step = 'upload' | 'detected' | 'running' | 'completed';

const DATASET_LABELS: Record<string, string> = {
  legal_entities: 'Legal Entities',
  pay_groups: 'Pay Groups',
  org_units: 'Org Units',
  cost_centers: 'Cost Centers',
  positions: 'Positions',
  employees: 'Employees',
  employments: 'Employments',
  employment_assignments: 'Employment Assignments',
  manager_relationships: 'Employee Managers',
};

export default function BootstrapOrganisation() {
  const { canAny } = useAccess();
  const canWrite = canAny(['data_import:write', 'iam:legal_entities:manage']);
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<BootstrapStatus | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/v1/enterprise/bootstrap-imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setUploadResult(res.data);
      setStep('detected');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleRun = useCallback(async () => {
    if (!uploadResult) return;
    setError('');
    setImporting(true);
    setStep('running');
    setPipelineStatus(null);
    try {
      await api.post(`/v1/enterprise/bootstrap-imports/${uploadResult.bootstrap_import_id}/run`, {}, { timeout: 30000 });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Import failed');
      setStep('detected');
      setImporting(false);
    }
  }, [uploadResult]);

  useEffect(() => {
    if (step !== 'running' || !uploadResult) return;
    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, 2000));
        if (cancelled) break;
        try {
          const res = await api.get(`/v1/enterprise/bootstrap-imports/${uploadResult.bootstrap_import_id}`);
          const data = res.data as BootstrapStatus;
          if (cancelled) break;
          setPipelineStatus(data);

          if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'CANCELLED') {
            const summary = data.summary;
            if (summary?.results) {
              setRunResult({
                bootstrap_import_id: data.bootstrap_import_id,
                status: data.status === 'FAILED' ? 'FAILED'
                  : data.status === 'CANCELLED' ? 'FAILED'
                  : (summary.warnings?.length ?? 0) > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
                results: summary.results ?? [],
                warnings: summary.warnings ?? [],
                errors: summary.errors ?? [],
                report: summary.report ?? [],
              });
            }
            setStep('completed');
            setImporting(false);
            break;
          }
        } catch {
          // keep polling
        }
      }
    };
    void poll();
    return () => { cancelled = true; };
  }, [step, uploadResult]);

  const reset = () => {
    setStep('upload');
    setUploadResult(null);
    setRunResult(null);
    setPipelineStatus(null);
    setError('');
  };

  if (!canWrite) {
    return (
      <Page title="Bootstrap Organisation" subtitle="Upload an onboarding workbook or bootstrap pack.">
        <ForbiddenEmptyState feature="Bootstrap Organisation" />
      </Page>
    );
  }

  const steps = ['Upload', 'Detect', 'Import'] as const;
  const stepOrder: Record<Step, number> = { upload: 0, detected: 1, running: 2, completed: 2 };
  const current = stepOrder[step];

  const stepIndicator = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <div style={{ width: 24, height: 2, background: done || active ? styles.colors.primary : '#e2e8f0' }} />}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600,
              background: done ? styles.colors.primary : active ? styles.colors.primary : '#e2e8f0',
              color: done || active ? 'white' : styles.colors.textMuted,
            }}>
              {done ? '✓' : i + 1}
            </div>
            <span style={{ fontWeight: active ? 600 : 400, color: active ? styles.colors.textPrimary : styles.colors.textMuted }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <Page
      title="Bootstrap Organisation"
      subtitle="Upload an onboarding workbook or bootstrap pack to set up the organisation in one guided flow."
      actions={step !== 'upload' && step !== 'completed' ? (
        <button type="button" onClick={reset} style={{ ...styles.buttonSecondary, fontSize: 12 }}>Start over</button>
      ) : null}
    >
      <Stack gap={ui.space.lg}>
        {stepIndicator}
        {error && <Banner variant="error">{error}</Banner>}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <Card>
            <CardHeader title="Upload Onboarding File" />
            <div style={{ padding: '0 20px 24px' }}>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) void handleFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? styles.colors.primary : styles.colors.border}`,
                  borderRadius: 12, padding: '48px 24px', textAlign: 'center',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  background: dragOver ? '#f0f9ff' : '#fafbfc',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: styles.colors.textPrimary, marginBottom: 6 }}>
                  {uploading ? 'Uploading and detecting datasets...' : 'Drag and drop file here or click to browse'}
                </div>
                <div style={{ fontSize: 13, color: styles.colors.textMuted }}>
                  Supported: Excel workbook (.xlsx) or Bootstrap pack (.zip)
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.zip"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <a
                  href="#"
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      const res = await api.get('/v1/enterprise/bootstrap-imports/template/download', { responseType: 'blob' });
                      const url = window.URL.createObjectURL(new Blob([res.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'Hubsec_Workforce_Onboarding_Template.xlsx';
                      link.click();
                      window.URL.revokeObjectURL(url);
                    } catch {
                      setError('Failed to download template');
                    }
                  }}
                  style={{
                    fontSize: 13, color: styles.colors.primary, textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Download onboarding workbook template
                </a>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2: Datasets Detected → Run */}
        {step === 'detected' && uploadResult && (
          <>
            <Card>
              <CardHeader
                title="Datasets Detected"
                right={
                  <span style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: uploadResult.file_type === 'XLSX' ? '#ede9fe' : '#e0f2fe',
                    color: uploadResult.file_type === 'XLSX' ? '#7c3aed' : '#0284c7',
                  }}>
                    {uploadResult.file_type === 'XLSX' ? 'Excel Workbook' : 'Bootstrap Pack (ZIP)'}
                  </span>
                }
              />
              <div style={{ padding: '0 20px 20px' }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th style={styles.tableHeaderCell}>Dataset</th>
                      <th style={styles.tableHeaderCell}>Source</th>
                      <th style={styles.tableHeaderCell}>Rows</th>
                      <th style={styles.tableHeaderCell}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.datasets.map((ds) => (
                      <tr key={ds.datasetType} style={styles.tableRow}>
                        <td style={styles.tableCell}>
                          <span style={{ fontWeight: 500 }}>{DATASET_LABELS[ds.datasetType.toLowerCase()] ?? ds.datasetType}</span>
                        </td>
                        <td style={styles.tableCell}>
                          <span style={{ fontSize: 12, color: styles.colors.textMuted }}>{ds.source}</span>
                        </td>
                        <td style={styles.tableCell}>{ds.rowCount}</td>
                        <td style={styles.tableCell}>
                          <StatusBadge status={ds.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {uploadResult.warnings.length > 0 && (
              <Banner variant="warning">
                <strong>Warnings:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {uploadResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </Banner>
            )}

            {uploadResult.blocked && (
              <Banner variant="error">
                Import is blocked due to missing required dependencies. Fix the file and re-upload.
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {uploadResult.missing_required.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </Banner>
            )}

            <div>
              <button
                type="button"
                disabled={uploadResult.blocked || importing}
                onClick={() => void handleRun()}
                style={{
                  padding: '12px 32px', borderRadius: 8, border: 'none', fontSize: 15, fontWeight: 700,
                  cursor: uploadResult.blocked || importing ? 'not-allowed' : 'pointer',
                  background: uploadResult.blocked || importing ? '#cbd5e1' : styles.colors.primary,
                  color: 'white',
                }}
              >
                {importing ? 'Running Bootstrap Import...' : 'Run Bootstrap Import'}
              </button>
              <p style={{ fontSize: 13, color: styles.colors.textMuted, marginTop: 8 }}>
                Each dataset will be validated and imported in dependency order.
              </p>
            </div>
          </>
        )}

        {/* Step 3: Running — live per-dataset progress */}
        {step === 'running' && (
          <Card>
            <CardHeader title="Importing Datasets" right={
              pipelineStatus?.summary ? (
                <span style={{ fontSize: 13, color: styles.colors.textMuted }}>
                  {pipelineStatus.summary.datasets_processed ?? 0} / {pipelineStatus.summary.datasets_total ?? '?'} datasets
                </span>
              ) : null
            } />
            <div style={{ padding: '0 20px 24px' }}>
              {(!pipelineStatus || !pipelineStatus.jobs || pipelineStatus.jobs.length === 0) ? (
                <div style={{ ...styles.loadingContainer, padding: 32 }}>
                  <div style={styles.loadingSpinner} />
                  <p style={{ color: styles.colors.textSecondary, marginTop: 12, fontSize: 14 }}>
                    Starting pipeline...
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pipelineStatus.jobs.map((job) => {
                    const label = DATASET_LABELS[job.dataset_type.toLowerCase()] ?? job.dataset_type;
                    const isDone = job.status === 'PUBLISHED';
                    const isFailed = job.status === 'HAS_ERRORS' || job.status === 'FAILED';
                    const isActive = job.status === 'VALIDATING' || job.status === 'PUBLISHING';
                    const isPending = job.status === 'PENDING';

                    return (
                      <div key={job.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 8,
                        background: isActive ? 'rgba(79, 70, 229, 0.04)' : '#fafbfc',
                        border: `1px solid ${isActive ? 'rgba(79, 70, 229, 0.15)' : styles.colors.borderLight}`,
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isDone ? '#dcfce7' : isFailed ? '#fee2e2' : isActive ? styles.colors.primary : '#f1f5f9',
                          color: isDone ? '#16a34a' : isFailed ? '#dc2626' : isActive ? 'white' : styles.colors.textMuted,
                          fontSize: 11, fontWeight: 700,
                        }}>
                          {isDone ? '✓' : isFailed ? '✕' : isActive ? (
                            <div style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          ) : job.execution_order}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: isActive ? 600 : 500,
                            color: isPending ? styles.colors.textMuted : styles.colors.textPrimary,
                          }}>
                            {label}
                          </div>
                          {isActive && (
                            <div style={{ marginTop: 4 }}>
                              <div style={{
                                height: 4, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden',
                              }}>
                                <div style={{
                                  height: '100%', borderRadius: 2,
                                  background: `linear-gradient(90deg, ${styles.colors.primary}, #818cf8)`,
                                  animation: 'pipeline-progress 1.5s ease-in-out infinite',
                                  width: '60%',
                                }} />
                              </div>
                              <div style={{ fontSize: 11, color: styles.colors.textMuted, marginTop: 2 }}>
                                {job.status === 'VALIDATING' ? 'Validating rows...' : 'Publishing records...'}
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: isPending ? styles.colors.textMuted : isDone ? '#16a34a' : isFailed ? '#dc2626' : styles.colors.primary }}>
                          <PipelineStatusLabel status={job.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {uploadResult && (
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.post(`/v1/enterprise/bootstrap-imports/${uploadResult.bootstrap_import_id}/cancel`);
                      } catch { /* polling will pick up the status change */ }
                    }}
                    style={{
                      padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      border: '1px solid #fca5a5', background: 'white', color: '#dc2626',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel Import
                  </button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step 4: Completion Summary */}
        {step === 'completed' && runResult && (
          <>
            <Card>
              <div style={{ padding: 24, textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, margin: '0 auto 16px', borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: runResult.status === 'FAILED' ? '#fee2e2' : '#dcfce7',
                }}>
                  {runResult.status === 'FAILED' ? (
                    <svg width="28" height="28" fill="none" stroke="#dc2626" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  ) : (
                    <svg width="28" height="28" fill="none" stroke="#16a34a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  )}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: styles.colors.textPrimary, marginBottom: 4 }}>
                  {runResult.status === 'FAILED' ? 'Bootstrap Import Failed' : 'Bootstrap Import Completed'}
                </h2>
                <p style={{ color: styles.colors.textMuted, fontSize: 14, marginBottom: 0 }}>
                  {runResult.status === 'COMPLETED'
                    ? 'All datasets imported successfully.'
                    : runResult.status === 'COMPLETED_WITH_WARNINGS'
                      ? 'Import completed with some warnings.'
                      : 'Some datasets failed to import.'}
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Import Results" />
              <div style={{ padding: '0 20px 20px' }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th style={styles.tableHeaderCell}>Dataset</th>
                      <th style={styles.tableHeaderCell}>Created</th>
                      <th style={styles.tableHeaderCell}>Updated</th>
                      <th style={styles.tableHeaderCell}>Skipped</th>
                      <th style={styles.tableHeaderCell}>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runResult.results.map((r) => (
                      <tr key={r.dataset} style={styles.tableRow}>
                        <td style={styles.tableCell}>
                          <span style={{ fontWeight: 500 }}>{DATASET_LABELS[r.dataset] ?? r.dataset}</span>
                        </td>
                        <td style={styles.tableCell}>
                          <span style={{ fontWeight: 600, color: r.created > 0 ? '#16a34a' : styles.colors.textMuted }}>{r.created}</span>
                        </td>
                        <td style={styles.tableCell}>{r.updated}</td>
                        <td style={styles.tableCell}>{r.skipped}</td>
                        <td style={styles.tableCell}>
                          <span style={{ color: r.errors > 0 ? '#dc2626' : styles.colors.textMuted }}>{r.errors}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {runResult.warnings.length > 0 && (
              <Banner variant="warning">
                <strong>Warnings:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {runResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </Banner>
            )}

            {runResult.errors.length > 0 && (
              <Banner variant="error">
                <strong>Errors:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {runResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </Banner>
            )}

            {runResult.report.length > 0 && (
              <Card>
                <CardHeader title="Onboarding Report" />
                <div style={{ padding: '0 20px 20px' }}>
                  <pre style={{
                    background: '#f8fafc', borderRadius: 8, padding: 16, fontSize: 12,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    lineHeight: 1.6, whiteSpace: 'pre-wrap', color: styles.colors.textSecondary,
                    margin: 0, border: `1px solid ${styles.colors.border}`,
                  }}>
                    {runResult.report.join('\n')}
                  </pre>
                </div>
              </Card>
            )}

            {runResult.status !== 'FAILED' && uploadResult && (
              <Card>
                <CardHeader title="Onboarding Intelligence" />
                <div style={{ padding: '0 20px 20px' }}>
                  <ImportRemediationPanel
                    jobId={uploadResult.bootstrap_import_id}
                    onFixNow={(issueType) => {
                      navigate(`/workforce/overview?drilldown=${issueType}`);
                    }}
                  />
                </div>
              </Card>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/enterprise/employees" style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 13 }}>
                View Employees
              </Link>
              <Link to="/enterprise/organisation" style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 13 }}>
                View Dashboard
              </Link>
              <Link to="/enterprise/manager-hierarchy" style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 13 }}>
                Manager Hierarchy
              </Link>
              <Link to="/enterprise/data-imports" style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 13 }}>
                Data Imports Console
              </Link>
              {runResult && (runResult.status === 'FAILED' || runResult.status === 'COMPLETED_WITH_WARNINGS') && uploadResult && (
                <button
                  type="button"
                  style={{ ...styles.buttonSecondary, fontSize: 13, color: '#2563eb', borderColor: '#93c5fd' }}
                  onClick={async () => {
                    try {
                      setError('');
                      await api.post(`/v1/enterprise/bootstrap-imports/${uploadResult.bootstrap_import_id}/retry`);
                      setRunResult(null);
                      setPipelineStatus(null);
                      setStep('running');
                      setImporting(true);
                    } catch (err: unknown) {
                      const e = err as { response?: { data?: { message?: string } } };
                      setError(e?.response?.data?.message ?? 'Retry failed — please re-upload the file');
                    }
                  }}
                >
                  Retry Failed Datasets
                </button>
              )}
              <button type="button" onClick={reset} style={{ ...styles.buttonSecondary, fontSize: 13 }}>
                Import Another File
              </button>
            </div>
          </>
        )}
      </Stack>
      <style>{`
        ${styles.spinKeyframes}
        @keyframes pipeline-progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(40%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </Page>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    ready: { bg: '#dcfce7', fg: '#166534', label: 'Ready' },
    warning: { bg: '#fef9c3', fg: '#854d0e', label: 'Warning' },
    blocked: { bg: '#fee2e2', fg: '#991b1b', label: 'Blocked' },
  };
  const s = map[status] ?? map.ready;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

function PipelineStatusLabel({ status }: { status: string }) {
  const labels: Record<string, string> = {
    PENDING: 'Queued',
    VALIDATING: 'Validating',
    PUBLISHING: 'Publishing',
    PUBLISHED: 'Done',
    HAS_ERRORS: 'Errors',
    FAILED: 'Failed',
    CANCELLING: 'Cancelling',
    CANCELLED: 'Cancelled',
  };
  return <>{labels[status] ?? status}</>;
}
