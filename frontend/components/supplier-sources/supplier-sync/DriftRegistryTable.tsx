'use client';

import type { DriftRow } from './types';

type Props = {
  rows: DriftRow[];
  loading?: boolean;
  emptyMessage?: string;
};

export function DriftRegistryTable({
  rows,
  loading = false,
  emptyMessage = 'No open drift records in registry.',
}: Props) {
  if (loading) {
    return <p className="text-sm text-gray-400">Updating reconciliation signals…</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm" data-testid="drift-registry-table">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
          <tr>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Severity</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">External ID</th>
            <th className="px-4 py-2">Age (h)</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-2 font-mono text-xs">{row.driftType}</td>
              <td className="px-4 py-2 font-semibold">{row.severity}</td>
              <td className="px-4 py-2">{row.status}</td>
              <td className="px-4 py-2">{row.externalSupplierId ?? '—'}</td>
              <td className="px-4 py-2">{row.ageHours ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
