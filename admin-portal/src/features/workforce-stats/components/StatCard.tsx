import React from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  trend?: { delta: number; label?: string };
  badge?: React.ReactNode;
  onClick?: () => void;
  color?: string;
  icon?: string;
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label, value, subtitle, trend, badge, onClick, color, icon, loading,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .15s, border-color .15s',
        borderLeft: color ? `3px solid ${color}` : undefined,
        minWidth: 0,
        position: 'relative',
        ...(onClick ? {} : {}),
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
          (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
          {label}
        </span>
        {badge}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
        {loading ? <span style={{ color: '#94a3b8' }}>—</span> : value}
      </div>
      {(subtitle || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {trend && (
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: trend.delta > 0 ? '#16a34a' : trend.delta < 0 ? '#dc2626' : '#64748b',
            }}>
              {trend.delta > 0 ? '+' : ''}{trend.delta}{trend.label ? ` ${trend.label}` : ''}
            </span>
          )}
          {subtitle && (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
};

interface StatStripProps {
  children: React.ReactNode;
  columns?: number;
}

export const StatStrip: React.FC<StatStripProps> = ({ children, columns }) => {
  const count = React.Children.count(children);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns || count || 4}, 1fr)`,
      gap: 14,
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
};
