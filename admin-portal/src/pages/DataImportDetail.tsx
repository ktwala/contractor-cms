import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Section, Stack, Grid, Banner, ui } from '../ui/layout';
import { ForbiddenEmptyState, UnavailableEmptyState, EmptyListState } from '../ui/empty-states';
import { useAccess } from '../hooks/useAccess';
import ImportStatusPill from '../components/imports/ImportStatusPill';
import type { DataImportJob, DataImportRow } from '../types/data-imports';
import { ImportRemediationPanel } from '../features/workforce-stats/components/ImportRemediationPanel';

export default function DataImportDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const { canAny } = useAccess();
  const navigate = useNavigate();

  const canRead = canAny(['data_import:read', 'iam:legal_entities:manage']);
  const canWrite = canAny(['data_import:write', 'iam:legal_entities:manage']);
  const canApprove = canAny(['data_import:approve', 'iam:legal_entities:manage']);
  const canPublish = canAny(['data_import:publish', 'iam:legal_entities:manage']);

  const [job, setJob] = useState<DataImportJob | null>(null);
  const [rows, setRows] = useState<DataImportRow[]>([]);
  const [rowFilter, setRowFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!canRead || !jobId) return;
    void load();
  }, [canRead, jobId, rowFilter]);

  async function load() {
    setLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);
    try {
      const [jobRes, rowsRes] = await Promise.all([
        api.get(`/api/enterprise/data-imports/${jobId}`),
        api.get(`/api/enterprise/data-imports/${jobId}/rows`, {
          params: rowFilter ? { status: rowFilter } : {},
        }),
      ]);

      setJob(jobRes.data);
      const items = rowsRes.data?.items ?? rowsRes.data ?? [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      setErrorStatus(err?.response?.status ?? 500);
      setErrorMessage(err?.response?.data?.message ?? 'Failed to load import job.');
      setJob(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action: 'validate' | 'approve' | 'publish') {
    if (!jobId) return;
    setWorking(true);
    setErrorMessage(null);
    try {
      await api.post(`/api/enterprise/data-imports/${jobId}/${action}`);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setErrorMessage(err?.response?.data?.message ?? `Failed to ${action} import job.`);
    } finally {
      setWorking(false);
    }
  }

  const statusBanner = useMemo(() => {
    if (!job) return null;

    switch (job.status) {
      case 'UPLOADED':
      case 'PARSED':
        return <Banner variant="info">File uploaded and parsed. Run validation before publishing.</Banner>;
      case 'HAS_ERRORS':
        return <Banner variant="error">Validation found blocking issues. Fix the source file and re-upload, or correct the dataset before approval.</Banner>;
      case 'VALIDATED':
        return <Banner variant="info">Validation completed successfully. Review and approve before publishing.</Banner>;
      case 'APPROVED':
        return <Banner variant="info">This job is approved and ready to be published into the HCM core.</Banner>;
      case 'PUBLISHED':
        return <Banner variant="info">This dataset has been published to the HCM core.</Banner>;
      case 'FAILED':
        return <Banner variant="error">This job failed. Review errors and retry with corrected data.</Banner>;
      default:
        return null;
    }
  }, [job]);

  if (!canRead) {
    return (
      <Page title="Import Job" subtitle="Validation and publish details">
        <ForbiddenEmptyState feature="Import Job" description="You do not have access to view this import job." />
      </Page>
    );
  }

  if (!loading && (errorStatus === 404 || errorStatus === 501)) {
    return (
      <Page title="Import Job" subtitle="Validation and publish details">
        <UnavailableEmptyState feature="Import Job" description="This import job is not available." />
      </Page>
    );
  }

  if (loading || !job) {
    return (
      <Page title="Import Job" subtitle="Validation and publish details">
        <Card>
          <div style={{ padding: ui.space.xl, textAlign: 'center', color: styles.colors.textSecondary }}>
            Loading…
          </div>
        </Card>
      </Page>
    );
  }

  const summary = job.summaryJson ?? {};
  const publishSummary = job.publishSummaryJson ?? {};

  async function handleExport(endpoint: string, format: string, filename: string) {
    try {
      const res = await api.get(`/api/enterprise/data-imports/${jobId}/${endpoint}`, {
        params: { format },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErrorMessage('Failed to export. Try again.');
    }
  }

  return (
    <Page
      title={`Import Job – ${job.datasetType.replaceAll('_', ' ')}`}
      subtitle={job.fileName}
      actions={
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/enterprise/data-imports" style={{ ...styles.buttonSecondary, textDecoration: 'none' }}>
            Back
          </Link>

          {(job.status === 'UPLOADED' || job.status === 'PARSED' || job.status === 'HAS_ERRORS') && canWrite && (
            <button type="button" style={styles.buttonSecondary} disabled={working} onClick={() => void runAction('validate')}>
              {working ? 'Working…' : 'Validate'}
            </button>
          )}

          {job.status === 'VALIDATED' && canApprove && (
            <button type="button" style={styles.buttonSecondary} disabled={working} onClick={() => void runAction('approve')}>
              {working ? 'Working…' : 'Approve'}
            </button>
          )}

          {job.status === 'APPROVED' && canPublish && (
            <button type="button" style={styles.buttonPrimary} disabled={working} onClick={() => void runAction('publish')}>
              {working ? 'Working…' : 'Publish'}
            </button>
          )}

          {(job.status === 'HAS_ERRORS' || job.status === 'VALIDATED' || job.status === 'APPROVED' || job.status === 'PUBLISHED') && canRead && (summary.errors ?? 0) > 0 && (
            <>
              <button type="button" style={styles.buttonSecondary} onClick={() => void handleExport('export-errors', 'csv', `validation-errors-${jobId}.csv`)}>
                Export errors (CSV)
              </button>
              <button type="button" style={styles.buttonSecondary} onClick={() => void handleExport('export-errors', 'xlsx', `validation-errors-${jobId}.xlsx`)}>
                Export errors (XLSX)
              </button>
            </>
          )}

          {canRead && (job.status === 'VALIDATED' || job.status === 'APPROVED' || job.status === 'PUBLISHED') && (
            <>
              <button type="button" style={styles.buttonSecondary} onClick={() => void handleExport('export-validation-report', 'csv', `validation-report-${jobId}.csv`)}>
                Validation report (CSV)
              </button>
              <button type="button" style={styles.buttonSecondary} onClick={() => void handleExport('export-validation-report', 'xlsx', `validation-report-${jobId}.xlsx`)}>
                Validation report (XLSX)
              </button>
            </>
          )}
        </div>
      }
    >
      <Stack gap={ui.space.lg}>
        {statusBanner}
        {errorMessage && <Banner variant="error">{errorMessage}</Banner>}

        <Card>
          <CardHeader title="Job summary" right={<ImportStatusPill status={job.status} />} />
          <Grid cols={4} gap={ui.space.lg}>
            <div><div style={metricLabel}>Total rows</div><div style={metricValue}>{summary.total_rows ?? '—'}</div></div>
            <div><div style={metricLabel}>Valid rows</div><div style={metricValue}>{summary.valid_rows ?? '—'}</div></div>
            <div><div style={metricLabel}>Invalid rows</div><div style={metricValue}>{summary.invalid_rows ?? '—'}</div></div>
            <div><div style={metricLabel}>Errors</div><div style={metricValue}>{summary.errors ?? '—'}</div></div>
          </Grid>

          {job.status === 'PUBLISHED' && (publishSummary.created ?? publishSummary.updated ?? publishSummary.skipped ?? publishSummary.failed ?? 0) > 0 && (
            <div style={{ marginTop: ui.space.lg }}>
              <div style={metricLabel}>Publish reconciliation</div>
              <Grid cols={4} gap={ui.space.lg} style={{ marginTop: 8 }}>
                <div><div style={metaLabel}>Created</div><div style={{ fontWeight: 600 }}>{publishSummary.created ?? 0}</div></div>
                <div><div style={metaLabel}>Updated</div><div style={{ fontWeight: 600 }}>{publishSummary.updated ?? 0}</div></div>
                <div><div style={metaLabel}>Skipped</div><div style={{ fontWeight: 600 }}>{publishSummary.skipped ?? 0}</div></div>
                <div><div style={metaLabel}>Failed</div><div style={{ fontWeight: 600 }}>{publishSummary.failed ?? 0}</div></div>
              </Grid>
            </div>
          )}

          <div style={{ marginTop: ui.space.lg, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: ui.space.lg }}>
            <div><div style={metaLabel}>Uploaded at</div><div>{new Date(job.uploadedAt).toLocaleString()}</div></div>
            <div><div style={metaLabel}>Validated at</div><div>{job.validatedAt ? new Date(job.validatedAt).toLocaleString() : '—'}</div></div>
            <div><div style={metaLabel}>Published at</div><div>{job.publishedAt ? new Date(job.publishedAt).toLocaleString() : '—'}</div></div>
          </div>
        </Card>

        {job.status === 'PUBLISHED' && jobId && (
          <Card>
            <CardHeader title="Onboarding Intelligence" />
            <div style={{ padding: '0 20px 20px' }}>
              <ImportRemediationPanel
                jobId={jobId}
                onFixNow={(issueType) => {
                  navigate(`/workforce/overview?drilldown=${issueType}`);
                }}
              />
            </div>
          </Card>
        )}

        <Section title="Rows" subtitle="Preview staged rows and validation results.">
          <Card>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: ui.space.md }}>
              <select value={rowFilter} onChange={(e) => setRowFilter(e.target.value)} style={inputStyle}>
                <option value="">All rows</option>
                <option value="VALID">Valid rows</option>
                <option value="INVALID">Invalid rows</option>
                <option value="PUBLISHED">Published rows</option>
              </select>
            </div>

            {rows.length === 0 ? (
              <EmptyListState
                title="No rows found"
                description="No staged rows match the current filter."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th style={styles.tableHeaderCell}>Row</th>
                      <th style={styles.tableHeaderCell}>External key</th>
                      <th style={styles.tableHeaderCell}>Status</th>
                      <th style={styles.tableHeaderCell}>Errors</th>
                      <th style={styles.tableHeaderCell}>Warnings</th>
                      <th style={styles.tableHeaderCell}>Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} style={styles.tableRow}>
                        <td style={styles.tableCell}>{row.rowNumber}</td>
                        <td style={styles.tableCell}>{row.externalKey ?? '—'}</td>
                        <td style={styles.tableCell}>{row.status}</td>
                        <td style={styles.tableCell}>{row.errorsCount}</td>
                        <td style={styles.tableCell}>{row.warningsCount}</td>
                        <td style={{ ...styles.tableCell, maxWidth: 420 }}>
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: 'pre-wrap',
                              fontSize: 12,
                              color: styles.colors.textSecondary,
                            }}
                          >
                            {JSON.stringify(row.mappedJson ?? row.payloadJson, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </Section>
      </Stack>
    </Page>
  );
}

const metricLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'rgba(0,0,0,0.45)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const metricValue: React.CSSProperties = {
  marginTop: 4,
  fontSize: 24,
  fontWeight: 900,
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

const metaLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'rgba(0,0,0,0.45)',
  marginBottom: 4,
};
