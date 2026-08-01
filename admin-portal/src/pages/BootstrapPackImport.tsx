import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Stack, Banner, ui } from '../ui/layout';
import { ForbiddenEmptyState } from '../ui/empty-states';
import { useAccess } from '../hooks/useAccess';

export default function BootstrapPackImport() {
  const { canAny } = useAccess();
  const canImport = canAny(['data_import:write', 'data_import:publish', 'iam:legal_entities:manage']);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseResult, setParseResult] = useState<{
    manifest: { customer_name?: string; country?: string; datasets?: string[] } | null;
    files?: Array<{ filename: string; datasetType: string; rowCount: number }>;
    datasets?: Array<{ type: string; file: string; rows: number; status: 'ready' | 'warning' | 'blocked' }>;
    blocked?: boolean;
    warnings: string[];
    missing_dependencies?: string[];
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    summary: Record<string, { created?: number; updated?: number; errors?: number; total_rows?: number }>;
    warnings: string[];
    errors: string[];
    report?: string[];
    reportSummary?: Record<string, number>;
    manager_hierarchy_validation?: {
      employees_total: number;
      manager_assigned: number;
      missing_manager: number;
      cycles_detected: number;
      self_manager: number;
      orphan_managers: number;
      cross_entity_managers: number;
      cross_org_managers: number;
      max_depth: number;
      largest_span: number;
      status: 'READY' | 'READY_WITH_WARNINGS' | 'NOT_READY';
      errors: Array<{ code: string; severity: string; message: string }>;
      warnings: Array<{ code: string; severity: string; message: string }>;
    };
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleParse() {
    if (!file) return;
    setErrorMessage(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/enterprise/bootstrap-pack/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setParseResult(res.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setErrorMessage(err?.response?.data?.message ?? 'Failed to parse pack.');
      setParseResult(null);
    }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setErrorMessage(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/enterprise/bootstrap-pack/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setErrorMessage(err?.response?.data?.message ?? 'Import failed.');
      setImportResult(null);
    } finally {
      setImporting(false);
    }
  }

  if (!canImport) {
    return (
      <Page
        title="Bootstrap Pack Import"
        subtitle="Upload a ZIP file containing all organisation data to onboard a new customer."
      >
        <ForbiddenEmptyState
          feature="Bootstrap Pack Import"
          description="You do not have permission to import bootstrap packs."
        />
      </Page>
    );
  }

  return (
    <Page
      title="Bootstrap Pack Import"
      subtitle="Upload a ZIP file containing all organisation data. The system will validate order, run imports automatically, and produce an onboarding report."
    >
      <Stack gap={ui.space.lg}>
        <Banner variant="info">
          <strong>Recommended pack structure:</strong> legal_entities.csv → pay_groups.csv → org_units.csv → cost_centers.csv → positions.csv → employees.csv → employments.csv → employment_assignments.csv → employee_managers.csv (or manager_relationships.csv)
        </Banner>

        <Link to="/enterprise/data-imports" style={{ color: styles.colors.textSecondary, fontSize: 14 }}>
          ← Back to Data Imports
        </Link>

        {errorMessage && <Banner variant="error">{errorMessage}</Banner>}

        <Card>
          <CardHeader title="Upload Bootstrap Pack" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 700 }}>
                ZIP file
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped?.name?.toLowerCase().endsWith('.zip')) {
                    setFile(dropped);
                    setParseResult(null);
                    setImportResult(null);
                  }
                }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.zip';
                  input.onchange = () => {
                    const f = input.files?.[0] ?? null;
                    setFile(f);
                    setParseResult(null);
                    setImportResult(null);
                  };
                  input.click();
                }}
                style={{
                  border: `2px dashed ${dragOver ? styles.colors.primary : styles.colors.border}`,
                  borderRadius: 8,
                  padding: '32px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? '#f0f0ff' : styles.colors.background,
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                {file ? (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: styles.colors.textPrimary }}>{file.name}</div>
                    <div style={{ fontSize: 13, color: styles.colors.textSecondary, marginTop: 4 }}>
                      {(file.size / 1024).toFixed(1)} KB — Click or drop to replace
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: styles.colors.textPrimary }}>
                      Click to select or drag &amp; drop a ZIP file
                    </div>
                    <div style={{ fontSize: 13, color: styles.colors.textSecondary, marginTop: 4 }}>
                      Must contain CSV files (e.g. legal_entities.csv, employees.csv)
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                style={styles.buttonSecondary}
                onClick={() => void handleParse()}
                disabled={!file}
              >
                Parse pack (preview)
              </button>
              <button
                type="button"
                style={styles.buttonPrimary}
                onClick={() => void handleImport()}
                disabled={!file || importing || (!!parseResult?.blocked)}
                title={parseResult?.blocked ? 'Fix blocking dependency errors before importing' : undefined}
              >
                {importing ? 'Importing…' : 'Run import'}
              </button>
            </div>
          </div>
        </Card>

        {parseResult && (
          <Card>
            <CardHeader title="Pack preview" />
            {parseResult.manifest && (
              <div style={{ marginBottom: 16 }}>
                <strong>Manifest:</strong> {parseResult.manifest.customer_name ?? '—'}{' '}
                {parseResult.manifest.country ? `(${parseResult.manifest.country})` : ''}
              </div>
            )}
            {parseResult.blocked && (
              <Banner variant="error" style={{ marginBottom: 16 }}>
                <strong>Blocked:</strong> Some datasets have missing required dependencies. Fix the pack before importing (e.g. add legal_entities.csv when employees.csv is present).
              </Banner>
            )}
            {parseResult.missing_dependencies && parseResult.missing_dependencies.length > 0 && (
              <Banner variant={parseResult.blocked ? 'error' : 'warning'} style={{ marginBottom: 16 }}>
                <strong>Missing dependencies:</strong>{' '}
                {parseResult.missing_dependencies.join('; ')}
              </Banner>
            )}
            {parseResult.warnings.length > 0 && (
              <Banner variant="warning" style={{ marginBottom: 16 }}>
                {parseResult.warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </Banner>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.tableHeaderCell}>Dataset</th>
                    <th style={styles.tableHeaderCell}>File</th>
                    <th style={styles.tableHeaderCell}>Rows</th>
                    <th style={styles.tableHeaderCell}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(parseResult.datasets ?? parseResult.files ?? []).map((d, i) => {
                    const row = 'type' in d ? d : { type: d.datasetType, file: d.filename, rows: d.rowCount, status: 'ready' as const };
                    const statusLabel = row.status === 'blocked' ? '🚫 Blocked' : row.status === 'warning' ? '⚠ Warning' : '✓ Ready';
                    const statusColor = row.status === 'blocked' ? styles.colors.danger : row.status === 'warning' ? styles.colors.warning : styles.colors.text;
                    return (
                      <tr key={i} style={styles.tableRow}>
                        <td style={styles.tableCell}>{row.type.replaceAll('_', ' ')}</td>
                        <td style={styles.tableCell}>{row.file}</td>
                        <td style={styles.tableCell}>{row.rows}</td>
                        <td style={styles.tableCell}>
                          <span style={{ color: statusColor, fontWeight: row.status === 'blocked' ? 600 : 400 }}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {importResult && (
          <Card>
            <CardHeader
              title={importResult.success ? 'Import completed' : 'Import completed with errors'}
            />
            {importResult.report && importResult.report.length > 0 && (
              <pre
                style={{
                  marginBottom: 16,
                  padding: 16,
                  background: styles.colors.background,
                  borderRadius: 6,
                  fontSize: 13,
                  lineHeight: 1.6,
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {importResult.report.join('\n')}
              </pre>
            )}
            {importResult.warnings.length > 0 && (
              <Banner variant="warning" style={{ marginBottom: 16 }}>
                {importResult.warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </Banner>
            )}
            {importResult.errors.length > 0 && (
              <Banner variant="error" style={{ marginBottom: 16 }}>
                {importResult.errors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </Banner>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.tableHeaderCell}>Dataset</th>
                    <th style={styles.tableHeaderCell}>Created</th>
                    <th style={styles.tableHeaderCell}>Updated</th>
                    <th style={styles.tableHeaderCell}>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(importResult.summary).map(([ds, s]) => (
                    <tr key={ds} style={styles.tableRow}>
                      <td style={styles.tableCell}>{ds.replaceAll('_', ' ')}</td>
                      <td style={styles.tableCell}>{s.created ?? '—'}</td>
                      <td style={styles.tableCell}>{s.updated ?? '—'}</td>
                      <td style={styles.tableCell}>{s.errors ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {importResult?.manager_hierarchy_validation && (
          <HierarchyValidationCard validation={importResult.manager_hierarchy_validation} />
        )}
      </Stack>
    </Page>
  );
}

const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    READY: { bg: '#dcfce7', fg: '#166534', label: 'Ready' },
    READY_WITH_WARNINGS: { bg: '#fef9c3', fg: '#854d0e', label: 'Ready with warnings' },
    NOT_READY: { bg: '#fee2e2', fg: '#991b1b', label: 'Not ready' },
  };
  const s = map[status] ?? map.NOT_READY;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 600,
        background: s.bg,
        color: s.fg,
      }}
    >
      {s.label}
    </span>
  );
};

type HierarchyValidation = {
  employees_total: number;
  manager_assigned: number;
  missing_manager: number;
  cycles_detected: number;
  self_manager: number;
  orphan_managers: number;
  cross_entity_managers: number;
  cross_org_managers: number;
  max_depth: number;
  largest_span: number;
  status: string;
  errors: Array<{ code: string; severity: string; message: string }>;
  warnings: Array<{ code: string; severity: string; message: string }>;
};

function HierarchyValidationCard({ validation }: { validation: HierarchyValidation }) {
  const v = validation;
  const metricCard = (label: string, value: number | string, danger = false) => (
    <div
      style={{
        padding: '16px 20px',
        background: danger && typeof value === 'number' && value > 0 ? '#fef2f2' : '#f8fafc',
        borderRadius: 8,
        textAlign: 'center',
        minWidth: 120,
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: danger && typeof value === 'number' && value > 0 ? '#dc2626' : styles.colors.textPrimary,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: styles.colors.textMuted, marginTop: 4 }}>{label}</div>
    </div>
  );

  return (
    <Card>
      <CardHeader
        title="Manager Hierarchy Validation"
        right={statusBadge(v.status)}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {metricCard('Employees', v.employees_total)}
        {metricCard('Manager assigned', v.manager_assigned)}
        {metricCard('Missing manager', v.missing_manager, true)}
        {metricCard('Cycles', v.cycles_detected, true)}
        {metricCard('Self-managers', v.self_manager, true)}
        {metricCard('Orphan managers', v.orphan_managers, true)}
        {metricCard('Cross-entity', v.cross_entity_managers)}
        {metricCard('Cross-org', v.cross_org_managers)}
        {metricCard('Max depth', v.max_depth)}
        {metricCard('Largest span', v.largest_span)}
      </div>

      {v.errors.length > 0 && (
        <Banner variant="error" style={{ marginBottom: 12 }}>
          <strong>Blocking errors ({v.errors.length})</strong>
          {v.errors.map((e, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              [{e.code}] {e.message}
            </div>
          ))}
        </Banner>
      )}

      {v.warnings.length > 0 && (
        <Banner variant="warning" style={{ marginBottom: 12 }}>
          <strong>Warnings ({v.warnings.length})</strong>
          {v.warnings.map((w, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              [{w.code}] {w.message}
            </div>
          ))}
        </Banner>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link to="/enterprise/manager-hierarchy" style={{ ...styles.buttonPrimary, textDecoration: 'none', fontSize: 13 }}>
          Review Hierarchy
        </Link>
        <Link to="/enterprise/employees" style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 13 }}>
          View Employees
        </Link>
        <Link to="/enterprise/data-imports" style={{ ...styles.buttonSecondary, textDecoration: 'none', fontSize: 13 }}>
          Data Imports
        </Link>
      </div>
    </Card>
  );
}
