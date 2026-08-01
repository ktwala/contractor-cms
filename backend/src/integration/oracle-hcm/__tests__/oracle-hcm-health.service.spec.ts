import { ConfigService } from '@nestjs/config';
import { HcmOracleConnectorHealth } from '@prisma/client';
import { HcmOracleUpstreamException } from '../oracle-hcm-upstream.errors';
import { OracleHcmHealthService } from '../oracle-hcm-health.service';
import { HttpOracleHcmRestClient } from '../oracle-hcm-rest.client';

describe('OracleHcmHealthService (PR-CTR-CONNECTOR-1D)', () => {
  const organizationId = 'org-hcm-health-1';

  function buildService(options?: {
    restEnabled?: boolean;
    staleHours?: string;
    org?: {
      oracleHcmLastSuccessfulSyncAt: Date | null;
      oracleHcmLastCursor: string | null;
      oracleHcmConnectorHealth: HcmOracleConnectorHealth;
      oracleHcmConnectorLastError: string | null;
    };
  }) {
    const org = options?.org ?? {
      oracleHcmLastSuccessfulSyncAt: null,
      oracleHcmLastCursor: null,
      oracleHcmConnectorHealth: HcmOracleConnectorHealth.UNKNOWN,
      oracleHcmConnectorLastError: null,
    };

    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: organizationId, ...org }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const config = {
      get: (key: string) => {
        if (key === 'HCM_ORACLE_REST_ENABLED') {
          return options?.restEnabled ? 'true' : 'false';
        }
        if (key === 'HCM_ORACLE_STALE_THRESHOLD_HOURS') {
          return options?.staleHours ?? '24';
        }
        return undefined;
      },
    } as ConfigService;

    const restClient = {
      isEnabled: jest.fn().mockReturnValue(options?.restEnabled ?? false),
    } as unknown as HttpOracleHcmRestClient;

    return {
      service: new OracleHcmHealthService(prisma as never, config, restClient),
      prisma,
    };
  }

  it('reports DISABLED on health snapshot when REST is off', async () => {
    const { service } = buildService({ restEnabled: false });
    const snapshot = await service.getHealthSnapshot(organizationId);
    expect(snapshot.health).toBe(HcmOracleConnectorHealth.DISABLED);
    expect(snapshot.restEnabled).toBe(false);
  });

  it('reports STALE from persisted last REST sync without running sync', async () => {
    const staleAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const { service } = buildService({
      restEnabled: true,
      org: {
        oracleHcmLastSuccessfulSyncAt: staleAt,
        oracleHcmLastCursor: 'cursor-1',
        oracleHcmConnectorHealth: HcmOracleConnectorHealth.HEALTHY,
        oracleHcmConnectorLastError: null,
      },
    });

    const snapshot = await service.getHealthSnapshot(organizationId);
    expect(snapshot.health).toBe(HcmOracleConnectorHealth.STALE);
    expect(snapshot.isStale).toBe(true);
  });

  it('records AUTH_FAILED on upstream 401/403', async () => {
    const { service, prisma } = buildService({ restEnabled: true });
    const health = await service.recordUpstreamFailure(
      organizationId,
      new HcmOracleUpstreamException('AUTH_FAILED', 'Oracle auth failed (401)', 401),
    );

    expect(health).toBe(HcmOracleConnectorHealth.AUTH_FAILED);
    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oracleHcmConnectorHealth: HcmOracleConnectorHealth.AUTH_FAILED,
          oracleHcmConnectorLastError: expect.stringContaining('401'),
        }),
      }),
    );
  });

  it('clears last error on successful REST sync', async () => {
    const { service, prisma } = buildService({ restEnabled: true });
    await service.recordSuccessfulRestSync(organizationId);

    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          oracleHcmConnectorHealth: HcmOracleConnectorHealth.HEALTHY,
          oracleHcmConnectorLastError: null,
        },
      }),
    );
  });
});
