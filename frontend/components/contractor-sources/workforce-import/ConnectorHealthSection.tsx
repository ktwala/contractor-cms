'use client';

import { Activity } from 'lucide-react';
import { healthBadgeClass, formatRelativeTime, type DashboardPayload } from './types';

type Props = {
  health: DashboardPayload['connectorHealth'];
};

export function ConnectorHealthSection({ health }: Props) {
  return (
    <section className="card border-l-4 border-l-violet-500" data-testid="connector-health-section">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-600" />
            Connector health
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            REST connector truth (replay success does not imply HEALTHY)
          </p>
        </div>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${healthBadgeClass(health.health)}`}
          data-testid="connector-health-badge"
        >
          {health.health}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-gray-500">Connector status</dt>
          <dd className="font-medium">{health.health}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Last successful discovery</dt>
          <dd className="font-medium">{formatRelativeTime(health.lastSuccessfulSyncAt)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">REST connector enabled</dt>
          <dd className="font-medium">{health.restEnabled ? 'Yes' : 'No (file replay only)'}</dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="text-gray-500">Last connector error</dt>
          <dd className="font-medium truncate">{health.lastError ?? '—'}</dd>
        </div>
      </dl>
      {health.isStale && (
        <p
          className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2"
          role="status"
        >
          REST sync data is stale (threshold: {health.staleThresholdHours}h).
        </p>
      )}
    </section>
  );
}
