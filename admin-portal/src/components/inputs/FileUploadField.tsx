import { useRef, useState, type CSSProperties } from 'react';
import * as styles from '../../styles/common';
import { recruitmentFilesService } from '../../services/recruitment/recruitmentFiles.service';

type Props = {
  label: string;
  value?: string;
  originalName?: string;
  accept?: string;
  helperText?: string;
  onChangePath: (value: string, meta?: { original_filename?: string }) => void;
  disabled?: boolean;
  testId?: string;
};

export function FileUploadField({
  label,
  value,
  originalName,
  accept = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  helperText,
  onChangePath,
  disabled = false,
  testId = 'file-upload-field',
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastOkName, setLastOkName] = useState<string | undefined>(originalName);

  async function handleFileSelected(file?: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const res = await recruitmentFilesService.upload(file);
      setLastOkName(res.original_filename);
      onChangePath(res.stored_path, { original_filename: res.original_filename });
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
        : '';
      setUploadError(msg || (e instanceof Error ? e.message : 'Upload failed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const statusStyle: CSSProperties = {
    fontSize: 12,
    marginTop: 6,
    color: uploadError ? styles.colors.danger : styles.colors.success,
  };

  return (
    <div data-testid={testId}>
      <label style={styles.formLabel}>{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <input
            style={{ ...styles.input, flex: '1 1 200px', minWidth: 0 }}
            value={value ?? ''}
            onChange={(e) => onChangePath(e.target.value)}
            placeholder="Stored path (set automatically after upload)"
            disabled={disabled || uploading}
            data-testid={`${testId}-path`}
          />
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={(e) => void handleFileSelected(e.target.files?.[0])}
          />
          <button
            type="button"
            style={styles.buttonSecondary}
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            data-testid={`${testId}-browse`}
          >
            {uploading ? 'Uploading…' : 'Upload file'}
          </button>
        </div>
        {(lastOkName || originalName) && !uploadError && (
          <div style={statusStyle} data-testid={`${testId}-filename`}>
            {uploading ? 'Uploading…' : `Selected file: ${lastOkName ?? originalName}`}
          </div>
        )}
        {uploadError && <div style={statusStyle}>{uploadError}</div>}
        {helperText && <p style={{ fontSize: 12, color: styles.colors.textMuted, margin: 0 }}>{helperText}</p>}
      </div>
    </div>
  );
}
