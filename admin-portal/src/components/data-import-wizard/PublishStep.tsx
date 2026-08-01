import { Link } from 'react-router-dom';
import * as styles from '../../styles/common';
import { Card, Banner, ui } from '../../ui/layout';

type DatasetType = 'EMPLOYEES' | 'EMPLOYMENTS' | 'MANAGER_RELATIONSHIPS';

type Props = {
  dataset: DatasetType;
  fileName: string;
  status: 'idle' | 'publishing' | 'success' | 'failed';
  publishSummary?: { created: number; updated: number; skipped: number };
  pipelineProgress?: number | null;
  onBack: () => void;
  onPublish: () => void;
  onImportEmploymentsNext?: () => void;
};

export default function PublishStep({
  dataset,
  fileName,
  status,
  publishSummary,
  pipelineProgress,
  onBack,
  onPublish,
  onImportEmploymentsNext,
}: Props) {
  if (status === 'success' && publishSummary) {
    const isEmployees = dataset === 'EMPLOYEES';
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: ui.space.xl }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <svg width="28" height="28" fill="none" stroke={styles.colors.success} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: 20, color: styles.colors.textPrimary, marginBottom: 8 }}>
            {isEmployees ? 'Employees imported successfully' : 'Employments imported successfully'}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 24,
              marginBottom: ui.space.lg,
              fontSize: 15,
            }}
          >
            <span><strong>Created:</strong> {publishSummary.created}</span>
            <span><strong>Updated:</strong> {publishSummary.updated}</span>
            <span><strong>Skipped:</strong> {publishSummary.skipped}</span>
          </div>

          {isEmployees && (
            <div
              style={{
                padding: ui.space.lg,
                background: 'rgba(79, 70, 229, 0.08)',
                borderRadius: 10,
                border: `1px solid rgba(79, 70, 229, 0.2)`,
                marginBottom: ui.space.xl,
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: styles.colors.textMuted, marginBottom: 8 }}>
                Next recommended step
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: styles.colors.textPrimary, marginBottom: 12 }}>
                Import Employments
              </div>
              <div style={{ fontSize: 13, color: styles.colors.textSecondary, marginBottom: 12 }}>
                Link employees to legal entities and pay groups for payroll readiness.
              </div>
              <button
                type="button"
                style={{ ...styles.buttonPrimary, textDecoration: 'none' }}
                onClick={() => onImportEmploymentsNext?.()}
              >
                Import Employments
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/enterprise/employees" style={{ ...styles.buttonSecondary, textDecoration: 'none' }}>
              View Employees
            </Link>
            {dataset === 'EMPLOYMENTS' && (
              <Link to="/enterprise/hr-export" style={{ ...styles.buttonSecondary, textDecoration: 'none' }}>
                Validate HR Export
              </Link>
            )}
            <Link to="/enterprise/data-imports" style={{ ...styles.buttonSecondary, textDecoration: 'none' }}>
              Open Data Imports Console
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  if (status === 'failed') {
    return (
      <Card>
        <Banner variant="error">The import could not be completed. Please review the job in Data Imports Console.</Banner>
        <div style={{ display: 'flex', gap: 12, marginTop: ui.space.lg }}>
          <Link to="/enterprise/data-imports" style={{ ...styles.buttonPrimary, textDecoration: 'none' }}>
            Open Data Imports Console
          </Link>
          <button type="button" style={styles.buttonSecondary} onClick={onBack}>
            Retry Later
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ marginBottom: ui.space.lg }}>
        <div style={{ fontWeight: 700, color: styles.colors.textPrimary, marginBottom: 8 }}>
          Publish Import
        </div>
        <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>
          This will write validated records into Hubsec Workforce Platform.
        </div>
      </div>

      <div style={{ padding: 12, background: styles.colors.background, borderRadius: 8, marginBottom: ui.space.xl }}>
        <div style={{ fontSize: 13 }}>
          <strong>Dataset:</strong> {dataset.replace(/_/g, ' ')} · <strong>File:</strong> {fileName}
        </div>
      </div>

      {status === 'publishing' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: ui.space.xl,
            color: styles.colors.textSecondary,
            marginBottom: ui.space.lg,
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
              marginBottom: 12,
            }}
          />
          <div style={{ fontWeight: 600 }}>Publishing import…</div>
          {pipelineProgress != null ? (
            <div style={{ width: '100%', maxWidth: 320, marginTop: 12 }}>
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
            <div style={{ fontSize: 13 }}>Please wait while records are applied.</div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button type="button" style={styles.buttonSecondary} onClick={onBack} disabled={status === 'publishing'}>
          Back
        </button>
        <button
          type="button"
          style={styles.buttonPrimary}
          onClick={onPublish}
          disabled={status === 'publishing'}
        >
          {status === 'publishing' ? 'Publishing…' : 'Publish Import'}
        </button>
      </div>
    </Card>
  );
}
