'use client';

import {
  WORKFORCE_DISCOVERY_PAGE_QUESTIONS,
  WORKFORCE_IMPORT_NARRATIVE,
  type WorkforceDiscoveryMetricLabels,
} from '@/lib/external-workforce-labels';
import { DiscoverySnapshotSummary } from './DiscoverySnapshotPanels';
import { WorkforceImportActions } from './WorkforceImportActions';
import type { DashboardPayload, WorkforceImportTabId } from './types';

type Props = {
  dashboard: DashboardPayload;
  canBootstrap: boolean;
  onRefresh: () => void | Promise<void>;
  onNavigateTab: (tab: WorkforceImportTabId) => void;
  metricLabels: WorkforceDiscoveryMetricLabels;
};

export function WorkforceImportOverviewTab({
  dashboard,
  canBootstrap,
  onRefresh,
  onNavigateTab,
  metricLabels,
}: Props) {
  const snapshots = dashboard.discoverySnapshotHistory ?? [];
  const latest = snapshots.find((s) => s.isLatest) ?? snapshots[0] ?? null;

  return (
    <div className="space-y-6" data-testid="workforce-import-tab-panel-overview">
      <header>
        <h2 className="text-base font-semibold text-gray-900">
          {WORKFORCE_DISCOVERY_PAGE_QUESTIONS.overview}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{WORKFORCE_IMPORT_NARRATIVE.overviewFootnote}</p>
      </header>

      <WorkforceImportActions canBootstrap={canBootstrap} onComplete={onRefresh} />

      {latest ? (
        <DiscoverySnapshotSummary
          snapshot={latest}
          onOpenGovernance={() => onNavigateTab('governance')}
          metricLabels={metricLabels}
        />
      ) : (
        <section
          className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-6"
          data-testid="latest-discovery-summary"
        >
          <p className="text-sm text-gray-600">
            No workforce snapshot yet. Discover workforce from Oracle HCM to create the first evidence
            snapshot.
          </p>
        </section>
      )}

      <p className="text-xs text-gray-500">{WORKFORCE_IMPORT_NARRATIVE.evidenceFootnote}</p>
    </div>
  );
}
