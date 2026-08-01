import React from 'react';
import { Card } from '../../../../ui/layout';

interface Props {
  buckets: Array<{ label: string; count: number }>;
}

const BUCKET_COLORS: Record<string, string> = {
  'Decrease > 500': '#059669',
  'Decrease 100–500': '#34d399',
  'Decrease 1–99': '#6ee7b7',
  'Unchanged': '#cbd5e1',
  'Increase 1–99': '#fca5a5',
  'Increase 100–500': '#f87171',
  'Increase > 500': '#dc2626',
};

export function ImpactAnalysisDistribution({ buckets }: Props) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <Card>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#1e293b' }}>
        Impact Distribution
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {buckets.map((bucket) => {
          const pct = (bucket.count / maxCount) * 100;
          const color = BUCKET_COLORS[bucket.label] ?? '#94a3b8';
          return (
            <div key={bucket.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 120,
                  fontSize: 12,
                  color: '#64748b',
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                {bucket.label}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 20,
                  background: '#f1f5f9',
                  borderRadius: 4,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: color,
                    borderRadius: 4,
                    transition: 'width 0.4s ease',
                    minWidth: bucket.count > 0 ? 4 : 0,
                  }}
                />
              </div>
              <span
                style={{
                  width: 36,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1e293b',
                  textAlign: 'right',
                }}
              >
                {bucket.count}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
