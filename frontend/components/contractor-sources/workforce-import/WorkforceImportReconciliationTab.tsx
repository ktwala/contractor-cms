'use client';

import { GitCompare } from 'lucide-react';
import {
  SUPPLIER_RECONCILIATION_LABELS,
  SUPPLIER_RECONCILIATION_NARRATIVE,
} from '@/lib/supplier-reconciliation-labels';
import { SupplierReferenceReconciliationQueue } from './SupplierReferenceReconciliationQueue';
import type { DashboardPayload } from './types';

type Props = {
  dashboard: DashboardPayload;
};

export function WorkforceImportReconciliationTab({ dashboard }: Props) {
  const assessment = dashboard.workforceAssessment ?? {
    lifecyclePhase: 'DISCOVERY_PENDING' as const,
    canRunAssessment: false,
    latestDiscoveryRun: null,
    lastAssessment: null,
    findingsSnapshotRef: null,
  };
  const findingsSnapshotRef =
    assessment.findingsSnapshotRef ?? assessment.lastAssessment?.snapshotRef ?? null;
  const assessmentIsPending = assessment.lifecyclePhase === 'ASSESSMENT_PENDING';
  const showAssessmentOutputs = assessment.lifecyclePhase === 'ASSESSMENT_CURRENT';

  return (
    <div className="space-y-6" data-testid="workforce-import-tab-panel-reconciliation">
      <header>
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-indigo-600" aria-hidden />
          {SUPPLIER_RECONCILIATION_LABELS.pageTitle}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {SUPPLIER_RECONCILIATION_NARRATIVE.pageQuestion}
        </p>
        {findingsSnapshotRef ? (
          <p className="text-xs text-gray-500 mt-1">
            {SUPPLIER_RECONCILIATION_NARRATIVE.basedOnDiscoverySnapshot(findingsSnapshotRef)}
          </p>
        ) : null}
      </header>

      <section data-testid="reconciliation-work-queue-section">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {SUPPLIER_RECONCILIATION_LABELS.sectionTitle}
          </h3>
          <p className="text-xs text-gray-500 mt-2">
            {SUPPLIER_RECONCILIATION_NARRATIVE.footnote}
          </p>
        </div>

        {showAssessmentOutputs ? (
          <SupplierReferenceReconciliationQueue />
        ) : assessmentIsPending ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-6">
            <p className="text-sm font-medium text-gray-800">
              {SUPPLIER_RECONCILIATION_NARRATIVE.pendingAssessmentTitle}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {SUPPLIER_RECONCILIATION_NARRATIVE.pendingAssessmentBody}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {SUPPLIER_RECONCILIATION_NARRATIVE.discoveryRequired}
          </p>
        )}
      </section>
    </div>
  );
}
