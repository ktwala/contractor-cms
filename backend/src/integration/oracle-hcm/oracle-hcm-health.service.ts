import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HcmOracleConnectorHealth } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import {
  getHcmOracleStaleThresholdMs,
  isHcmOracleRestEnabled,
} from '../../core/config/oracle-hcm.config';
import { HttpOracleHcmRestClient } from './oracle-hcm-rest.client';
import { classifyHcmOracleUpstreamError } from './oracle-hcm-upstream.errors';
import {
  evaluateHcmConnectorEffectiveHealth,
  healthFromHcmUpstreamCode,
  isHcmConnectorSyncStale,
} from './oracle-hcm-health.util';

export type HcmConnectorHealthSnapshot = {
  organizationId: string;
  health: HcmOracleConnectorHealth;
  restEnabled: boolean;
  lastSuccessfulSyncAt: string | null;
  lastCursor: string | null;
  lastError: string | null;
  staleThresholdHours: number;
  isStale: boolean;
  evaluatedAt: string;
};

/**
 * PR-CTR-CONNECTOR-1D — HCM REST connector health + stale detection (no sync required).
 */
@Injectable()
export class OracleHcmHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly restClient: HttpOracleHcmRestClient,
  ) {}

  staleThresholdMs(): number {
    return getHcmOracleStaleThresholdMs(this.config);
  }

  staleThresholdHours(): number {
    return this.staleThresholdMs() / (60 * 60 * 1000);
  }

  isRestEnabled(): boolean {
    return isHcmOracleRestEnabled(this.config);
  }

  isStale(lastSuccessfulSyncAt: Date | null | undefined, now = new Date()): boolean {
    return isHcmConnectorSyncStale(
      lastSuccessfulSyncAt,
      this.staleThresholdMs(),
      now,
    );
  }

  async getHealthSnapshot(organizationId: string): Promise<HcmConnectorHealthSnapshot> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        oracleHcmLastSuccessfulSyncAt: true,
        oracleHcmLastCursor: true,
        oracleHcmConnectorHealth: true,
        oracleHcmConnectorLastError: true,
      },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    const restEnabled = this.isRestEnabled();
    const health = evaluateHcmConnectorEffectiveHealth({
      restEnabled,
      storedHealth: org.oracleHcmConnectorHealth,
      lastSuccessfulSyncAt: org.oracleHcmLastSuccessfulSyncAt,
      staleThresholdMs: this.staleThresholdMs(),
    });

    const stale =
      restEnabled &&
      this.isStale(org.oracleHcmLastSuccessfulSyncAt) &&
      health === HcmOracleConnectorHealth.STALE;

    return {
      organizationId: org.id,
      health,
      restEnabled,
      lastSuccessfulSyncAt:
        org.oracleHcmLastSuccessfulSyncAt?.toISOString() ?? null,
      lastCursor: org.oracleHcmLastCursor,
      lastError: org.oracleHcmConnectorLastError,
      staleThresholdHours: this.staleThresholdHours(),
      isStale: stale,
      evaluatedAt: new Date().toISOString(),
    };
  }

  async persistConnectorState(
    organizationId: string,
    health: HcmOracleConnectorHealth,
    lastError: string | null,
  ): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        oracleHcmConnectorHealth: health,
        oracleHcmConnectorLastError: lastError,
      },
    });
  }

  async recordUpstreamFailure(
    organizationId: string,
    err: unknown,
  ): Promise<HcmOracleConnectorHealth> {
    if (!this.isRestEnabled()) {
      await this.persistConnectorState(
        organizationId,
        HcmOracleConnectorHealth.DISABLED,
        'Oracle HCM REST is disabled',
      );
      return HcmOracleConnectorHealth.DISABLED;
    }

    const classified = classifyHcmOracleUpstreamError(err);
    const health = healthFromHcmUpstreamCode(classified.upstreamCode);
    await this.persistConnectorState(organizationId, health, classified.message);
    return health;
  }

  async recordSuccessfulRestSync(organizationId: string): Promise<void> {
    await this.persistConnectorState(organizationId, HcmOracleConnectorHealth.HEALTHY, null);
  }
}
