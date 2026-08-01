import { OracleConnectorOperationsDashboardService } from '../oracle-connector-operations-dashboard.service';

describe('OracleConnectorOperationsDashboardService', () => {
  const orgId = 'org-dash-1';
  const accessContext = { targetOrganizationId: orgId } as never;

  function buildService(lifecyclePhase: 'SYNCHRONIZATION_PENDING' | 'ASSESSMENT_PENDING' | 'ASSESSMENT_CURRENT') {
    const syncAssessment = {
      resolveStatus: jest.fn().mockResolvedValue({
        lifecyclePhase,
        canRunAssessment: lifecyclePhase === 'ASSESSMENT_PENDING',
        latestSyncRun:
          lifecyclePhase === 'SYNCHRONIZATION_PENDING'
            ? null
            : {
                id: 'run-1',
                snapshotRef: 'SYNC-00001',
                importedCount: 2,
                finishedAt: '2026-07-02T12:00:00.000Z',
              },
        lastAssessment:
          lifecyclePhase === 'ASSESSMENT_CURRENT'
            ? {
                syncRunId: 'run-1',
                snapshotRef: 'SYNC-00001',
                assessedAt: '2026-07-02T12:05:00.000Z',
              }
            : null,
        findingsSnapshotRef: lifecyclePhase === 'ASSESSMENT_CURRENT' ? 'SYNC-00001' : null,
      }),
      listSnapshotHistory: jest.fn().mockResolvedValue([
        {
          id: 'run-1',
          snapshotRef: 'SYNC-00001',
          createdAt: '2026-07-02T12:00:00.000Z',
          source: 'Oracle Supplier Portal',
          status: 'SUCCEEDED',
          suppliersDiscovered: 2,
          newSuppliers: 2,
          matchedSuppliers: 0,
          unchangedSuppliers: 0,
          failedSuppliers: 0,
          discoveryExceptions: 0,
          assessmentLabel: lifecyclePhase === 'ASSESSMENT_CURRENT' ? 'Assessed' : 'Pending',
          isLatest: true,
        },
      ]),
    };

    const telemetryService = {
      getTelemetry: jest.fn().mockResolvedValue({
        connector: {
          totalSyncRuns: 1,
          successfulSyncRuns: 1,
          failedSyncRuns: 0,
          partialSyncRuns: 0,
          recordsImported: 2,
          recordsMatched: 0,
          recordsNew: 2,
          recordsFailed: 0,
          stagingBacklogCount: 2,
        },
        governance: {
          pendingEvidenceSuppliers: 1,
          activeSuppliers: 0,
          suspendedSuppliers: 0,
          staleConnectorCount: 0,
          promotionQueueAgeHours: 1,
          unresolvedPossibleMatches: 0,
          reconciliationFailures: 0,
        },
        drift: {
          supplierSourceDriftCount: 0,
          missingSourceRecords: 1,
          duplicateExternalIds: 0,
          promotionFailures: 0,
        },
      }),
    };

    const governanceDashboard = {
      getDashboard: jest.fn().mockResolvedValue({
        organizationId: orgId,
        buckets: { synced: 1, pendingEvidence: 1, active: 0, suspended: 0 },
        oracleLinkedTotal: 1,
      }),
    };

    const service = new OracleConnectorOperationsDashboardService(
      { getHealthSnapshot: jest.fn().mockResolvedValue({ health: 'HEALTHY' }) } as never,
      telemetryService as never,
      { getAnomalies: jest.fn().mockResolvedValue({ anomalies: [] }) } as never,
      governanceDashboard as never,
      { listRuns: jest.fn().mockResolvedValue({ data: [] }) } as never,
      {
        getSummary: jest.fn().mockResolvedValue({
          organizationId: orgId,
          openTotal: 2,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          underReview: 0,
          criticalUnresolvedOver72h: 0,
        }),
      } as never,
      syncAssessment as never,
      {
        materializeGovernanceDemoIfNeeded: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    return { service, syncAssessment, governanceDashboard, telemetryService };
  }

  it('zeros governance telemetry before assessment completes', async () => {
    const { service, governanceDashboard } = buildService('ASSESSMENT_PENDING');
    const dashboard = await service.getDashboard(accessContext);

    expect(governanceDashboard.getDashboard).not.toHaveBeenCalled();
    expect(dashboard.governanceTelemetry.pendingEvidenceSuppliers).toBe(0);
    expect(dashboard.oracleLinkedTotal).toBe(0);
    expect(dashboard.governanceBuckets.active).toBe(0);
    expect(dashboard.driftSummary.openTotal).toBe(0);
    expect(dashboard.supplierDiscoverySnapshotHistory).toHaveLength(1);
    expect(dashboard.supplierDiscoverySnapshotHistory[0].snapshotRef).toBe('SYNC-00001');
  });

  it('returns governance telemetry after assessment completes', async () => {
    const { service, governanceDashboard } = buildService('ASSESSMENT_CURRENT');
    const dashboard = await service.getDashboard(accessContext);

    expect(governanceDashboard.getDashboard).toHaveBeenCalled();
    expect(dashboard.governanceTelemetry.pendingEvidenceSuppliers).toBe(1);
    expect(dashboard.oracleLinkedTotal).toBe(1);
    expect(dashboard.supplierSyncAssessment.lifecyclePhase).toBe('ASSESSMENT_CURRENT');
  });
});
