import React from 'react';
import { colors } from '../../styles/common';

type BannerVariant = 'info' | 'warn' | 'error';

interface BannerProps {
  children: React.ReactNode;
  variant?: BannerVariant;
  style?: React.CSSProperties;
}

const variantStyles: Record<BannerVariant, React.CSSProperties> = {
  info: { background: '#eff6ff', borderLeft: `4px solid ${colors.info}`, color: '#1e40af' },
  warn: { background: '#fffbeb', borderLeft: `4px solid ${colors.warning}`, color: '#92400e' },
  error: { background: '#fef2f2', borderLeft: `4px solid ${colors.danger}`, color: '#991b1b' },
};

export default function Banner({ children, variant = 'info', style }: BannerProps) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        marginBottom: 24,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
