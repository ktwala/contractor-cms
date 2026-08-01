'use client';

import { History } from 'lucide-react';
import {
  SUPPLIER_SYNC_PAGE_QUESTIONS,
  SUPPLIER_SYNCHRONIZATION_NARRATIVE,
} from '@/lib/supplier-synchronization-labels';
import {
  SupplierDiscoveryExceptionsPanel,
  SupplierSnapshotHistoryTable,
  SupplierSnapshotSummary,
  SupplierSyncTechnicalDetails,
} from './SupplierSnapshotPanels';
import { type DashboardPayload } from './types';
import { normalizeSupplierSyncDashboard } from './types';

type Props = {
  dashboard: DashboardPayload;
};

export function SupplierSyncHistoryTab({ dashboard: rawDashboard }: Props) {
  const dashboard = normalizeSupplierSyncDashboard(rawDashboard);
  const snapshots = dashboard.supplierDiscoverySnapshotHistory ?? [];
  const latest = snapshots.find((s) => s.isLatest) ?? snapshots[0] ?? null;

  return (
    <div className="space-y-8" data-testid="supplier-sync-tab-panel-history">
      <header>
        <h2 className="text-base font-semibold text-gray-900">
          {SUPPLIER_SYNC_PAGE_QUESTIONS.history}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {SUPPLIER_SYNCHRONIZATION_NARRATIVE.historyFootnote}
        </p>
      </header>

      {latest ? (
        <>
          <section data-testid="latest-supplier-snapshot-section">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Latest supplier snapshot</h3>
            <SupplierSnapshotSummary snapshot={latest} />
          </section>

          <SupplierDiscoveryExceptionsPanel exceptionCount={latest.discoveryExceptions} />
        </>
      ) : (
        <p className="text-sm text-gray-500">
          No supplier snapshots yet. Synchronize suppliers on the Overview tab.
        </p>
      )}

      <section data-testid="previous-supplier-snapshots-section">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-sky-600" />
          Previous snapshots
        </h2>
        <SupplierSnapshotHistoryTable snapshots={snapshots} excludeLatest />
      </section>

      <SupplierSyncTechnicalDetails sync={dashboard.syncTelemetry} />
    </div>
  );
}
