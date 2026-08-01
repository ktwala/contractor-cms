import React from 'react';
import { ERROR_LABELS } from '../types';
import { AlertTriangle } from 'lucide-react';

export function ErrorBanner({
  error,
  onDismiss,
}: {
  error: { code?: string; message?: string; details?: Record<string, unknown> } | string | null;
  onDismiss?: () => void;
}) {
  if (!error) return null;
  const msg =
    typeof error === 'string'
      ? error
      : ERROR_LABELS[error.code ?? ''] ?? error.message ?? 'An unexpected error occurred';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 10,
        marginBottom: 16,
      }}
    >
      <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, fontSize: 14, color: '#991b1b' }}>{msg}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18 }}
        >
          &times;
        </button>
      )}
    </div>
  );
}
