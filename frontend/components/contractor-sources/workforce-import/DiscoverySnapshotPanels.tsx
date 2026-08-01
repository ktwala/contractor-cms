'use client';

import {
  EXTERNAL_WORKFORCE_LABELS,
  resolveWorkforceDiscoveryMetrics,
  type WorkforceDiscoveryMetricLabels,
  WORKFORCE_DISCOVERY_METRICS,
} from '@/lib/external-workforce-labels';
import type { DiscoverySnapshotHistoryItem } from './types';

type Props = {
  snapshot: DiscoverySnapshotHistoryItem;
  compact?: boolean;
  onOpenGovernance?: () => void;
  metricLabels?: WorkforceDiscoveryMetricLabels;
};

function defaultMetricLabels(): WorkforceDiscoveryMetricLabels {
  return WORKFORCE_DISCOVERY_METRICS;
}

function formatSnapshotDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function assessmentBadgeClass(label: DiscoverySnapshotHistoryItem['assessmentLabel']): string {
  switch (label) {
    case 'Assessed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Pending':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function DiscoverySnapshotSummary({
  snapshot,
  compact,
  onOpenGovernance,
  metricLabels = defaultMetricLabels(),
}: Props) {
  return (
    <div
      className="rounded-lg border bg-white p-5 shadow-sm"
      data-testid={snapshot.isLatest ? 'latest-workforce-snapshot' : `snapshot-${snapshot.snapshotRef}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Snapshot</p>
          <p className="text-2xl font-bold font-mono text-gray-900 mt-1">{snapshot.snapshotRef}</p>
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Created</dt>
              <dd className="font-medium mt-0.5">{formatSnapshotDate(snapshot.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Source</dt>
              <dd className="font-medium mt-0.5">{snapshot.source}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className="font-medium mt-0.5">{snapshot.status}</dd>
            </div>
            <div>
              <dt className="text-gray-500">{metricLabels.workersDiscovered}</dt>
              <dd className="font-medium mt-0.5">{snapshot.workersDiscovered}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Assessment</dt>
              <dd className="mt-0.5">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${assessmentBadgeClass(snapshot.assessmentLabel)}`}
                >
                  {snapshot.assessmentLabel}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {!compact ? (
          <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-4 min-w-[240px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">
              What changed in this snapshot?
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                [metricLabels.newWorkers, snapshot.newWorkers],
                [metricLabels.updatedWorkers, snapshot.updatedWorkers],
                [metricLabels.unchangedWorkers, snapshot.unchangedWorkers],
                [metricLabels.discoveryRunFailed, snapshot.failedWorkers],
                ...(snapshot.discoveryExceptions > 0
                  ? [[metricLabels.discoveryConflict, snapshot.discoveryExceptions] as const]
                  : []),
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="text-lg font-bold mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      {snapshot.assessmentLabel === 'Pending' && onOpenGovernance ? (
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-600">
            This snapshot is ready for{' '}
            <span className="font-medium">{EXTERNAL_WORKFORCE_LABELS.assessWorkforce.toLowerCase()}</span>{' '}
            on the Governance tab.
          </p>
          <button
            type="button"
            onClick={onOpenGovernance}
            className="text-sm font-medium text-violet-700 hover:text-violet-900"
            data-testid="open-governance-from-snapshot"
          >
            Open Governance →
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function DiscoverySnapshotHistoryTable({
  snapshots,
  excludeLatest = true,
  metricLabels = defaultMetricLabels(),
}: {
  snapshots: DiscoverySnapshotHistoryItem[];
  excludeLatest?: boolean;
  metricLabels?: WorkforceDiscoveryMetricLabels;
}) {
  const rows = excludeLatest ? snapshots.filter((s) => !s.isLatest) : snapshots;

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No previous snapshots yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm" data-testid="discovery-snapshot-history-table">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
          <tr>
            <th className="px-4 py-2">Snapshot</th>
            <th className="px-4 py-2">Created</th>
            <th className="px-4 py-2">{metricLabels.workersDiscovered}</th>
            <th className="px-4 py-2">{metricLabels.newWorkers}</th>
            <th className="px-4 py-2">{metricLabels.updatedWorkers}</th>
            <th className="px-4 py-2">Assessment</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((snapshot) => (
            <tr key={snapshot.id}>
              <td className="px-4 py-2 font-mono font-medium">{snapshot.snapshotRef}</td>
              <td className="px-4 py-2">{formatSnapshotDate(snapshot.createdAt)}</td>
              <td className="px-4 py-2">{snapshot.workersDiscovered}</td>
              <td className="px-4 py-2">{snapshot.newWorkers}</td>
              <td className="px-4 py-2">{snapshot.updatedWorkers}</td>
              <td className="px-4 py-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${assessmentBadgeClass(snapshot.assessmentLabel)}`}
                >
                  {snapshot.assessmentLabel}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DiscoveryExceptionsPanel({
  exceptionCount,
  metricLabels = defaultMetricLabels(),
}: {
  exceptionCount: number;
  metricLabels?: WorkforceDiscoveryMetricLabels;
}) {
  return (
    <section data-testid="discovery-exceptions-section">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">
        {metricLabels.discoveryExceptions}
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Records Oracle HCM sent that could not be matched during discovery — not governance resolution.
      </p>
      {exceptionCount === 0 ? (
        <p className="text-sm text-gray-600">None</p>
      ) : (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
          {exceptionCount} discovery exception{exceptionCount === 1 ? '' : 's'} in the latest snapshot.
        </p>
      )}
    </section>
  );
}

export function DiscoveryTechnicalDetails({
  sync,
}: {
  sync: {
    totalSyncRuns: number;
    successfulSyncRuns: number;
    failedSyncRuns: number;
    lastSyncDurationMs: number | null;
  };
}) {
  return (
    <details className="rounded-lg border bg-white p-4" data-testid="discovery-technical-details">
      <summary className="text-sm font-medium text-gray-700 cursor-pointer">
        Technical details (connector execution)
      </summary>
      <p className="text-xs text-gray-500 mt-3 mb-4">
        Connector health and run timings belong in Administration → Connectors. Shown here for engineering
        troubleshooting only.
      </p>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <dt className="text-gray-500">Total runs</dt>
          <dd className="font-semibold mt-1">{sync.totalSyncRuns}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Succeeded</dt>
          <dd className="font-semibold mt-1">{sync.successfulSyncRuns}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Failed</dt>
          <dd className="font-semibold mt-1">{sync.failedSyncRuns}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Last duration</dt>
          <dd className="font-semibold mt-1">
            {sync.lastSyncDurationMs != null ? `${sync.lastSyncDurationMs}ms` : '—'}
          </dd>
        </div>
      </dl>
    </details>
  );
}
