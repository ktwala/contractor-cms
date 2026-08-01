import React from 'react';
import { spacing } from '../../styles/tokens';
import * as styles from '../../styles/common';

interface DataTableProps {
  columns: { key: string; label: string }[];
  rows: Record<string, React.ReactNode>[];
  emptyMessage?: string;
}

export default function DataTable({ columns, rows, emptyMessage = 'No data' }: DataTableProps) {
  return (
    <table style={{ ...styles.table, width: '100%' }}>
      <thead style={styles.tableHeader}>
        <tr style={styles.tableRow}>
          {columns.map((c) => (
            <th key={c.key} style={styles.tableHeaderCell}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} style={{ ...styles.emptyState, padding: '2rem' }}>
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i} style={{ ...styles.tableRow, minHeight: spacing.tableRowHeight }}>
              {columns.map((c) => (
                <td key={c.key} style={{ ...styles.tableCell, minHeight: spacing.tableRowHeight }}>
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
