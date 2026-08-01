'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, ShieldAlert, Users } from 'lucide-react';
import {
  EXTERNAL_WORKFORCE_LABELS,
  INTERNAL_ACCOUNTABILITY_LABELS,
  WORKFORCE_ASSESSMENT_FINDING_METRICS,
  WORKFORCE_DISCOVERY_PAGE_QUESTIONS,
  WORKFORCE_GOVERNANCE_SECTIONS,
  WORKFORCE_IMPORT_NARRATIVE,
  WORKFORCE_OPERATIONAL_METRICS,
  WORKFORCE_READINESS_METRICS,
  WORKFORCE_RESOLUTION_METRICS,
  WORKFORCE_TELEMETRY_POPULATION_SCOPES,
  formatPopulationDenominator,
} from '@/lib/external-workforce-labels';
import { formatRemediationTypeLabel } from '@/lib/operational-governance-labels';
import { POLICY_EVALUATION_LABELS } from '@/lib/policy-evaluation-labels';
import { PolicyEvaluationOutcomeDetail } from '@/components/policy-evaluation/PolicyEvaluationOutcomeDetail';
import { Button } from '@/components/ui/button';
import { DriftRegistryTable } from './DriftRegistryTable';
import {
  SupplierGovernanceImpactCard,
  type SupplierGovernanceImpactFinding,
} from '@/components/suppliers/SupplierGovernanceImpactCard';
import { api } from '@/lib/api';
import { useOperationalTrustChanged } from '@/lib/operational-trust-events';
import { formatRelativeTime, type DashboardPayload, type DriftRow, type RemediationRow } from './types';

type Props = {
  dashboard: DashboardPayload;
  driftRows: DriftRow[];
  driftLoading: boolean;
  remediationRows: RemediationRow[];
  canRunAssessment: boolean;
  detecting: boolean;
  onAssess: () => void | Promise<void>;
};

function MetricTile({
  label,
  value,
  highlight,
  population,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  population?: string;
}) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 ${
        highlight ? 'border-red-200 bg-red-50' : typeof value === 'number' && value > 0 ? 'border-amber-200' : ''
      }`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      {population ? (
        <p className="text-[10px] leading-snug text-gray-400 mt-0.5">{population}</p>
      ) : null}
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function SectionPopulation({ children }: { children: string }) {
  return (
    <p className="text-[11px] leading-snug text-gray-500 mb-3 font-medium uppercase tracking-wide">
      {children}
    </p>
  );
}

export function WorkforceImportGovernanceTab({
  dashboard,
  driftRows,
  driftLoading,
  remediationRows,
  canRunAssessment,
  detecting,
  onAssess,
}: Props) {
  const corr = dashboard.correlationTelemetry;
  const gov = dashboard.governanceTelemetry;
  const operational = dashboard.operationalWorkforceTelemetry ?? {
    populationScope: WORKFORCE_TELEMETRY_POPULATION_SCOPES.materializedHcmContractors,
    registryTotal: 0,
    operationallyReady: 0,
    blocked: 0,
    restricted: 0,
    suspendedInactive: 0,
    exited: 0,
  };
  const workersAssessed = gov.workersAssessed ?? 0;
  const resolutionPopulation =
    dashboard.remediationSummary?.populationScope ??
    WORKFORCE_TELEMETRY_POPULATION_SCOPES.workforceResolutionTasks;
  const risk = dashboard.operationalRiskTelemetry;
  const assessment = dashboard.workforceAssessment ?? {
    lifecyclePhase: 'DISCOVERY_PENDING' as const,
    canRunAssessment: false,
    latestDiscoveryRun: null,
    lastAssessment: null,
    findingsSnapshotRef: null,
  };
  const findingsSnapshotRef =
    assessment.findingsSnapshotRef ?? assessment.lastAssessment?.snapshotRef ?? null;

  const assessmentIsCurrent = assessment.lifecyclePhase === 'ASSESSMENT_CURRENT';
  const assessmentIsPending = assessment.lifecyclePhase === 'ASSESSMENT_PENDING';
  const showAssessmentOutputs = assessmentIsCurrent;

  const awaitingAssessmentCount =
    assessment.latestDiscoveryRun?.importedCount ?? gov.pendingVerificationContractors;

  const [supplierGovernanceImpact, setSupplierGovernanceImpact] = useState<
    SupplierGovernanceImpactFinding[]
  >([]);

  const loadSupplierGovernanceImpact = useCallback(async () => {
    try {
      const impact = await api.getSupplierOperationalTrustWorkforceImpact();
      setSupplierGovernanceImpact(impact.findings ?? []);
    } catch {
      setSupplierGovernanceImpact([]);
    }
  }, []);

  useEffect(() => {
    if (!showAssessmentOutputs) return;
    void loadSupplierGovernanceImpact();
  }, [loadSupplierGovernanceImpact, showAssessmentOutputs]);

  useOperationalTrustChanged(() => {
    void loadSupplierGovernanceImpact();
  });

  const readinessReasonTiles = [
    {
      label: WORKFORCE_READINESS_METRICS.missingSupplierLink,
      value: gov.missingSupplierLinks,
    },
    {
      label: WORKFORCE_READINESS_METRICS.responsibleManagerNotAssigned,
      value: gov.missingResponsibleManagerCount ?? 0,
      highlight: (gov.missingResponsibleManagerCount ?? 0) > 0,
    },
    {
      label: WORKFORCE_READINESS_METRICS.duplicateWorker,
      value: gov.duplicateWorkerCount ?? corr.correlationConflicts,
    },
    {
      label: WORKFORCE_READINESS_METRICS.workforceResolutionRequired,
      value: corr.unlinkedWorkers,
    },
    {
      label: WORKFORCE_READINESS_METRICS.manualReviewRequired,
      value: corr.manualReviewRequired,
    },
  ];

  const operationalWorkforceTiles = [
    {
      label: WORKFORCE_OPERATIONAL_METRICS.operationallyReady,
      value: operational.operationallyReady,
    },
    {
      label: WORKFORCE_OPERATIONAL_METRICS.blocked,
      value: operational.blocked,
    },
    {
      label: WORKFORCE_OPERATIONAL_METRICS.restricted,
      value: operational.restricted,
    },
    {
      label: WORKFORCE_OPERATIONAL_METRICS.suspendedInactive,
      value: operational.suspendedInactive,
    },
    {
      label: WORKFORCE_OPERATIONAL_METRICS.exited,
      value: operational.exited,
    },
  ];

  return (
    <div className="space-y-8" data-testid="workforce-import-tab-panel-governance">
      <section
        className="rounded-lg border bg-white p-5"
        data-testid="workforce-assessment-status-section"
      >
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          {EXTERNAL_WORKFORCE_LABELS.assessmentStatus}
        </h2>
        <p className="text-xs text-gray-500 mb-4">{WORKFORCE_IMPORT_NARRATIVE.assessmentFootnote}</p>

        {assessmentIsCurrent ? (
          <div className="flex items-start gap-3 text-green-800">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold">{EXTERNAL_WORKFORCE_LABELS.assessmentUpToDate}</p>
              {assessment.lastAssessment ? (
                <p className="text-sm text-gray-600 mt-1">
                  {EXTERNAL_WORKFORCE_LABELS.lastAssessed}{' '}
                  {formatRelativeTime(assessment.lastAssessment.assessedAt)}
                </p>
              ) : null}
              {findingsSnapshotRef ? (
                <p className="text-sm text-gray-600">
                  {EXTERNAL_WORKFORCE_LABELS.discoverySnapshot}:{' '}
                  <span className="font-mono">{findingsSnapshotRef}</span>
                </p>
              ) : null}
              <p className="text-xs text-gray-500 mt-2">
                {WORKFORCE_IMPORT_NARRATIVE.assessmentCurrentFootnote}
              </p>
            </div>
          </div>
        ) : assessmentIsPending ? (
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3 text-amber-900">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="font-semibold">{EXTERNAL_WORKFORCE_LABELS.newWorkforceDiscovered}</p>
                {assessment.latestDiscoveryRun ? (
                  <p className="text-sm text-gray-600 mt-1">
                    {EXTERNAL_WORKFORCE_LABELS.discoverySnapshot}:{' '}
                    <span className="font-mono">{assessment.latestDiscoveryRun.snapshotRef}</span>
                    {' · '}
                    {assessment.latestDiscoveryRun.importedCount} worker record(s) discovered
                  </p>
                ) : null}
                <p className="text-xs text-gray-500 mt-2">
                  {WORKFORCE_IMPORT_NARRATIVE.assessmentPendingFootnote}
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
                data-testid="run-workforce-assessment-button"
              >
                {detecting
                  ? EXTERNAL_WORKFORCE_LABELS.assessingWorkforce
                  : EXTERNAL_WORKFORCE_LABELS.assessWorkforce}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Complete workforce discovery on the Overview tab before running assessment.
          </p>
        )}
      </section>

      <header className="pt-2">
        <h2 className="text-base font-semibold text-gray-900">
          {WORKFORCE_DISCOVERY_PAGE_QUESTIONS.governance}
        </h2>
      </header>

      {showAssessmentOutputs ? (
        <section data-testid="workforce-drift-section">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-purple-600" />
              {WORKFORCE_GOVERNANCE_SECTIONS.assessmentFindings.title}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {WORKFORCE_GOVERNANCE_SECTIONS.assessmentFindings.question}
            </p>
            {findingsSnapshotRef ? (
              <p className="text-xs text-gray-500 mt-1">
                {EXTERNAL_WORKFORCE_LABELS.basedOnDiscoverySnapshot(findingsSnapshotRef)}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              [
                WORKFORCE_ASSESSMENT_FINDING_METRICS.responsibleManagerNotAssigned,
                dashboard.driftSummary.missingResponsibleManagerOpen ?? 0,
                'text-red-700',
              ],
              [
                WORKFORCE_ASSESSMENT_FINDING_METRICS.unlinkedWorkers,
                dashboard.driftSummary.identityConflictOpen,
                'text-orange-700',
              ],
              [
                WORKFORCE_ASSESSMENT_FINDING_METRICS.missingSupplier,
                dashboard.driftSummary.supplierLinkMissingOpen,
                'text-amber-700',
              ],
              [
                'Critical >24h',
                dashboard.driftSummary.criticalUnresolvedOver24h,
                'text-red-900',
              ],
            ].map(([label, value, color]) => (
              <div
                key={String(label)}
                className="rounded-lg border bg-white p-4"
                data-testid={`drift-summary-${String(label).replace(/\s+/g, '-').toLowerCase()}`}
              >
                <p className="text-xs text-gray-500 uppercase">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              ['Critical open', dashboard.driftSummary.critical],
              ['High open', dashboard.driftSummary.high],
              ['Under review', dashboard.driftSummary.underReview],
              ['Open total', dashboard.driftSummary.openTotal],
            ].map(([label, value]) => (
              <MetricTile key={String(label)} label={String(label)} value={Number(value)} />
            ))}
          </div>
          <DriftRegistryTable rows={driftRows} loading={driftLoading} />
        </section>
      ) : null}

      <section data-testid="workforce-readiness-section">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-green-600" />
          {WORKFORCE_GOVERNANCE_SECTIONS.readiness.title}
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          {showAssessmentOutputs
            ? WORKFORCE_GOVERNANCE_SECTIONS.readiness.afterAssessment
            : WORKFORCE_GOVERNANCE_SECTIONS.readiness.beforeAssessment}
        </p>
        {showAssessmentOutputs ? (
          <SectionPopulation>
            {formatPopulationDenominator(
              WORKFORCE_GOVERNANCE_SECTIONS.readiness.populationFootnote,
              workersAssessed,
            )}
          </SectionPopulation>
        ) : null}
        {showAssessmentOutputs ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-w-2xl">
              <MetricTile
                label={WORKFORCE_READINESS_METRICS.workersNotYetOperational}
                value={gov.workersNotReadyUnique ?? 0}
                highlight={(gov.workersNotReadyUnique ?? 0) > 0}
                population="Unique staging workers with ≥1 readiness reason"
              />
              <MetricTile
                label={WORKFORCE_READINESS_METRICS.readinessReasonsDetected}
                value={gov.readinessReasonsDetected ?? 0}
                highlight={(gov.readinessReasonsDetected ?? 0) > 0}
                population={WORKFORCE_TELEMETRY_POPULATION_SCOPES.assessedStagingFindings}
              />
            </div>
            <p className="text-xs text-gray-500 mb-3">
              {WORKFORCE_GOVERNANCE_SECTIONS.readiness.overlapFootnote}
            </p>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              {WORKFORCE_GOVERNANCE_SECTIONS.readiness.reasonsHeading}
            </h3>
          </>
        ) : null}
        <div
          className={`grid gap-3 ${
            showAssessmentOutputs
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-md'
          }`}
        >
          {showAssessmentOutputs
            ? readinessReasonTiles.map(({ label, value, highlight }) => (
                <MetricTile
                  key={label}
                  label={label}
                  value={value}
                  highlight={highlight}
                  population="Staging worker findings (may overlap)"
                />
              ))
            : assessmentIsPending
              ? (
                  <MetricTile
                    label={WORKFORCE_READINESS_METRICS.awaitingAssessment}
                    value={awaitingAssessmentCount}
                  />
                )
              : null}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          {showAssessmentOutputs
            ? WORKFORCE_IMPORT_NARRATIVE.governanceSectionFootnote
            : WORKFORCE_IMPORT_NARRATIVE.assessmentOutputsHiddenFootnote}
        </p>
      </section>

      {showAssessmentOutputs && supplierGovernanceImpact.length > 0 ? (
        <section
          className="space-y-3"
          data-testid="external-governance-dependencies-section"
        >
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {WORKFORCE_GOVERNANCE_SECTIONS.externalGovernanceDependencies.title}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {WORKFORCE_GOVERNANCE_SECTIONS.externalGovernanceDependencies.intro}
            </p>
            <SectionPopulation>
              {formatPopulationDenominator(
                WORKFORCE_TELEMETRY_POPULATION_SCOPES.supplierGovernanceProjection,
                workersAssessed,
              )}
            </SectionPopulation>
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {WORKFORCE_GOVERNANCE_SECTIONS.externalGovernanceDependencies.supplierGovernanceHeading}
          </h3>
          <p className="text-xs text-gray-500">
            {WORKFORCE_GOVERNANCE_SECTIONS.externalGovernanceDependencies.liveProjectionFootnote}
          </p>
          {supplierGovernanceImpact.map((finding) => (
            <SupplierGovernanceImpactCard key={finding.supplierId} finding={finding} />
          ))}
          <p className="text-xs text-gray-500">
            {WORKFORCE_GOVERNANCE_SECTIONS.externalGovernanceDependencies.inclusionFootnote}
          </p>
        </section>
      ) : null}

      {showAssessmentOutputs ? (
        <>
          <section data-testid="governance-remediation-section">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-violet-600" />
              {WORKFORCE_GOVERNANCE_SECTIONS.resolution.title}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {WORKFORCE_GOVERNANCE_SECTIONS.resolution.question}
            </p>
            <SectionPopulation>{formatPopulationDenominator(resolutionPopulation)}</SectionPopulation>
            <p className="text-xs text-gray-500 mb-4">
              {WORKFORCE_IMPORT_NARRATIVE.remediationFootnote}
            </p>
            <p className="text-xs text-gray-500 mb-4">
              {WORKFORCE_GOVERNANCE_SECTIONS.resolution.supplierGovernanceExcludedFootnote}
            </p>
            <p className="text-xs text-gray-500 mb-4">
              {POLICY_EVALUATION_LABELS.doctrine}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                [
                  WORKFORCE_RESOLUTION_METRICS.activeResolutionTasks,
                  dashboard.remediationSummary?.activeRemediations ?? 0,
                  'Open task records',
                ],
                [
                  WORKFORCE_RESOLUTION_METRICS.responsibleManagerOpen,
                  dashboard.remediationSummary?.missingResponsibleManagerGovernanceOpen ?? 0,
                  'Task records',
                ],
                [
                  WORKFORCE_RESOLUTION_METRICS.policyRestrictionsActive,
                  dashboard.remediationSummary?.pdpRestrictionsActive ?? 0,
                  POLICY_EVALUATION_LABELS.policyRestrictionsActivePopulation,
                ],
                [
                  WORKFORCE_RESOLUTION_METRICS.criticalUnresolved,
                  dashboard.remediationSummary?.criticalUnresolved ?? 0,
                  'Task records',
                ],
              ].map(([label, value, population]) => (
                <div
                  key={String(label)}
                  className="rounded-lg border bg-white p-4"
                  data-testid={`remediation-summary-${String(label).replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <p className="text-xs text-gray-500 uppercase">{label}</p>
                  <p className="text-[10px] leading-snug text-gray-400 mt-0.5">{population}</p>
                  <p className="text-2xl font-bold mt-1">{value}</p>
                </div>
              ))}
            </div>
            {remediationRows.length === 0 ? (
              <p className="text-sm text-gray-500">No active resolution tasks.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm" data-testid="governance-remediation-table">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
                    <tr>
                      <th className="px-4 py-2">Resolution task</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">{POLICY_EVALUATION_LABELS.decisionColumn}</th>
                      <th className="px-4 py-2">Severity</th>
                      <th className="px-4 py-2">Escalation</th>
                      <th className="px-4 py-2">Age (h)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {remediationRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2">
                          {row.remediationTypeLabel ??
                            formatRemediationTypeLabel(row.remediationType)}
                          {row.driftType === 'MISSING_RESPONSIBLE_MANAGER' ||
                          row.remediationType === 'PDP_RESTRICTION' ? (
                            <span className="ml-1 text-xs font-semibold text-violet-700">
                              (flagship)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2">{row.remediationStatus}</td>
                        <td className="px-4 py-2 align-top">
                          <PolicyEvaluationOutcomeDetail row={row} />
                        </td>
                        <td className="px-4 py-2">{row.driftSeverity ?? '—'}</td>
                        <td className="px-4 py-2">{row.escalationLevel}</td>
                        <td className="px-4 py-2">
                          {row.isOverdue ? (
                            <span className="text-red-700 font-semibold">{row.ageHours ?? '—'}</span>
                          ) : (
                            (row.ageHours ?? '—')
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(gov.missingResponsibleManagerCount ?? 0) > 0 && (
              <p
                className="mt-4 text-sm text-red-800 bg-red-50 border border-red-100 rounded-md px-3 py-2 flex items-start gap-2"
                role="alert"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {WORKFORCE_IMPORT_NARRATIVE.responsibleManagerAlert(gov.missingResponsibleManagerCount ?? 0)}
              </p>
            )}
          </section>

          <section data-testid="governance-lifecycle-section">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-violet-600" />
              {WORKFORCE_GOVERNANCE_SECTIONS.operationalWorkforce.title}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {WORKFORCE_GOVERNANCE_SECTIONS.operationalWorkforce.question}
            </p>
            <SectionPopulation>
              {formatPopulationDenominator(
                operational.populationScope ??
                  WORKFORCE_GOVERNANCE_SECTIONS.operationalWorkforce.populationFootnote,
                operational.registryTotal,
              )}
            </SectionPopulation>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {operationalWorkforceTiles.map(({ label, value }) => (
                <MetricTile
                  key={label}
                  label={label}
                  value={value}
                  population={
                    label === WORKFORCE_OPERATIONAL_METRICS.restricted
                      ? POLICY_EVALUATION_LABELS.restrictedByPolicy
                      : 'CMS registry lifecycle view'
                  }
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {WORKFORCE_GOVERNANCE_SECTIONS.operationalWorkforce.policyFootnote}
            </p>
            <p className="text-xs text-gray-500 mt-3">
              {WORKFORCE_IMPORT_NARRATIVE.operationalWorkforceFootnote}
            </p>
          </section>

          <section data-testid="operational-risk-section" className="opacity-90">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              {WORKFORCE_GOVERNANCE_SECTIONS.operationalRisk.title}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {WORKFORCE_GOVERNANCE_SECTIONS.operationalRisk.question}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Stale connector', risk.staleConnectorCount],
                ['Failed discovery runs', risk.failedSyncRuns],
                ['Checkpoint gaps', risk.checkpointGapCount],
                ['Matching conflicts', risk.identityConflictCount],
              ].map(([label, value]) => (
                <MetricTile key={String(label)} label={String(label)} value={Number(value)} />
              ))}
            </div>
          </section>
        </>
      ) : assessmentIsPending ? (
        <section
          className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-6"
          data-testid="workforce-drift-section"
        >
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-purple-600" />
            {WORKFORCE_GOVERNANCE_SECTIONS.assessmentFindings.title}
          </h2>
          <p className="text-sm font-medium text-gray-800 mt-3">
            {WORKFORCE_IMPORT_NARRATIVE.assessmentFindingsNotRunTitle}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {WORKFORCE_IMPORT_NARRATIVE.assessmentFindingsNotRunBody}
          </p>
        </section>
      ) : null}
    </div>
  );
}
