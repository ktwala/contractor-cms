import { HcmOracleConnectorHealth } from '@prisma/client';
import { HcmConnectorOperationsDashboardService } from '../hcm-connector-operations-dashboard.service';

describe('HcmConnectorOperationsDashboardService (PR-CTR-CONNECTOR-1E)', () => {
  const organizationId = 'org-hcm-dash-1';

  function buildService(workforceAssessmentPhase: 'DISCOVERY_PENDING' | 'ASSESSMENT_PENDING' | 'ASSESSMENT_CURRENT') {
    const healthService = {
      getHealthSnapshot: jest.fn().mockResolvedValue({
        organizationId,
        health: HcmOracleConnectorHealth.DISABLED,
        restEnabled: false,
        lastSuccessfulSyncAt: null,
        lastCursor: null,
        lastError: null,
        staleThresholdHours: 24,
        isStale: false,
        evaluatedAt: new Date().toISOString(),
      }),
    };

    const telemetryService = {
      getTelemetry: jest.fn().mockResolvedValue({
        organizationId,
        connector: { totalSyncRuns: 1, workersImported: 5 },
        correlation: { manualReviewRequired: 2, correlationConflicts: 1, unlinkedWorkers: 3 },
        governance: { terminatedUpstreamButActive: 0, missingResponsibleManagerCount: 1, missingSupplierLinks: 2 },
        operationalRisk: { staleConnectorCount: 0, failedSyncRuns: 1, checkpointGapCount: 0, identityConflictCount: 4 },
        operationalWorkforce: {
          populationScope: 'Materialized HCM contractors in the CMS workforce registry',
          registryTotal: 10,
          operationallyReady: 6,
          blocked: 1,
          restricted: 2,
          suspendedInactive: 0,
          exited: 1,
        },
        evaluatedAt: new Date().toISOString(),
      }),
    };

    const syncRunService = {
      listRuns: jest.fn().mockResolvedValue({ data: [{ id: 'run-1' }] }),
    };

    const driftService = {
      getSummary: jest.fn().mockResolvedValue({
        organizationId,
        critical: 1,
        openTotal: 1,
        lifecycleConflictOpen: 1,
        missingResponsibleManagerOpen: 1,
      }),
    };

    const remediationService = {
      getSummary: jest.fn().mockResolvedValue({
        organizationId,
        populationScope: 'Open workforce resolution task records (workforce gaps only — not Supplier Governance)',
        activeRemediations: 1,
        pdpRestrictionsActive: 1,
      }),
    };

    const prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ workforceMigrationCutoverAt: null }) },
    };

    const workforceAssessment = {
      resolveStatus: jest.fn().mockResolvedValue({
        lifecyclePhase: workforceAssessmentPhase,
        canRunAssessment: workforceAssessmentPhase === 'ASSESSMENT_PENDING',
        latestDiscoveryRun:
          workforceAssessmentPhase === 'DISCOVERY_PENDING'
            ? null
            : {
                id: 'run-1',
                snapshotRef: 'DISC-00001',
                importedCount: 10,
                finishedAt: new Date().toISOString(),
              },
        lastAssessment:
          workforceAssessmentPhase === 'ASSESSMENT_CURRENT'
            ? {
                discoveryRunId: 'run-1',
                snapshotRef: 'DISC-00001',
                assessedAt: new Date().toISOString(),
              }
            : null,
        findingsSnapshotRef: workforceAssessmentPhase === 'ASSESSMENT_CURRENT' ? 'DISC-00001' : null,
      }),
      listSnapshotHistory: jest.fn().mockResolvedValue([
        {
          id: 'run-1',
          snapshotRef: 'DISC-00001',
          createdAt: new Date().toISOString(),
          source: 'Oracle HCM',
          status: 'SUCCEEDED',
          workersDiscovered: 10,
          newWorkers: 3,
          updatedWorkers: 6,
          unchangedWorkers: 1,
          failedWorkers: 0,
          discoveryExceptions: 0,
          assessmentLabel: workforceAssessmentPhase === 'ASSESSMENT_CURRENT' ? 'Assessed' : 'Pending',
          isLatest: true,
        },
      ]),
    };

    const service = new HcmConnectorOperationsDashboardService(
      healthService as never,
      telemetryService as never,
      syncRunService as never,
      driftService as never,
      remediationService as never,
      prisma as never,
      workforceAssessment as never,
      {
        syncObservations: jest.fn().mockResolvedValue({ observations: 0 }),
      } as never,
    );

    return {
      service,
      driftService,
      remediationService,
      telemetryService,
    };
  }

  it('composes dashboard from effective health and telemetry when assessment is current', async () => {
    const { service } = buildService('ASSESSMENT_CURRENT');

    const dashboard = await service.getDashboard({
      targetOrganizationId: organizationId,
    } as never);

    expect(dashboard.connectorHealth.health).toBe(HcmOracleConnectorHealth.DISABLED);
    expect(dashboard.syncTelemetry.totalSyncRuns).toBe(1);
    expect(dashboard.correlationTelemetry.manualReviewRequired).toBe(2);
    expect(dashboard.governanceTelemetry.missingResponsibleManagerCount).toBe(1);
    expect(dashboard.operationalWorkforceTelemetry.operationallyReady).toBe(6);
    expect(dashboard.recentSyncRuns).toHaveLength(1);
    expect(dashboard.driftSummary.lifecycleConflictOpen).toBe(1);
    expect(dashboard.workforceAssessment.lifecyclePhase).toBe('ASSESSMENT_CURRENT');
  });

  it('gates assessment-derived dashboard telemetry until workforce assessment is current', async () => {
    const { service, driftService, remediationService } = buildService('ASSESSMENT_PENDING');

    const dashboard = await service.getDashboard({
      targetOrganizationId: organizationId,
    } as never);

    expect(dashboard.syncTelemetry.totalSyncRuns).toBe(1);
    expect(dashboard.correlationTelemetry.manualReviewRequired).toBe(0);
    expect(dashboard.governanceTelemetry.missingSupplierLinks).toBe(0);
    expect(dashboard.operationalWorkforceTelemetry.restricted).toBe(0);
    expect(dashboard.driftSummary.openTotal).toBe(0);
    expect(dashboard.remediationSummary.activeRemediations).toBe(0);
    expect(dashboard.operationalRiskTelemetry.identityConflictCount).toBe(0);
    expect(driftService.getSummary).not.toHaveBeenCalled();
    expect(remediationService.getSummary).not.toHaveBeenCalled();
  });
});
