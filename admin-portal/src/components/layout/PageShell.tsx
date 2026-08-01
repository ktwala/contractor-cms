import React from 'react';
import { spacing } from '../../styles/tokens';
import { colors } from '../../styles/common';

interface PageShellProps {
  children: React.ReactNode;
  maxWidth?: number;
}

export default function PageShell({ children, maxWidth = 1280 }: PageShellProps) {
  return (
    <div
      style={{
        padding: spacing.pagePadding,
        minHeight: 'calc(100vh - 64px)',
        background: colors.background,
        maxWidth: maxWidth ? maxWidth : undefined,
        margin: maxWidth ? '0 auto' : undefined,
      }}
    >
      {children}
    </div>
  );
}
