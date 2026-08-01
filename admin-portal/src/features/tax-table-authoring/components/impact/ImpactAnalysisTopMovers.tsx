import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../../../../ui/layout';

interface Props {
  biggestIncrease: { employeeId: string; amount: number } | null;
  biggestDecrease: { employeeId: string; amount: number } | null;
  rows: Array<{
    employeeId: string;
    employeeName: string | null;
    deltaPaye: number;
    direction: string;
  }>;
  currency: string;
}

export function ImpactAnalysisTopMovers({ biggestIncrease, biggestDecrease, rows, currency }: Props) {
  const topIncreases = [...rows]
    .filter((r) => r.direction === 'INCREASE')
    .sort((a, b) => b.deltaPaye - a.deltaPaye)
    .slice(0, 5);

  const topDecreases = [...rows]
    .filter((r) => r.direction === 'DECREASE')
    .sort((a, b) => a.deltaPaye - b.deltaPaye)
    .slice(0, 5);

  return (
    <Card>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#1e293b' }}>
        Top Movers
      </div>

      {biggestIncrease && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 10px', background: '#fef2f2', borderRadius: 8 }}>
          <TrendingUp size={16} style={{ color: '#dc2626' }} />
          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: '#991b1b' }}>Biggest increase:</span>{' '}
            <span style={{ color: '#dc2626' }}>{currency}{biggestIncrease.amount.toLocaleString()}</span>
          </div>
        </div>
      )}

      {biggestDecrease && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 10px', background: '#f0fdf4', borderRadius: 8 }}>
          <TrendingDown size={16} style={{ color: '#059669' }} />
          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: '#065f46' }}>Biggest decrease:</span>{' '}
            <span style={{ color: '#059669' }}>{currency}{Math.abs(biggestDecrease.amount).toLocaleString()}</span>
          </div>
        </div>
      )}

      {topIncreases.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Top Increases</div>
          {topIncreases.map((r) => (
            <div key={r.employeeId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: '#64748b' }}>
              <span>{r.employeeName ?? r.employeeId.slice(0, 8)}</span>
              <span style={{ color: '#dc2626', fontWeight: 500 }}>+{currency}{r.deltaPaye.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {topDecreases.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginBottom: 4 }}>Top Decreases</div>
          {topDecreases.map((r) => (
            <div key={r.employeeId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: '#64748b' }}>
              <span>{r.employeeName ?? r.employeeId.slice(0, 8)}</span>
              <span style={{ color: '#059669', fontWeight: 500 }}>-{currency}{Math.abs(r.deltaPaye).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {!biggestIncrease && !biggestDecrease && (
        <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 16 }}>
          No affected employees
        </div>
      )}
    </Card>
  );
}
