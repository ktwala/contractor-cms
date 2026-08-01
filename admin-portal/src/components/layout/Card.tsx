import React from 'react';
import { spacing, radii } from '../../styles/tokens';
import { colors } from '../../styles/common';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Card({ children, style }: CardProps) {
  return (
    <div
      style={{
        background: colors.cardBg,
        borderRadius: radii.card,
        border: `1px solid ${colors.border}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: spacing.cardPadding,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: '1rem', fontWeight: 600, color: colors.textPrimary }}>{children}</div>
      {action}
    </div>
  );
}

export function CardBody({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: spacing.cardPadding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: spacing.cardPadding,
        borderTop: `1px solid ${colors.border}`,
        background: '#fafafa',
      }}
    >
      {children}
    </div>
  );
}
