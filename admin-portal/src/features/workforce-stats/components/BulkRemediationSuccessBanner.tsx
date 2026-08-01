import React from 'react';

interface Props {
  result: {
    recordsUpdated: number;
    issueTypeLabel: string;
    readinessBefore?: number;
    readinessAfter?: number;
  } | null;
  onDismiss: () => void;
}

export const BulkRemediationSuccessBanner: React.FC<Props> = ({ result, onDismiss }) => {
  if (!result) return null;

  return (
    <div style={{
      padding: '14px 24px',
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>
          Bulk remediation complete
        </div>
        <div style={{ fontSize: 13, color: '#15803d', marginTop: 2 }}>
          {result.issueTypeLabel} fixed for {result.recordsUpdated} record{result.recordsUpdated !== 1 ? 's' : ''}.
          {result.readinessBefore != null && result.readinessAfter != null && (
            <span> Readiness: {result.readinessBefore}% → {result.readinessAfter}%</span>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#166534', fontSize: 18, padding: '0 4px',
        }}
      >×</button>
    </div>
  );
};
