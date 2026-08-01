import React from 'react';
import { spacing } from '../../styles/tokens';
import * as styles from '../../styles/common';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  primaryAction?: React.ReactNode;
  rightActions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, primaryAction, rightActions }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap' as const,
        gap: 16,
        marginBottom: spacing.blockGap,
      }}
    >
      <div>
        <h1 style={{ ...styles.pageTitle, marginBottom: subtitle ? 4 : 0 }}>{title}</h1>
        {subtitle && <p style={{ ...styles.pageSubtitle, margin: 0 }}>{subtitle}</p>}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const }}>
        {primaryAction}
        {rightActions}
      </div>
    </div>
  );
}
