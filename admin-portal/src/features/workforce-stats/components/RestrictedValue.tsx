import React from 'react';

interface RestrictedValueProps {
  tooltip?: string;
}

export const RestrictedValue: React.FC<RestrictedValueProps> = ({ tooltip }) => {
  return (
    <span
      title={tooltip || 'You do not have permission to view this value'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color: '#94a3b8',
        fontSize: 12,
        fontStyle: 'italic',
        cursor: 'help',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      Restricted
    </span>
  );
};
