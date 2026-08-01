import React from 'react';
import { colors } from '../../styles/common';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

export default function EmptyState({ title, message, icon, style }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '3rem 2rem',
        color: colors.textMuted,
        ...style,
      }}
    >
      {icon && <div style={{ marginBottom: 16, fontSize: 48 }}>{icon}</div>}
      <div style={{ fontSize: '1.125rem', fontWeight: 600, color: colors.textPrimary, marginBottom: 8 }}>
        {title}
      </div>
      {message && <div style={{ fontSize: '0.875rem' }}>{message}</div>}
    </div>
  );
}
