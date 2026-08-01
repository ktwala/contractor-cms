import React, { useState, useEffect } from 'react';

interface Delta {
  label: string;
  before: number;
  after: number;
}

interface ReadinessDeltaToastProps {
  deltas: Delta[];
  visible: boolean;
  onDismiss: () => void;
  autoHideMs?: number;
}

export const ReadinessDeltaToast: React.FC<ReadinessDeltaToastProps> = ({
  deltas, visible, onDismiss, autoHideMs = 6000,
}) => {
  useEffect(() => {
    if (visible && autoHideMs > 0) {
      const t = setTimeout(onDismiss, autoHideMs);
      return () => clearTimeout(t);
    }
  }, [visible, autoHideMs, onDismiss]);

  if (!visible || deltas.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      padding: '16px 20px', minWidth: 280, maxWidth: 400,
      animation: 'slideUp .3s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Readiness updated</span>
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#94a3b8' }}
        >
          ×
        </button>
      </div>
      {deltas.map((d, i) => {
        const improved = d.after < d.before;
        const isPercent = d.label.toLowerCase().includes('readiness') || d.label.toLowerCase().includes('%');
        const percentImproved = isPercent ? d.after > d.before : false;
        const showGreen = improved || percentImproved;
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: '#64748b' }}>{d.label}</span>
            <span style={{ fontWeight: 600, color: showGreen ? '#16a34a' : d.before === d.after ? '#64748b' : '#dc2626' }}>
              {d.before} → {d.after}
            </span>
          </div>
        );
      })}
      <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
};

interface RefreshStatusChipProps {
  refreshing: boolean;
  lastRefreshed?: Date | string | null;
  onRefresh?: () => void;
}

export const RefreshStatusChip: React.FC<RefreshStatusChipProps> = ({
  refreshing, lastRefreshed, onRefresh,
}) => {
  const ts = lastRefreshed
    ? (typeof lastRefreshed === 'string' ? new Date(lastRefreshed) : lastRefreshed).toLocaleTimeString()
    : null;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
      {refreshing ? (
        <span style={{ color: '#6366f1', fontWeight: 500 }}>Refreshing...</span>
      ) : ts ? (
        <span>Last refreshed: {ts}</span>
      ) : null}
      {onRefresh && !refreshing && (
        <button
          onClick={onRefresh}
          style={{
            padding: '3px 8px', borderRadius: 4, border: '1px solid #e2e8f0',
            background: '#f8fafc', fontSize: 11, cursor: 'pointer', color: '#475569',
          }}
        >
          Refresh
        </button>
      )}
    </div>
  );
};
