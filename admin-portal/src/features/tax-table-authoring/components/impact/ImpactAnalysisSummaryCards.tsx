import React from 'react';
import { Users, TrendingUp, TrendingDown, Equal } from 'lucide-react';

interface Props {
  summary: {
    employeesAnalyzed: number;
    employeesAffected: number;
    employeesUnchanged: number;
    employeesSkipped: number;
    totalBaselinePaye: number;
    totalDraftPaye: number;
    totalPayeDelta: number;
    averageDeltaAll: number;
    averageDeltaAffected: number;
  };
  currency: string;
}

export function ImpactAnalysisSummaryCards({ summary, currency }: Props) {
  const cards = [
    {
      label: 'Employees Analyzed',
      value: summary.employeesAnalyzed.toLocaleString(),
      icon: <Users size={18} />,
      color: '#4f46e5',
      bg: '#eef2ff',
    },
    {
      label: 'Affected',
      value: summary.employeesAffected.toLocaleString(),
      icon: <TrendingUp size={18} />,
      color: summary.employeesAffected > 0 ? '#dc2626' : '#059669',
      bg: summary.employeesAffected > 0 ? '#fef2f2' : '#f0fdf4',
    },
    {
      label: 'Total PAYE Delta',
      value: `${currency}${Math.abs(summary.totalPayeDelta).toLocaleString()}`,
      icon: summary.totalPayeDelta >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />,
      color: summary.totalPayeDelta > 0 ? '#dc2626' : summary.totalPayeDelta < 0 ? '#059669' : '#64748b',
      bg: summary.totalPayeDelta > 0 ? '#fef2f2' : summary.totalPayeDelta < 0 ? '#f0fdf4' : '#f8fafc',
      suffix: summary.totalPayeDelta > 0 ? ' increase' : summary.totalPayeDelta < 0 ? ' decrease' : '',
    },
    {
      label: 'Avg Delta (Affected)',
      value: `${currency}${Math.abs(summary.averageDeltaAffected).toLocaleString()}`,
      icon: <Equal size={18} />,
      color: '#64748b',
      bg: '#f8fafc',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{card.label}</span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: card.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: card.color,
              }}
            >
              {card.icon}
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>
            {card.value}
          </div>
          {'suffix' in card && card.suffix && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{card.suffix}</div>
          )}
        </div>
      ))}
    </div>
  );
}
