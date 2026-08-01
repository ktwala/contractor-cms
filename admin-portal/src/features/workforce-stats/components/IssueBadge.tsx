import React from 'react';

interface IssueBadgeProps {
  count: number;
  severity?: 'error' | 'warning' | 'info';
  label?: string;
  onClick?: () => void;
}

const severityConfig = {
  error: { bg: '#fee2e2', fg: '#991b1b' },
  warning: { bg: '#fef9c3', fg: '#854d0e' },
  info: { bg: '#e0f2fe', fg: '#0c4a6e' },
};

export const IssueBadge: React.FC<IssueBadgeProps> = ({
  count, severity = 'warning', label, onClick,
}) => {
  if (count === 0) return null;

  const config = severityConfig[severity];

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: config.bg,
        color: config.fg,
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 6,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {count} {label || (count === 1 ? 'issue' : 'issues')}
    </span>
  );
};

interface BlockerBadgeProps {
  count: number;
  onClick?: () => void;
}

export const BlockerBadge: React.FC<BlockerBadgeProps> = ({ count, onClick }) => {
  if (count === 0) return null;

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: '#fee2e2',
        color: '#991b1b',
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 6,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {count} {count === 1 ? 'blocker' : 'blockers'}
    </span>
  );
};
