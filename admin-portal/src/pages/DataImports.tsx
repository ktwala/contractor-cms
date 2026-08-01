import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Grid, Stack, Banner, ui } from '../ui/layout';
import { ForbiddenEmptyState, EmptyListState } from '../ui/empty-states';
import { useAccess } from '../hooks/useAccess';
import { classifyError } from '../utils/pageState';
import { PageBlockedView, PageErrorView } from '../ui/PageStateViews';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import ImportStatusPill from '../components/imports/ImportStatusPill';
import type { DataImportJob, ImportDatasetType } from '../types/data-imports';

const DATASET_OPTIONS: Array<{ value: ImportDatasetType; label: string }> = [
  { value: 'LEGAL_ENTITIES', label: 'Legal Entities' },
  { value: 'PAY_GROUPS', label: 'Pay Groups' },
  { value: 'ORG_UNITS', label: 'Org Units' },
  { value: 'COST_CENTERS', label: 'Cost Centers' },
  { value: 'POSITIONS', label: 'Positions' },
  { value: 'EMPLOYEES', label: 'Employees' },
  { value: 'EMPLOYMENTS', label: 'Employments' },
  { value: 'EMPLOYMENT_ASSIGNMENTS', label: 'Employment Assignments' },
  { value: 'MANAGER_RELATIONSHIPS', label: 'Manager Relationships' },
];

export default function DataImports() {
  const { canAny } = useAccess();
  const navigate = useNavigate();
  const canRead = canAny(['data_import:read', 'iam:legal_entities:manage']);
  const canWrite = canAny(['data_import:write', 'iam:legal_entities:manage']);

  const [jobs, setJobs] = useState<DataImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [datasetFilter, setDatasetFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showUpload, setShowUpload] = useState(false);

  const [uploadDataset, setUploadDataset] = useState<ImportDatasetType>('EMPLOYEES');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!canRead) return;
    void loadJobs();
  }, [canRead]);

  async function loadJobs() {
    setLoading(true);
    setLoadError(null);
    try {
      const params: Record<string, string> = {};
      if (datasetFilter) params.dataset_type = datasetFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/api/enterprise/data-imports', { params });
      const items = res.data?.items ?? res.data ?? [];
      setJobs(Array.isArray(items) ? items : []);
    } catch (err) {
      setLoadError(err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setActionError(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('dataset_type', uploadDataset);

      const res = await api.post('/api/enterprise/data-imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const jobId = res.data?.id;
      setShowUpload(false);
      setUploadFile(null);
      await loadJobs();

      if (jobId) {
        navigate(`/enterprise/data-imports/${jobId}`);
      }
    } catch (e: any) {
      setActionError(e?.response?.data?.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  const summary = useMemo(() => {
    return {
      uploaded: jobs.filter((j) => j.status === 'UPLOADED' || j.status === 'PARSED').length,
      needsValidation: jobs.filter((j) => j.status === 'PARSED').length,
      hasErrors: jobs.filter((j) => j.status === 'HAS_ERRORS').length,
      published: jobs.filter((j) => j.status === 'PUBLISHED').length,
    };
  }, [jobs]);

  const loadState = !loading && loadError ? classifyError(loadError) : null;
  usePageStateTelemetry('enterprise.dataImports', 'enterprise', loadState ?? { kind: 'ready' });

  if (!canRead) {
    return (
      <Page title="Data Imports" subtitle="Upload, validate, and publish customer data into the HCM core.">
        <ForbiddenEmptyState feature="Data Imports" description="You do not have access to view import jobs." />
      </Page>
    );
  }

  if (loadState && loadState.kind === 'blocked') {
    return (
      <Page title="Data Imports" subtitle="Upload, validate, and publish customer data into the HCM core.">
        <PageBlockedView code={loadState.code} message={loadState.message} page="enterprise.dataImports" module="enterprise" />
      </Page>
    );
  }
  if (loadState && loadState.kind === 'error') {
    return (
      <Page title="Data Imports" subtitle="Upload, validate, and publish customer data into the HCM core.">
        <PageErrorView message={loadState.message} retryable={loadState.retryable} onRetry={loadJobs} page="enterprise.dataImports" module="enterprise" />
      </Page>
    );
  }

  return (
    <Page
      title="Data Imports"
      subtitle="Upload, validate, and publish customer data into the HCM core."
      actions={
        canWrite ? (
          <button type="button" style={styles.buttonPrimary} onClick={() => setShowUpload(true)}>
            Upload dataset
          </button>
        ) : null
      }
    >
      <Stack gap={ui.space.lg}>
        {actionError && (
          <Banner variant="error">{actionError}</Banner>
        )}

        <Card style={{ padding: ui.space.lg }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Bootstrap Pack</h3>
          <p style={{ margin: 0, color: styles.colors.textSecondary, fontSize: 14 }}>
            Upload a single ZIP with all organisation data. Ideal for onboarding new customers.
          </p>
          <Link
            to="/enterprise/data-imports/bootstrap-pack"
            style={{ ...styles.buttonPrimary, display: 'inline-block', marginTop: 12, textDecoration: 'none' }}
          >
            Bootstrap Pack Import
          </Link>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: ui.space.lg }}>
          <Card style={{ padding: ui.space.lg }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Payroll supplemental import console</h3>
            <p style={{ margin: 0, color: styles.colors.textSecondary, fontSize: 14 }}>
              Guided flow: tenant template, local precheck, customer-ready error workbook, then server upload. Final
              publish is blocked until precheck passes.
            </p>
            <Link to="/enterprise/data-imports/payroll-supplemental" style={{ ...styles.buttonPrimary, display: 'inline-block', marginTop: 12, textDecoration: 'none' }}>
              Open import console
            </Link>
          </Card>
          <Card style={{ padding: ui.space.lg }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Payroll opening balances import console</h3>
            <p style={{ margin: 0, color: styles.colors.textSecondary, fontSize: 14 }}>
              Guided flow with YTD financial control panel, precheck, grouped error workbook, and publish only after totals
              sign-off.
            </p>
            <Link to="/enterprise/data-imports/payroll-opening-balances" style={{ ...styles.buttonPrimary, display: 'inline-block', marginTop: 12, textDecoration: 'none' }}>
              Open import console
            </Link>
          </Card>
        </div>

        <Grid cols={4} gap={ui.space.lg}>
          <Card><div style={{ fontWeight: 900, fontSize: 22 }}>{summary.uploaded}</div><div style={{ marginTop: 4, color: styles.colors.textSecondary, fontSize: 13 }}>Uploaded</div></Card>
          <Card><div style={{ fontWeight: 900, fontSize: 22 }}>{summary.needsValidation}</div><div style={{ marginTop: 4, color: styles.colors.textSecondary, fontSize: 13 }}>Needs validation</div></Card>
          <Card><div style={{ fontWeight: 900, fontSize: 22 }}>{summary.hasErrors}</div><div style={{ marginTop: 4, color: styles.colors.textSecondary, fontSize: 13 }}>Has errors</div></Card>
          <Card><div style={{ fontWeight: 900, fontSize: 22 }}>{summary.published}</div><div style={{ marginTop: 4, color: styles.colors.textSecondary, fontSize: 13 }}>Published</div></Card>
        </Grid>

        <Card>
          <CardHeader title="Filters" />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <select value={datasetFilter} onChange={(e) => setDatasetFilter(e.target.value)} style={inputStyle}>
              <option value="">All datasets</option>
              {DATASET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
              <option value="">All statuses</option>
              {['UPLOADED', 'PARSED', 'VALIDATING', 'VALIDATED', 'HAS_ERRORS', 'APPROVED', 'PUBLISHING', 'PUBLISHED', 'CANCELLING', 'CANCELLED', 'FAILED'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>

            <button type="button" style={styles.buttonSecondary} onClick={() => void loadJobs()}>
              Apply
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent imports" />
          {loading ? (
            <div style={{ padding: ui.space.xl, textAlign: 'center', color: styles.colors.textSecondary }}>Loading…</div>
          ) : jobs.length === 0 ? (
            <EmptyListState
              title="No import jobs yet"
              description="Upload your first dataset to start staging customer data."
              action={
                canWrite ? (
                  <button type="button" style={styles.buttonPrimary} onClick={() => setShowUpload(true)}>
                    Upload dataset
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.tableHeaderCell}>File name</th>
                    <th style={styles.tableHeaderCell}>Dataset</th>
                    <th style={styles.tableHeaderCell}>Status</th>
                    <th style={styles.tableHeaderCell}>Uploaded at</th>
                    <th style={styles.tableHeaderCell}>Rows</th>
                    <th style={styles.tableHeaderCell}>Errors</th>
                    <th style={styles.tableHeaderCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} style={styles.tableRow}>
                      <td style={styles.tableCell}>{job.fileName}</td>
                      <td style={styles.tableCell}>{job.datasetType.replaceAll('_', ' ')}</td>
                      <td style={styles.tableCell}><ImportStatusPill status={job.status} /></td>
                      <td style={styles.tableCell}>{new Date(job.uploadedAt).toLocaleString()}</td>
                      <td style={styles.tableCell}>{job.summaryJson?.total_rows ?? '—'}</td>
                      <td style={styles.tableCell}>{job.summaryJson?.errors ?? '—'}</td>
                      <td style={styles.tableCell}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Link to={`/enterprise/data-imports/${job.id}`} style={{ ...styles.buttonSecondary, textDecoration: 'none', padding: '4px 10px', fontSize: 12 }}>
                            View
                          </Link>
                          {['VALIDATING', 'PUBLISHING', 'UPLOADED', 'PARSED', 'VALIDATED', 'APPROVED'].includes(job.status) && (
                            <button
                              type="button"
                              style={{ ...styles.buttonSecondary, padding: '4px 10px', fontSize: 12, color: '#dc2626', borderColor: '#fca5a5' }}
                              onClick={async () => {
                                try {
                                  await api.post(`/api/enterprise/data-imports/${job.id}/cancel`);
                                  void loadJobs();
                                } catch { /* ignore */ }
                              }}
                            >
                              Cancel
                            </button>
                          )}
                          {['FAILED', 'HAS_ERRORS', 'CANCELLED'].includes(job.status) && (
                            <button
                              type="button"
                              style={{ ...styles.buttonSecondary, padding: '4px 10px', fontSize: 12, color: '#2563eb', borderColor: '#93c5fd' }}
                              onClick={async () => {
                                try {
                                  await api.post(`/api/enterprise/data-imports/${job.id}/retry`);
                                  void loadJobs();
                                } catch { /* ignore */ }
                              }}
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {showUpload && (
          <div style={modalOverlay}>
            <div style={modalCard}>
              <h3 style={{ marginTop: 0 }}>Upload dataset</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Dataset type</label>
                  <select
                    value={uploadDataset}
                    onChange={(e) => setUploadDataset(e.target.value as ImportDatasetType)}
                    style={inputStyle}
                  >
                    {DATASET_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>File (.csv or .xlsx)</label>
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                <button type="button" style={styles.buttonSecondary} onClick={() => setShowUpload(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  style={styles.buttonPrimary}
                  onClick={() => void handleUpload()}
                  disabled={!uploadFile || uploading}
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Stack>
    </Page>
  );
}

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalCard: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  background: 'white',
  borderRadius: 14,
  padding: 24,
  boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
};

const inputStyle: React.CSSProperties = {
  padding: '10px 16px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  fontSize: 14,
  color: '#374151',
  background: 'white',
  cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 700,
};
