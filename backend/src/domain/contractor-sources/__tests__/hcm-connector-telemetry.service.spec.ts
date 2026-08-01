import { ConfigService } from '@nestjs/config';
import {
  ContractorSourceSyncRunStatus,
  HcmOracleConnectorHealth,
} from '@prisma/client';
import { HcmConnectorTelemetryService } from '../hcm-connector-telemetry.service';
import { OracleHcmHealthService } from '../../../integration/oracle-hcm/oracle-hcm-health.service';

describe('HcmConnectorTelemetryService (PR-CTR-CONNECTOR-1E)', () => {
  const organizationId = 'org-hcm-tel-1';

  function buildService() {
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ contractorAuthorityMode: 'CMS_ONLY' }),
      },
      contractorSourceSyncRun: {
        findMany: jest.fn().mockResolvedValue([
          {
            status: ContractorSourceSyncRunStatus.SUCCEEDED,
            startedAt: new Date('2026-05-19T10:00:00Z'),
            finishedAt: new Date('2026-05-19T10:00:04Z'),
            importedCount: 3,
            matchedCount: 2,
            newCount: 1,
            failedCount: 0,
            correlationFailures: 0,
          },
          {
            status: ContractorSourceSyncRunStatus.FAILED,
            startedAt: new Date('2026-05-18T10:00:00Z'),
            finishedAt: new Date('2026-05-18T10:00:01Z'),
            importedCount: 0,
            matchedCount: 0,
            newCount: 0,
            failedCount: 0,
            correlationFailures: 1,
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      hcmContractorStaging: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([]),
      },
      hcmContractorQuarantine: {
        count: jest.fn().mockResolvedValue(0),
      },
      supplier: {
        findMany: jest.fn().mockResolvedValue([{ id: 'sup-1' }]),
      },
      contractor: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
      contractorGovernanceRemediation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const config = { get: () => undefined } as unknown as ConfigService;
    const healthService = {
      getHealthSnapshot: jest.fn().mockResolvedValue({
        health: HcmOracleConnectorHealth.DISABLED,
      }),
    } as unknown as OracleHcmHealthService;

    const workforceAssessment = {
      resolveStatus: jest.fn().mockResolvedValue({
        lifecyclePhase: 'ASSESSMENT_CURRENT',
        canRunAssessment: false,
        latestDiscoveryRun: null,
        lastAssessment: null,
        findingsSnapshotRef: null,
      }),
    };

    const supplierOperationalTrust = {
      summarizeWorkforceImpactTrustCounts: jest.fn().mockResolvedValue({
        workersBlockedPendingSupplierTrust: 0,
        workersBlockedSuspendedSupplier: 0,
      }),
    };

    const service = new HcmConnectorTelemetryService(
      prisma as never,
      healthService,
      workforceAssessment as never,
      supplierOperationalTrust as never,
    );
    return { service, prisma, workforceAssessment };
  }

  it('aggregates sync-run metrics from ledger', async () => {
    const { service } = buildService();
    const telemetry = await service.buildSyncTelemetry(organizationId);

    expect(telemetry.totalSyncRuns).toBe(2);
    expect(telemetry.successfulSyncRuns).toBe(1);
    expect(telemetry.failedSyncRuns).toBe(1);
    expect(telemetry.workersImported).toBe(3);
    expect(telemetry.lastSyncDurationMs).toBe(4000);
    expect(telemetry.stagingBacklog).toBe(2);
  });

  it('returns full telemetry envelope with correlation and governance', async () => {
    const { service } = buildService();
    const result = await service.getTelemetry({
      targetOrganizationId: organizationId,
    } as never);

    expect(result.organizationId).toBe(organizationId);
    expect(result.correlation).toBeDefined();
    expect(result.governance).toBeDefined();
    expect(result.operationalWorkforce).toBeDefined();
    expect(result.operationalWorkforce.populationScope).toContain('CMS workforce registry');
    expect(result.operationalWorkforce.registryTotal).toBeDefined();
    expect(result.operationalRisk).toBeDefined();
    expect(result.evaluatedAt).toBeDefined();
  });

  it('zeros assessment telemetry before workforce assessment is current', async () => {
    const { service, workforceAssessment } = buildService();
    workforceAssessment.resolveStatus.mockResolvedValue({
      lifecyclePhase: 'ASSESSMENT_PENDING',
      canRunAssessment: true,
      latestDiscoveryRun: {
        id: 'run-1',
        snapshotRef: 'DISC-00001',
        importedCount: 3,
        finishedAt: new Date().toISOString(),
      },
      lastAssessment: null,
      findingsSnapshotRef: null,
    });

    const result = await service.getTelemetry({
      targetOrganizationId: organizationId,
    } as never);

    expect(result.connector.workersImported).toBe(3);
    expect(result.correlation.manualReviewRequired).toBe(0);
    expect(result.governance.missingResponsibleManagerCount).toBe(0);
    expect(result.operationalWorkforce.operationallyReady).toBe(0);
  });

  it('buildGovernanceTelemetry excludes comparison-anchor suppliers from contractor counts', async () => {
    const { service, prisma } = buildService();
    await service.buildGovernanceTelemetry(organizationId);

    expect(prisma.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          AND: expect.any(Array),
        }),
      }),
    );
    expect(prisma.contractor.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { email: { startsWith: 'anchor.' } },
        }),
      }),
    );
  });
});
