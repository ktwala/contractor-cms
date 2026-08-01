'use client';

import { History } from 'lucide-react';
import {
  WORKFORCE_DISCOVERY_PAGE_QUESTIONS,
  WORKFORCE_IMPORT_NARRATIVE,
  type WorkforceDiscoveryMetricLabels,
} from '@/lib/external-workforce-labels';
import {
  DiscoveryExceptionsPanel,
  DiscoverySnapshotHistoryTable,
  DiscoverySnapshotSummary,
  DiscoveryTechnicalDetails,
} from './DiscoverySnapshotPanels';
import { type DashboardPayload } from './types';

type Props = {
  dashboard: DashboardPayload;
  metricLabels: WorkforceDiscoveryMetricLabels;
};

export function WorkforceImportHistoryTab({ dashboard, metricLabels }: Props) {
  const snapshots = dashboard.discoverySnapshotHistory ?? [];
  const latest = snapshots.find((s) => s.isLatest) ?? snapshots[0] ?? null;

  return (
    <div className="space-y-8" data-testid="workforce-import-tab-panel-history">
      <header>
        <h2 className="text-base font-semibold text-gray-900">
          {WORKFORCE_DISCOVERY_PAGE_QUESTIONS.history}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{WORKFORCE_IMPORT_NARRATIVE.historyFootnote}</p>
      </header>

      {latest ? (
        <>
          <section data-testid="latest-snapshot-section">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Latest workforce snapshot</h3>
            <DiscoverySnapshotSummary snapshot={latest} metricLabels={metricLabels} />
          </section>

          <DiscoveryExceptionsPanel
            exceptionCount={latest.discoveryExceptions}
            metricLabels={metricLabels}
          />
        </>
      ) : (
        <p className="text-sm text-gray-500">No workforce snapshots yet. Run discovery on the Overview tab.</p>
      )}

      <section data-testid="previous-snapshots-section">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-sky-600" />
          Previous snapshots
        </h2>
        <DiscoverySnapshotHistoryTable
          snapshots={snapshots}
          excludeLatest
          metricLabels={metricLabels}
        />
      </section>

      <DiscoveryTechnicalDetails sync={dashboard.syncTelemetry} />
    </div>
  );
}
