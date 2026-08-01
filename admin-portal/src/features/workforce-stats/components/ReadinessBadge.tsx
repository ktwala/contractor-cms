import React from 'react';

type ReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'INCOMPLETE';

const statusConfig: Record<ReadinessStatus, { bg: string; fg: string; label: string }> = {
  READY: { bg: '#dcfce7', fg: '#166534', label: 'Ready' },
  WARNING: { bg: '#fef9c3', fg: '#854d0e', label: 'Warning' },
  BLOCKED: { bg: '#fee2e2', fg: '#991b1b', label: 'Blocked' },
  INCOMPLETE: { bg: '#f1f5f9', fg: '#475569', label: 'Incomplete' },
};

interface ReadinessBadgeProps {
  status: ReadinessStatus;
  percent?: number;
  size?: 'sm' | 'md';
}

export const ReadinessBadge: React.FC<ReadinessBadgeProps> = ({ status, percent, size = 'sm' }) => {
  const config = statusConfig[status] || statusConfig.INCOMPLETE;
  const fontSize = size === 'sm' ? 11 : 13;
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: config.bg,
      color: config.fg,
      fontSize,
      fontWeight: 600,
      padding,
      borderRadius: 6,
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
    }}>
      {config.label}
      {percent !== undefined && (
        <span style={{ fontWeight: 400 }}>({percent}%)</span>
      )}
    </span>
  );
};

interface ReadinessBarProps {
  percent: number;
  status: ReadinessStatus;
  height?: number;
  showLabel?: boolean;
}

export const ReadinessBar: React.FC<ReadinessBarProps> = ({ percent, status, height = 6, showLabel = true }) => {
  const colorMap: Record<ReadinessStatus, string> = {
    READY: '#22c55e',
    WARNING: '#eab308',
    BLOCKED: '#ef4444',
    INCOMPLETE: '#94a3b8',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div style={{
        flex: 1,
        height,
        background: '#f1f5f9',
        borderRadius: height,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          height: '100%',
          background: colorMap[status] || '#94a3b8',
          borderRadius: height,
          transition: 'width 0.4s ease',
        }} />
      </div>
      {showLabel && (
        <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', minWidth: 36, textAlign: 'right' }}>
          {percent}%
        </span>
      )}
    </div>
  );
};
