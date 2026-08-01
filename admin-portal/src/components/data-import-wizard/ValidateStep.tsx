import * as styles from '../../styles/common';
import { Card, Banner, ui } from '../../ui/layout';

const REQUIRED_COLUMNS: Record<string, string[]> = {
  EMPLOYEES: ['employee_no', 'first_name', 'last_name', 'hire_date'],
  EMPLOYMENTS: ['employee_no', 'legal_entity_code', 'pay_group_code', 'hire_date', 'employment_status'],
};

const OPTIONAL_COLUMNS: Record<string, string[]> = {
  EMPLOYEES: ['email', 'national_id', 'phone', 'date_of_birth', 'country'],
  EMPLOYMENTS: ['job_title', 'termination_date'],
};

type Props = {
  fileName: string;
  dataset: string;
  rowCount?: number | null;
  validating?: boolean;
  validationPhase?: string;
  pipelineProgress?: number | null;
  detectedColumns?: string[];
  summary: {
    total_rows: number;
    valid_rows: number;
    warning_rows?: number;
    error_rows?: number;
    invalid_rows?: number;
    errors?: number;
    warnings?: number;
  };
  errorRowsPreview: Array<{ rowNumber: number; message: string }>;
  onBack: () => void;
  onReupload: () => void;
  onContinue: () => void;
  onExportErrors: (format: 'csv' | 'xlsx') => void;
  exporting: boolean;
};

export default function ValidateStep({
  fileName,
  dataset,
  rowCount,
  validating,
  validationPhase,
  pipelineProgress,
  detectedColumns,
  summary,
  errorRowsPreview,
  onBack,
  onReupload,
  onContinue,
  onExportErrors,
  exporting,
}: Props) {
  const errorCount = summary.error_rows ?? summary.errors ?? summary.invalid_rows ?? 0;
  const warningCount = summary.warning_rows ?? summary.warnings ?? 0;
  const hasErrors = errorCount > 0;
  const canContinue = !hasErrors;
  const showResults = !validating && summary.total_rows > 0;

  const required = REQUIRED_COLUMNS[dataset] ?? [];
  const optional = OPTIONAL_COLUMNS[dataset] ?? [];
  const detectedSet = new Set(detectedColumns ?? []);
  const missingRequired = required.filter((c) => !detectedSet.has(c));
  const orderedColumns = [
    ...required,
    ...optional.filter((c) => detectedSet.has(c)),
    ...(detectedColumns ?? []).filter((c) => !required.includes(c) && !optional.includes(c)),
  ];

  return (
    <Card>
      <div style={{ marginBottom: ui.space.lg }}>
        <div style={{ fontWeight: 700, color: styles.colors.textPrimary, marginBottom: 8 }}>
          Validate Import
        </div>
        <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>
          File: {fileName} · Dataset: {dataset.replace(/_/g, ' ')}
        </div>
        {rowCount != null && !validating && (
          <div style={{ marginTop: 8, fontSize: 13, color: styles.colors.success, fontWeight: 600 }}>
            {fileName} · Rows detected: {rowCount}
          </div>
        )}
      </div>

      {validating && (
        <div
          style={{
            padding: ui.space.xl,
            background: 'rgba(79, 70, 229, 0.06)',
            borderRadius: 8,
            marginBottom: ui.space.lg,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              border: `3px solid ${styles.colors.border}`,
              borderTopColor: styles.colors.primary,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <div style={{ fontWeight: 600, color: styles.colors.textPrimary }}>Validating file…</div>
          {pipelineProgress != null ? (
            <div style={{ maxWidth: 320, margin: '16px auto 0' }}>
              <div style={{
                height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: `linear-gradient(90deg, ${styles.colors.primary}, #818cf8)`,
                  width: `${pipelineProgress}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ fontSize: 12, color: styles.colors.textMuted, marginTop: 6 }}>
                {pipelineProgress}% complete
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: styles.colors.textMuted, marginTop: 4 }}>This may take a few seconds.</div>
          )}
          {validationPhase && (
            <div style={{ fontSize: 13, color: styles.colors.textSecondary, marginTop: 8 }}>{validationPhase}</div>
          )}
        </div>
      )}

      {missingRequired.length > 0 && showResults && (
        <Banner variant="error" style={{ marginBottom: ui.space.md }}>
          {missingRequired.length} required column{missingRequired.length === 1 ? '' : 's'} missing: {missingRequired.join(', ')}
        </Banner>
      )}

      {showResults && detectedColumns && detectedColumns.length > 0 && (
        <div style={{ marginBottom: ui.space.lg }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: styles.colors.textMuted, marginBottom: 8 }}>
            Columns detected
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {orderedColumns.slice(0, 20).map((col) => {
              const isRequired = required.includes(col);
              const found = detectedSet.has(col);
              return (
                <span
                  key={col}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    background: isRequired
                      ? found
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(239, 68, 68, 0.12)'
                      : styles.colors.background,
                    color: isRequired
                      ? found
                        ? styles.colors.success
                        : styles.colors.danger
                      : styles.colors.textSecondary,
                  }}
                >
                  {col}{isRequired && !found ? ' (missing)' : ''}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {showResults && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: ui.space.lg,
        }}
      >
        <div style={{ padding: 12, background: styles.colors.background, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: styles.colors.textMuted, marginBottom: 4 }}>Total rows</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{summary.total_rows}</div>
        </div>
        <div style={{ padding: 12, background: 'rgba(16, 185, 129, 0.08)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: styles.colors.textMuted, marginBottom: 4 }}>Valid rows</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: styles.colors.success }}>{summary.valid_rows}</div>
        </div>
        <div style={{ padding: 12, background: warningCount > 0 ? 'rgba(245, 158, 11, 0.12)' : styles.colors.background, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: styles.colors.textMuted, marginBottom: 4 }}>Warnings</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: warningCount > 0 ? styles.colors.warning : styles.colors.textSecondary }}>{warningCount}</div>
        </div>
        <div style={{ padding: 12, background: hasErrors ? 'rgba(239, 68, 68, 0.1)' : styles.colors.background, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: styles.colors.textMuted, marginBottom: 4 }}>Errors</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: hasErrors ? styles.colors.danger : styles.colors.textSecondary }}>{errorCount}</div>
        </div>
      </div>
      )}

      {showResults && hasErrors && (
        <Banner variant="error" style={{ marginBottom: ui.space.lg }}>
          Errors block approval and publish. Fix the file and re-upload, or download the errors report.
        </Banner>
      )}

      {showResults && hasErrors && (
        <div style={{ marginBottom: ui.space.lg }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Row issue preview</div>
          <div
            style={{
              padding: 12,
              background: styles.colors.background,
              borderRadius: 8,
              maxHeight: 120,
              overflowY: 'auto',
              fontSize: 12,
              fontFamily: 'monospace',
            }}
          >
            {errorRowsPreview.slice(0, 10).map((r, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                Row {r.rowNumber}: {r.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: ui.space.lg }}>
        {showResults && hasErrors && (
          <>
            <button
              type="button"
              style={styles.buttonSecondary}
              disabled={exporting}
              onClick={() => onExportErrors('csv')}
            >
              Download Errors CSV
            </button>
            <button
              type="button"
              style={styles.buttonSecondary}
              disabled={exporting}
              onClick={() => onExportErrors('xlsx')}
            >
              Download Errors XLSX
            </button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button type="button" style={styles.buttonSecondary} onClick={onBack} disabled={validating}>
          Back
        </button>
        {showResults && (
        <div style={{ display: 'flex', gap: 12 }}>
          {hasErrors && (
            <button type="button" style={styles.buttonPrimary} onClick={onReupload}>
              Re-upload Corrected File
            </button>
          )}
          {canContinue && (
            <button type="button" style={styles.buttonPrimary} onClick={onContinue}>
              Continue
            </button>
          )}
        </div>
        )}
      </div>
    </Card>
  );
}
