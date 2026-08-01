'use client';

import { useEffect, useState } from 'react';
import { GitBranch, History } from 'lucide-react';
import { api } from '@/lib/api';
import WorkforceCutoverPanel from '@/components/contractor-sources/WorkforceCutoverPanel';
import { WORKFORCE_IMPORT_NARRATIVE } from '@/lib/external-workforce-labels';
import { DriftRegistryTable } from './DriftRegistryTable';
import { isPastCutover, sortDriftRows, type DashboardPayload, type DriftRow } from './types';

type Props = {
  dashboard: DashboardPayload;
  canCutover: boolean;
  onCutoverChanged: () => void | Promise<void>;
  driftRefreshKey: number;
};

export function WorkforceImportCutoverTab({
  dashboard,
  canCutover,
  onCutoverChanged,
  driftRefreshKey,
}: Props) {
  const cutoverAt = dashboard.workforceMigrationCutoverAt;
  const pastCutover = isPastCutover(cutoverAt);
  /** false = show migration lineage ON; true = operational-only (default) */
  const [operationalOnly, setOperationalOnly] = useState(true);
  const [lineageRows, setLineageRows] = useState<DriftRow[]>([]);
  const [lineageLoading, setLineageLoading] = useState(false);
  const showMigrationLineage = !operationalOnly;

  useEffect(() => {
    if (operationalOnly) {
      setLineageRows([]);
      return;
    }

    let cancelled = false;
    async function fetchLineageDrifts() {
      setLineageLoading(true);
      try {
        const drifts = await api.listOracleHcmSourceDrift({
          page: 1,
          limit: 15,
          operationalOnly: false,
        });
        if (!cancelled) {
          setLineageRows(sortDriftRows(drifts.data ?? []));
        }
      } catch {
        if (!cancelled) setLineageRows([]);
      } finally {
        if (!cancelled) setLineageLoading(false);
      }
    }

    fetchLineageDrifts();
    return () => {
      cancelled = true;
    };
  }, [operationalOnly, driftRefreshKey]);

  return (
    <div className="space-y-8" data-testid="workforce-import-tab-panel-cutover">
      {pastCutover ? (
        <div
          className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800"
          role="status"
          data-testid="cutover-banner"
        >
          Post-cutover — operational governance prioritized; bootstrap lineage hidden by default.
        </div>
      ) : cutoverAt ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
          data-testid="cutover-banner"
        >
          Pre-cutover — bootstrap governance remains active until cutover date (
          {new Date(cutoverAt).toLocaleDateString()}).
        </div>
      ) : (
        <div
          className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800"
          role="status"
          data-testid="cutover-banner"
        >
          Bootstrap lineage visible — workforce cutover not declared.
        </div>
      )}

      <WorkforceCutoverPanel canManage={canCutover} onCutoverChanged={onCutoverChanged} />

      <section className="card" data-testid="migration-lineage-section">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-violet-600" />
              Migration lineage
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Bootstrap import signals from the HCM migration period. Hidden by default after
              cutover.
            </p>
          </div>
          <button
            id="toggle-migration-lineage"
            type="button"
            aria-pressed={showMigrationLineage}
            onClick={() => setOperationalOnly((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              showMigrationLineage
                ? 'border-violet-400 bg-violet-50 text-violet-800'
                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
            }`}
            data-testid="migration-lineage-toggle"
          >
            <GitBranch className="w-4 h-4" aria-hidden />
            Show migration lineage
            {showMigrationLineage && (
              <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-violet-500" />
            )}
          </button>
        </div>

        {showMigrationLineage ? (
          <DriftRegistryTable
            rows={lineageRows}
            loading={lineageLoading}
            emptyMessage="No bootstrap lineage signals in registry."
          />
        ) : (
          <p className="text-sm text-gray-500">
            Enable migration lineage to review bootstrap import evidence and archived signals.
          </p>
        )}
      </section>

      <section className="card" data-testid="historical-import-evidence">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-gray-600" />
          Historical import evidence
        </h2>
        <p className="text-sm text-gray-600">
          {WORKFORCE_IMPORT_NARRATIVE.importLedgerFootnote} Use Discovery History for run
          details, failures, and performance trends.
        </p>
        <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Total import runs</dt>
            <dd className="font-semibold mt-1">{dashboard.syncTelemetry.totalSyncRuns}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Bootstrap workers imported</dt>
            <dd className="font-semibold mt-1">{dashboard.syncTelemetry.workersImported}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Cutover date</dt>
            <dd className="font-semibold mt-1">
              {cutoverAt ? new Date(cutoverAt).toLocaleDateString() : 'Not declared'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Governance phase</dt>
            <dd className="font-semibold mt-1">
              {pastCutover ? 'Post-cutover' : cutoverAt ? 'Pre-cutover' : 'Bootstrap'}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
