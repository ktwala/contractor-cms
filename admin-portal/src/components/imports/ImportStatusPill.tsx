import type { ImportStatus } from '../../types/data-imports';

export default function ImportStatusPill({ status }: { status: ImportStatus }) {
  const stylesByStatus: Record<string, React.CSSProperties> = {
    UPLOADED: {
      background: 'rgba(59,130,246,0.12)',
      color: 'rgba(29,78,216,0.95)',
      border: '1px solid rgba(59,130,246,0.25)',
    },
    PARSED: {
      background: 'rgba(59,130,246,0.12)',
      color: 'rgba(29,78,216,0.95)',
      border: '1px solid rgba(59,130,246,0.25)',
    },
    VALIDATING: {
      background: 'rgba(245,158,11,0.12)',
      color: 'rgba(146,64,14,0.95)',
      border: '1px solid rgba(245,158,11,0.25)',
    },
    VALIDATED: {
      background: 'rgba(34,197,94,0.12)',
      color: 'rgba(22,101,52,0.95)',
      border: '1px solid rgba(34,197,94,0.25)',
    },
    HAS_ERRORS: {
      background: 'rgba(239,68,68,0.12)',
      color: 'rgba(185,28,28,0.95)',
      border: '1px solid rgba(239,68,68,0.25)',
    },
    APPROVED: {
      background: 'rgba(79,70,229,0.12)',
      color: 'rgba(79,70,229,0.95)',
      border: '1px solid rgba(79,70,229,0.25)',
    },
    PUBLISHING: {
      background: 'rgba(245,158,11,0.12)',
      color: 'rgba(146,64,14,0.95)',
      border: '1px solid rgba(245,158,11,0.25)',
    },
    PUBLISHED: {
      background: 'rgba(34,197,94,0.18)',
      color: 'rgba(22,101,52,1)',
      border: '1px solid rgba(34,197,94,0.30)',
    },
    CANCELLING: {
      background: 'rgba(107,114,128,0.12)',
      color: 'rgba(75,85,99,0.95)',
      border: '1px solid rgba(107,114,128,0.25)',
    },
    CANCELLED: {
      background: 'rgba(107,114,128,0.15)',
      color: 'rgba(55,65,81,0.95)',
      border: '1px solid rgba(107,114,128,0.30)',
    },
    FAILED: {
      background: 'rgba(239,68,68,0.12)',
      color: 'rgba(185,28,28,0.95)',
      border: '1px solid rgba(239,68,68,0.25)',
    },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        ...stylesByStatus[status],
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
