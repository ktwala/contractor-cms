import * as styles from '../../styles/common';
import { Card, ui } from '../../ui/layout';

type Props = {
  dataset: string;
  fileName: string;
  uploadedBy?: string;
  uploadedAt?: string;
  summary: {
    total_rows: number;
    valid_rows: number;
    warning_rows?: number;
    error_rows?: number;
    errors?: number;
  };
  onBack: () => void;
  onApprove: () => void;
  approving: boolean;
};

export default function ReviewApproveStep({
  dataset,
  fileName,
  uploadedBy,
  uploadedAt,
  summary,
  onBack,
  onApprove,
  approving,
}: Props) {
  const errorCount = summary.error_rows ?? summary.errors ?? 0;

  return (
    <Card>
      <div style={{ marginBottom: ui.space.lg }}>
        <div style={{ fontWeight: 700, color: styles.colors.textPrimary, marginBottom: 8 }}>
          Review & Approve
        </div>
      </div>

      <div
        style={{
          padding: 16,
          background: styles.colors.background,
          borderRadius: 8,
          marginBottom: ui.space.lg,
        }}
      >
        <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: styles.colors.textMuted }}>Dataset</span>
            <span style={{ fontWeight: 600 }}>{dataset.replace(/_/g, ' ')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: styles.colors.textMuted }}>File</span>
            <span style={{ fontWeight: 600 }}>{fileName}</span>
          </div>
          {uploadedBy && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: styles.colors.textMuted }}>Uploaded by</span>
              <span>{uploadedBy}</span>
            </div>
          )}
          {uploadedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: styles.colors.textMuted }}>Uploaded at</span>
              <span>{new Date(uploadedAt).toLocaleString()}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: styles.colors.textMuted }}>Rows</span>
            <span>{summary.total_rows}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: styles.colors.textMuted }}>Valid rows</span>
            <span style={{ color: styles.colors.success, fontWeight: 600 }}>{summary.valid_rows}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: styles.colors.textMuted }}>Errors</span>
            <span style={{ color: errorCount > 0 ? styles.colors.danger : styles.colors.textSecondary }}>{errorCount}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 12,
          background: 'rgba(79, 70, 229, 0.06)',
          borderRadius: 8,
          marginBottom: ui.space.xl,
          fontSize: 13,
          color: styles.colors.textSecondary,
        }}
      >
        <strong>Expected impact:</strong> Create records from valid rows. Existing records may be updated based on matching keys.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button type="button" style={styles.buttonSecondary} onClick={onBack} disabled={approving}>
          Back
        </button>
        <button type="button" style={styles.buttonPrimary} onClick={onApprove} disabled={approving}>
          {approving ? 'Approving…' : 'Approve Import'}
        </button>
      </div>
    </Card>
  );
}
