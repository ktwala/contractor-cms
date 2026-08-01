import React from 'react';
import { STATUS_COLORS, SOURCE_COLORS } from '../types';
import type { AuthoringStatus, SourceType } from '../types';

const badgeBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

export function StatusBadge({ status }: { status: AuthoringStatus }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT;
  return (
    <span style={{ ...badgeBase, background: c.bg, color: c.text }}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function SourceBadge({ source }: { source: SourceType }) {
  const c = SOURCE_COLORS[source] ?? SOURCE_COLORS.MANUAL;
  return (
    <span style={{ ...badgeBase, background: c.bg, color: c.text }}>
      {source}
    </span>
  );
}
