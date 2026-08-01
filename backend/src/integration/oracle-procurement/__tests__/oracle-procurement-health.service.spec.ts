import { ConfigService } from '@nestjs/config';
import { OracleSupplierConnectorHealth } from '@prisma/client';
import { OracleProcurementUpstreamException } from '../oracle-procurement-upstream.errors';
import { OracleProcurementHealthService } from '../oracle-procurement-health.service';
import { HttpOracleProcurementRestClient } from '../oracle-procurement-rest.client';

describe('OracleProcurementHealthService (PR-CMS-CONNECTOR-1D–1E)', () => {
  const organizationId = 'org-health-1';

  function buildService(options?: {
    restEnabled?: boolean;
    staleHours?: string;
    org?: {
      oracleSupplierLastSuccessfulSyncAt: Date | null;
      oracleSupplierLastCursor: string | null;
      oracleSupplierConnectorHealth: OracleSupplierConnectorHealth;
      oracleSupplierConnectorLastError: string | null;
    };
  }) {
    const org = options?.org ?? {
      oracleSupplierLastSuccessfulSyncAt: null,
      oracleSupplierLastCursor: null,
      oracleSupplierConnectorHealth: OracleSupplierConnectorHealth.UNKNOWN,
      oracleSupplierConnectorLastError: null,
    };

    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: organizationId, ...org }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const config = {
      get: (key: string) => {
        if (key === 'ORACLE_PROCUREMENT_REST_ENABLED') {
          return options?.restEnabled ? 'true' : 'false';
        }
        if (key === 'ORACLE_PROCUREMENT_STALE_THRESHOLD_HOURS') {
          return options?.staleHours ?? '24';
        }
        return undefined;
      },
    } as ConfigService;

    const restClient = {
      isEnabled: jest.fn().mockReturnValue(options?.restEnabled ?? false),
    } as unknown as HttpOracleProcurementRestClient;

    const service = new OracleProcurementHealthService(
      prisma as never,
      config,
      restClient,
    );

    return { service, prisma };
  }

  it('reports DISABLED on health snapshot when REST is off', async () => {
    const { service } = buildService({ restEnabled: false });
    const snapshot = await service.getHealthSnapshot(organizationId);
    expect(snapshot.health).toBe(OracleSupplierConnectorHealth.DISABLED);
    expect(snapshot.restEnabled).toBe(false);
  });

  it('reports STALE from persisted last sync without running sync', async () => {
    const staleAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const { service } = buildService({
      restEnabled: true,
      org: {
        oracleSupplierLastSuccessfulSyncAt: staleAt,
        oracleSupplierLastCursor: 'cursor-1',
        oracleSupplierConnectorHealth: OracleSupplierConnectorHealth.HEALTHY,
        oracleSupplierConnectorLastError: null,
      },
    });

    const snapshot = await service.getHealthSnapshot(organizationId);
    expect(snapshot.health).toBe(OracleSupplierConnectorHealth.STALE);
    expect(snapshot.isStale).toBe(true);
  });

  it('records AUTH_FAILED on upstream 401/403', async () => {
    const { service, prisma } = buildService({ restEnabled: true });
    const health = await service.recordUpstreamFailure(
      organizationId,
      new OracleProcurementUpstreamException(
        'AUTH_FAILED',
        'Oracle auth failed (401)',
        401,
      ),
    );

    expect(health).toBe(OracleSupplierConnectorHealth.AUTH_FAILED);
    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oracleSupplierConnectorHealth: OracleSupplierConnectorHealth.AUTH_FAILED,
          oracleSupplierConnectorLastError: expect.stringContaining('401'),
        }),
      }),
    );
  });

  it('clears last error on successful sync', async () => {
    const { service, prisma } = buildService({ restEnabled: true });
    await service.recordSuccessfulSync(organizationId);

    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          oracleSupplierConnectorHealth: OracleSupplierConnectorHealth.HEALTHY,
          oracleSupplierConnectorLastError: null,
        },
      }),
    );
  });
});
