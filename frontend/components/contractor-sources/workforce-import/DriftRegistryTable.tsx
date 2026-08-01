'use client';

import { GitBranch } from 'lucide-react';
import { formatDriftTypeLabel } from '@/lib/operational-governance-labels';
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
    return <p className="text-sm text-gray-400">Updating governance signals…</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm" data-testid="workforce-drift-registry-table">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
          <tr>
            <th className="px-4 py-2">Governance signal</th>
            <th className="px-4 py-2">Severity</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">HCM person</th>
            <th className="px-4 py-2">Age (h)</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const isBootstrap = row.signalCategory === 'BOOTSTRAP';
            const lifecycleState = row.signalLifecycleState ?? 'ACTIVE';
            const isDecaying = lifecycleState === 'DECAYING';
            const isArchived = lifecycleState === 'ARCHIVED';

            const rowClass = isArchived
              ? 'bg-gray-50 opacity-60 italic'
              : isDecaying
                ? 'bg-amber-50/30'
                : isBootstrap
                  ? 'bg-violet-50/40'
                  : undefined;

            const rowTestId = isBootstrap
              ? `drift-row-bootstrap${isArchived ? '-archived' : isDecaying ? '-decaying' : ''}`
              : 'drift-row-operational';

            return (
              <tr key={row.id} data-testid={rowTestId} className={rowClass}>
                <td className="px-4 py-2">
                  {row.driftTypeLabel ?? formatDriftTypeLabel(row.driftType)}
                  {isBootstrap && isArchived && (
                    <span
                      className="ml-2 inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 not-italic"
                      data-testid="archived-lineage-badge"
                    >
                      <GitBranch className="w-3 h-3 mr-1" aria-hidden />
                      Archived lineage
                    </span>
                  )}
                  {isBootstrap && !isArchived && (
                    <span
                      className="ml-2 inline-flex items-center rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 not-italic"
                      data-testid="bootstrap-lineage-badge"
                    >
                      <GitBranch className="w-3 h-3 mr-1" aria-hidden />
                      migration lineage
                    </span>
                  )}
                  {isDecaying && (
                    <span
                      className="ml-1 inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 not-italic"
                      data-testid="decaying-badge"
                    >
                      Decaying
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 font-semibold">{row.severity}</td>
                <td className="px-4 py-2">{row.status}</td>
                <td className="px-4 py-2">{row.sourcePersonId ?? '—'}</td>
                <td className="px-4 py-2">{row.ageHours ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
