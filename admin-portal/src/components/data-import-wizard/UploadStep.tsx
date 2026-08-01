import { useRef, useState } from 'react';
import * as styles from '../../styles/common';
import { Card, ui } from '../../ui/layout';

type DatasetType = 'EMPLOYEES' | 'EMPLOYMENTS' | 'MANAGER_RELATIONSHIPS';

type Props = {
  dataset: DatasetType;
  file: File | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  onBack: () => void;
  onUpload: () => void;
  uploading: boolean;
};

export default function UploadStep({
  dataset,
  file,
  onFileSelect,
  onClear,
  onBack,
  onUpload,
  uploading,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.name?.toLowerCase().endsWith('.csv')) {
      onFileSelect(f);
    }
  };

  const handleBrowse = () => {
    inputRef.current?.click();
  };

  return (
    <Card>
      <div style={{ marginBottom: ui.space.lg }}>
        <div style={{ fontWeight: 700, color: styles.colors.textPrimary, marginBottom: 8 }}>
          Upload File
        </div>
        <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>
          Dataset: {dataset.replace(/_/g, ' ')}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelect(f);
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={!file ? handleBrowse : undefined}
        style={{
          border: `2px dashed ${dragOver ? styles.colors.primary : styles.colors.border}`,
          borderRadius: ui.radius.md,
          padding: ui.space.xl,
          textAlign: 'center',
          background: dragOver ? 'rgba(79, 70, 229, 0.04)' : styles.colors.background,
          cursor: file ? 'default' : 'pointer',
          marginBottom: ui.space.lg,
        }}
      >
        {file ? (
          <div>
            <div style={{ fontWeight: 600, color: styles.colors.textPrimary, marginBottom: 4 }}>
              {file.name}
            </div>
            <div style={{ fontSize: 12, color: styles.colors.textSecondary, marginBottom: 12 }}>
              {(file.size / 1024).toFixed(1)} KB
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              style={{ ...styles.buttonSecondary, fontSize: 12, padding: '6px 12px' }}
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 14, color: styles.colors.textSecondary, marginBottom: 8 }}>
              Drag and drop file here, or
            </div>
            <div style={{ fontWeight: 600, color: styles.colors.primary }}>Browse Files</div>
          </>
        )}
      </div>

      <div style={{ fontSize: 12, color: styles.colors.textMuted, marginBottom: ui.space.lg }}>
        Accepted format: CSV. Validation will run before approval and publish.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button type="button" style={styles.buttonSecondary} onClick={onBack} disabled={uploading}>
          Back
        </button>
        <button
          type="button"
          style={styles.buttonPrimary}
          onClick={onUpload}
          disabled={!file || uploading}
        >
          {uploading ? 'Uploading…' : 'Upload and Continue'}
        </button>
      </div>
    </Card>
  );
}
