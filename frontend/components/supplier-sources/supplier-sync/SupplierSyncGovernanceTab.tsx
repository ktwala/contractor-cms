'use client';

import { useState } from 'react';
import Link from 'next/link';
import { OPERATIONAL_TRUST_LABELS } from '@/lib/operational-trust-labels';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Link2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { DEMO_SUPPLIER_ADMIN_EMAIL, isConnectorDemoUiEnabled } from '@/lib/demo-mode';
import type { TenantAuthorityProfile } from '@/lib/tenant-authority';
import { supplierGovernanceBucketHref } from '@/lib/supplier-governance-navigation';
import {
  SUPPLIER_SYNCHRONIZATION_LABELS,
  SUPPLIER_SYNCHRONIZATION_NARRATIVE,
} from '@/lib/supplier-synchronization-labels';
import { Button } from '@/components/ui/button';
import { formatRelativeTime, normalizeSupplierSyncDashboard, type DashboardPayload } from './types';
import { OperationalSupplierReviewTable } from './OperationalSupplierReviewTable';

type Props = {
  dashboard: DashboardPayload;
  canSync: boolean;
  canRunAssessment: boolean;
  detecting: boolean;
  onAssess: () => void | Promise<void>;
  canOpenApprovalsQueue: boolean;
  canAssignPortalMembership: boolean;
  tenantAuthority?: TenantAuthorityProfile | null;
};

export function SupplierSyncGovernanceTab({
  dashboard: rawDashboard,
  canSync,
  canRunAssessment,
  detecting,
  onAssess,
  canOpenApprovalsQueue,
  canAssignPortalMembership,
  tenantAuthority,
}: Props) {
  const dashboard = normalizeSupplierSyncDashboard(rawDashboard);
  const gov = dashboard.governanceTelemetry;
  const assessment = dashboard.supplierSyncAssessment ?? {
    lifecyclePhase: 'SYNCHRONIZATION_PENDING' as const,
    canRunAssessment: false,
    latestSyncRun: null,
    lastAssessment: null,
    findingsSnapshotRef: null,
  };
  const findingsSnapshotRef =
    assessment.findingsSnapshotRef ?? assessment.lastAssessment?.snapshotRef ?? null;
  const assessmentIsCurrent = assessment.lifecyclePhase === 'ASSESSMENT_CURRENT';
  const assessmentIsPending = assessment.lifecyclePhase === 'ASSESSMENT_PENDING';
  const showAssessmentOutputs = assessmentIsCurrent;
  const awaitingAssessmentCount =
    assessment.latestSyncRun?.importedCount ?? gov.pendingEvidenceSuppliers;
  const [busy, setBusy] = useState<string | null>(null);
  const [demoMessage, setDemoMessage] = useState('');

  const completeMtnDemoStory = async () => {
    try {
      setBusy('setup');
      setDemoMessage('');
      const result = await api.completeMtnDemoStory();
      const supplierLines = result.suppliers
        .map((s) => `${s.tradingName} (${s.portalAdminEmail})`)
        .join(' · ');
      setDemoMessage(
        `MTN demo story complete — ${result.suppliers.length} suppliers active with framework agreements. ` +
          `Materialized ${result.materialized.created} workers, ${result.sponsoredWorkers} sponsored, ` +
          `${result.skippedMissingResponsibleManagerWorkers} without Responsible Manager by design. ` +
          `Portal admins: ${supplierLines}. Run workforce assessment next.`,
      );
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : e instanceof Error
            ? e.message
            : 'Could not complete MTN demo story';
      setDemoMessage(msg || 'Could not complete MTN demo story');
    } finally {
      setBusy(null);
    }
  };

  const buckets = dashboard.governanceBuckets;

  const tiles = [
    {
      label: SUPPLIER_SYNCHRONIZATION_LABELS.synchronizedSuppliers,
      value: dashboard.oracleLinkedTotal,
      href: supplierGovernanceBucketHref('synced', tenantAuthority),
    },
    {
      label: SUPPLIER_SYNCHRONIZATION_LABELS.governedSuppliers,
      value: buckets.active,
      href: supplierGovernanceBucketHref('active', tenantAuthority),
    },
    {
      label: SUPPLIER_SYNCHRONIZATION_LABELS.pendingApproval,
      value: buckets.pendingEvidence ?? 0,
      href: supplierGovernanceBucketHref('pendingEvidence', tenantAuthority),
    },
    {
      label: SUPPLIER_SYNCHRONIZATION_LABELS.suspendedSuppliers,
      value: buckets.suspended ?? 0,
      href: supplierGovernanceBucketHref('suspended', tenantAuthority),
    },
  ];

  return (
    <div className="space-y-8" data-testid="supplier-sync-tab-panel-governance">
      <section
        className="rounded-lg border bg-white p-5"
        data-testid="supplier-assessment-status-section"
      >
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          {SUPPLIER_SYNCHRONIZATION_LABELS.assessmentStatus}
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          {SUPPLIER_SYNCHRONIZATION_NARRATIVE.assessmentFootnote}
        </p>

        {assessmentIsCurrent ? (
          <div className="flex items-start gap-3 text-green-800">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold">{SUPPLIER_SYNCHRONIZATION_LABELS.assessmentUpToDate}</p>
              {assessment.lastAssessment ? (
                <p className="text-sm text-gray-600 mt-1">
                  {SUPPLIER_SYNCHRONIZATION_LABELS.lastAssessed}{' '}
                  {formatRelativeTime(assessment.lastAssessment.assessedAt)}
                </p>
              ) : null}
              {findingsSnapshotRef ? (
                <p className="text-sm text-gray-600">
                  {SUPPLIER_SYNCHRONIZATION_LABELS.supplierSnapshot}:{' '}
                  <span className="font-mono">{findingsSnapshotRef}</span>
                </p>
              ) : null}
              <p className="text-xs text-gray-500 mt-2">
                {SUPPLIER_SYNCHRONIZATION_NARRATIVE.assessmentCurrentFootnote}
              </p>
            </div>
          </div>
        ) : assessmentIsPending ? (
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3 text-amber-900">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="font-semibold">
                  {SUPPLIER_SYNCHRONIZATION_LABELS.newSuppliersSynchronized}
                </p>
                {assessment.latestSyncRun ? (
                  <p className="text-sm text-gray-600 mt-1">
                    {SUPPLIER_SYNCHRONIZATION_LABELS.supplierSnapshot}:{' '}
                    <span className="font-mono">{assessment.latestSyncRun.snapshotRef}</span>
                    {' · '}
                    {assessment.latestSyncRun.importedCount} supplier record(s) discovered
                  </p>
                ) : null}
                <p className="text-xs text-gray-500 mt-2">
                  {SUPPLIER_SYNCHRONIZATION_NARRATIVE.assessmentPendingFootnote}
                </p>
              </div>
            </div>
            {canRunAssessment && (
              <Button
                variant="primary"
                icon={<ClipboardCheck />}
                loading={detecting}
                onClick={onAssess}
                className="shrink-0"
                data-testid="run-supplier-readiness-assessment-button"
              >
                {detecting
                  ? SUPPLIER_SYNCHRONIZATION_LABELS.assessingSupplierReadiness
                  : SUPPLIER_SYNCHRONIZATION_LABELS.assessSuppliers}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Complete supplier synchronization on the Overview tab before running assessment.
          </p>
        )}
      </section>

      <section data-testid="governance-queue-section">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Link2 className="w-4 h-4 text-green-600" />
          {SUPPLIER_SYNCHRONIZATION_LABELS.governanceReview}
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          {showAssessmentOutputs
            ? 'Which synchronized Oracle suppliers have Operational Trust granted, pending, or suspended?'
            : 'How many supplier records in the latest snapshot await assessment?'}
        </p>
        {showAssessmentOutputs ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {tiles.map((tile) => {
                const clickable = tile.href != null && tile.value !== 0 && tile.value !== '—';
                const inner = (
                  <>
                    <p className="text-xs text-gray-500 uppercase">{tile.label}</p>
                    <p className="text-2xl font-bold mt-1">{tile.value}</p>
                    {clickable && <p className="text-xs text-indigo-600 mt-2 font-medium">View →</p>}
                  </>
                );
                return tile.href && clickable ? (
                  <Link
                    key={tile.label}
                    href={tile.href}
                    className="rounded-lg border bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition-colors"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={tile.label} className="rounded-lg border bg-white p-4">
                    {inner}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {SUPPLIER_SYNCHRONIZATION_NARRATIVE.governanceReviewFootnote}
            </p>
          </>
        ) : assessmentIsPending ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-md">
              <div className="rounded-lg border bg-white p-4">
                <p className="text-xs text-gray-500">
                  {SUPPLIER_SYNCHRONIZATION_LABELS.awaitingAssessment}
                </p>
                <p className="text-2xl font-bold mt-1">{awaitingAssessmentCount}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {SUPPLIER_SYNCHRONIZATION_NARRATIVE.assessmentOutputsHiddenFootnote}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            Complete supplier synchronization on the Overview tab before governance review is available.
          </p>
        )}
      </section>

      {assessmentIsPending ? (
        <section
          className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-6"
          data-testid="supplier-assessment-findings-placeholder"
        >
          <h2 className="text-sm font-semibold text-gray-900">
            {SUPPLIER_SYNCHRONIZATION_LABELS.assessmentFindings}
          </h2>
          <p className="text-sm font-medium text-gray-800 mt-3">
            {SUPPLIER_SYNCHRONIZATION_NARRATIVE.assessmentFindingsNotRunTitle}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {SUPPLIER_SYNCHRONIZATION_NARRATIVE.assessmentFindingsNotRunBody}
          </p>
        </section>
      ) : null}

      {showAssessmentOutputs ? (
        <section data-testid="operational-supplier-review-section">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            {SUPPLIER_SYNCHRONIZATION_LABELS.operationalSupplierReview}
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {dashboard.oracleLinkedTotal} synchronized supplier
            {dashboard.oracleLinkedTotal === 1 ? '' : 's'} from Oracle Supplier Portal — the same
            count Oracle reported. Unresolved supplier references are reviewed under Workforce
            Discovery.
          </p>
          <OperationalSupplierReviewTable />
        </section>
      ) : null}

      {showAssessmentOutputs ? (
        <section className="card" data-testid="supplier-approval-queue-section">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          {OPERATIONAL_TRUST_LABELS.queueSection}
        </h2>
        {canOpenApprovalsQueue ? (
          <Link
            href="/suppliers/approvals"
            className="text-sm text-indigo-600 hover:text-indigo-800 inline-block"
          >
            Open operational trust queue →
          </Link>
        ) : (
          <p className="text-sm text-gray-500">
            Operational trust queue requires approve or suspend permission.
          </p>
        )}
      </section>
      ) : null}

      {showAssessmentOutputs ? (
        <section className="card" data-testid="supplier-portal-membership-section">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Supplier portal access</h2>
        <p className="text-sm text-gray-600">
          {SUPPLIER_SYNCHRONIZATION_NARRATIVE.portalMembershipFootnote}
        </p>
        {canAssignPortalMembership ? (
          <p className="text-xs text-gray-500 mt-2">
            Production environments assign portal membership and contracts through supplier approvals
            and contract administration. Demo environments can use the helper below.
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-2">
            Demo supplier setup requires <code className="text-gray-600">suppliers:approve</code>.
          </p>
        )}
      </section>
      ) : null}

      {isConnectorDemoUiEnabled() && canSync && (
        <section
          className="card border border-dashed border-indigo-200 bg-indigo-50/30"
          data-testid="supplier-governance-demo-helper"
        >
          <h2 className="text-sm font-semibold text-indigo-900 flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" aria-hidden />
            Demo helper
          </h2>
          <p className="text-xs text-indigo-800/80 mb-3">
            After supplier sync and assessment: promotes all five MTN suppliers, framework
            agreements, portal admins, materializes workers, and sponsored engagements. Run after
            workforce discovery, before workforce assessment. Portal example:{' '}
            {DEMO_SUPPLIER_ADMIN_EMAIL}.
          </p>
          <div className="flex flex-wrap gap-3">
            {canAssignPortalMembership && (
              <Button
                variant="secondary"
                loading={busy === 'setup'}
                disabled={busy != null && busy !== 'setup'}
                onClick={completeMtnDemoStory}
                data-testid="demo-complete-mtn-story"
              >
                {busy === 'setup' ? 'Completing…' : 'Complete MTN demo story (5 suppliers)'}
              </Button>
            )}
          </div>
          {demoMessage ? (
            <p className="mt-3 text-sm text-indigo-900" role="status">
              {demoMessage}
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
