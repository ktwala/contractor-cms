import React, { useState } from 'react';
import * as styles from '../../../../styles/common';
import { Card } from '../../../../ui/layout';

type Row = {
  employeeId: string;
  employeeNumber: string | null;
  employeeName: string | null;
  legalEntityName: string | null;
  payGroupName: string | null;
  taxableEarnings: number;
  baselinePaye: number;
  draftPaye: number;
  deltaPaye: number;
  absoluteDelta: number;
  direction: 'INCREASE' | 'DECREASE' | 'UNCHANGED';
};

interface Props {
  rows: Row[];
  currency: string;
}

type SortKey = 'employeeName' | 'taxableEarnings' | 'deltaPaye' | 'absoluteDelta';

const DIRECTION_STYLE: Record<string, React.CSSProperties> = {
  INCREASE: { color: '#dc2626', fontWeight: 600 },
  DECREASE: { color: '#059669', fontWeight: 600 },
  UNCHANGED: { color: '#94a3b8' },
};

export function ImpactAnalysisResultsTable({ rows, currency }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('absoluteDelta');
  const [sortDesc, setSortDesc] = useState(true);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
    return sortDesc ? -cmp : cmp;
  });

  const arrow = (key: SortKey) => (sortKey === key ? (sortDesc ? ' ↓' : ' ↑') : '');

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
          Employee Results ({rows.length})
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ ...styles.table, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={styles.th}>Emp No</th>
              <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => handleSort('employeeName')}>
                Name{arrow('employeeName')}
              </th>
              <th style={styles.th}>Pay Group</th>
              <th style={{ ...styles.th, cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('taxableEarnings')}>
                Taxable{arrow('taxableEarnings')}
              </th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Current PAYE</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Draft PAYE</th>
              <th style={{ ...styles.th, cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('deltaPaye')}>
                Delta{arrow('deltaPaye')}
              </th>
              <th style={styles.th}>Impact</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.employeeId} style={styles.tr}>
                <td style={styles.td}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {row.employeeNumber ?? row.employeeId.slice(0, 8)}
                  </span>
                </td>
                <td style={styles.td}>{row.employeeName ?? '—'}</td>
                <td style={styles.td}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {row.payGroupName ?? '—'}
                  </span>
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  {currency}{row.taxableEarnings.toLocaleString()}
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  {currency}{row.baselinePaye.toLocaleString()}
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  {currency}{row.draftPaye.toLocaleString()}
                </td>
                <td style={{ ...styles.td, textAlign: 'right', ...DIRECTION_STYLE[row.direction] }}>
                  {row.direction === 'INCREASE' ? '+' : row.direction === 'DECREASE' ? '-' : ''}
                  {currency}{Math.abs(row.deltaPaye).toLocaleString()}
                </td>
                <td style={styles.td}>
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background:
                        row.direction === 'INCREASE'
                          ? '#fef2f2'
                          : row.direction === 'DECREASE'
                            ? '#f0fdf4'
                            : '#f8fafc',
                      color:
                        row.direction === 'INCREASE'
                          ? '#dc2626'
                          : row.direction === 'DECREASE'
                            ? '#059669'
                            : '#94a3b8',
                    }}
                  >
                    {row.direction}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
