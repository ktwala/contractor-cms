import { ConfigService } from '@nestjs/config';
import {
  OracleSupplierConnectorHealth,
  SupplierSourceSyncRunMode,
  SupplierSourceSyncRunStatus,
} from '@prisma/client';
import { OracleConnectorTelemetryService } from '../oracle-connector-telemetry.service';
import { OracleProcurementHealthService } from '../../../integration/oracle-procurement/oracle-procurement-health.service';

describe('OracleConnectorTelemetryService (PR-CMS-CONNECTOR-1F)', () => {
  const organizationId = 'org-telemetry-1';

  function buildService() {
    const prisma = {
      supplierSourceSyncRun: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([
          {
            status: SupplierSourceSyncRunStatus.SUCCEEDED,
            startedAt: new Date('2026-05-19T10:00:00Z'),
            finishedAt: new Date('2026-05-19T10:00:05Z'),
            importedCount: 2,
            matchedCount: 1,
            newCount: 1,
            failedCount: 0,
          },
          {
            status: SupplierSourceSyncRunStatus.FAILED,
            startedAt: new Date('2026-05-18T10:00:00Z'),
            finishedAt: new Date('2026-05-18T10:00:01Z'),
            importedCount: 0,
            matchedCount: 0,
            newCount: 0,
            failedCount: 0,
          },
        ]),
      },
      supplierSourceStaging: {
        count: jest.fn().mockResolvedValue(3),
        findFirst: jest.fn().mockResolvedValue({
          importedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        }),
      },
      supplier: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };

    const config = {
      get: () => undefined,
    } as unknown as ConfigService;

    const healthService = {
      getHealthSnapshot: jest.fn().mockResolvedValue({
        health: OracleSupplierConnectorHealth.HEALTHY,
      }),
    } as unknown as OracleProcurementHealthService;

    const evidenceChecklist = {
      evaluateChecklist: jest.fn().mockReturnValue({ complete: true }),
    };

    const syncAssessment = {
      resolveStatus: jest.fn().mockResolvedValue({
        lifecyclePhase: 'ASSESSMENT_PENDING',
        canRunAssessment: true,
        latestSyncRun: null,
        lastAssessment: null,
        findingsSnapshotRef: null,
      }),
    };

    const service = new OracleConnectorTelemetryService(
      prisma as never,
      healthService,
      evidenceChecklist as never,
      syncAssessment as never,
      {
        syncObservations: jest.fn().mockResolvedValue({ observations: 0 }),
        listWorkItems: jest.fn().mockResolvedValue([]),
      } as never,
    );

    return { service, prisma };
  }

  it('aggregates sync-run metrics from ledger', async () => {
    const { service } = buildService();
    const telemetry = await service.buildSyncTelemetry(organizationId);

    expect(telemetry.totalSyncRuns).toBe(2);
    expect(telemetry.successfulSyncRuns).toBe(1);
    expect(telemetry.failedSyncRuns).toBe(1);
    expect(telemetry.recordsImported).toBe(2);
    expect(telemetry.lastSyncDurationMs).toBe(5000);
    expect(telemetry.stagingBacklogCount).toBe(3);
  });

  it('returns full telemetry envelope', async () => {
    const { service } = buildService();
    const result = await service.getTelemetry({
      targetOrganizationId: organizationId,
    } as never);

    expect(result.organizationId).toBe(organizationId);
    expect(result.connector.totalSyncRuns).toBe(2);
    expect(result.governance.pendingEvidenceSuppliers).toBe(0);
    expect(result.drift.missingSourceRecords).toBe(0);
    expect(result.evaluatedAt).toBeDefined();
  });
});
