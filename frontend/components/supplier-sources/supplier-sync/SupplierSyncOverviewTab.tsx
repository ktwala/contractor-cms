'use client';

import {
  SUPPLIER_SYNC_PAGE_QUESTIONS,
  SUPPLIER_SYNCHRONIZATION_NARRATIVE,
} from '@/lib/supplier-synchronization-labels';
import { SupplierSnapshotSummary } from './SupplierSnapshotPanels';
import { SupplierSyncActions } from './SupplierSyncActions';
import type { DashboardPayload, SupplierSyncTabId } from './types';
import { normalizeSupplierSyncDashboard } from './types';

type Props = {
  dashboard: DashboardPayload;
  canSync: boolean;
  onRefresh: () => void | Promise<void>;
  onNavigateTab: (tab: SupplierSyncTabId) => void;
};

export function SupplierSyncOverviewTab({
  dashboard: rawDashboard,
  canSync,
  onRefresh,
  onNavigateTab,
}: Props) {
  const dashboard = normalizeSupplierSyncDashboard(rawDashboard);
  const snapshots = dashboard.supplierDiscoverySnapshotHistory ?? [];
  const latest = snapshots.find((s) => s.isLatest) ?? snapshots[0] ?? null;

  return (
    <div className="space-y-6" data-testid="supplier-sync-tab-panel-overview">
      <header>
        <h2 className="text-base font-semibold text-gray-900">
          {SUPPLIER_SYNC_PAGE_QUESTIONS.overview}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {SUPPLIER_SYNCHRONIZATION_NARRATIVE.overviewFootnote}
        </p>
      </header>

      <SupplierSyncActions canSync={canSync} onComplete={onRefresh} />

      {latest ? (
        <SupplierSnapshotSummary
          snapshot={latest}
          onOpenGovernance={() => onNavigateTab('governance')}
        />
      ) : (
        <section
          className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-6"
          data-testid="latest-supplier-snapshot-empty"
        >
          <p className="text-sm text-gray-600">
            No supplier snapshot yet. Synchronize suppliers from Oracle Supplier Portal to create
            the first evidence snapshot.
          </p>
        </section>
      )}

      <p className="text-xs text-gray-500">{SUPPLIER_SYNCHRONIZATION_NARRATIVE.evidenceFootnote}</p>
    </div>
  );
}
