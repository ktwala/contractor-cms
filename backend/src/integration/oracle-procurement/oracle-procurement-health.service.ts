import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OracleSupplierConnectorHealth } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import {
  getOracleProcurementStaleThresholdMs,
  isOracleProcurementRestEnabled,
} from '../../core/config/oracle-procurement.config';
import { HttpOracleProcurementRestClient } from './oracle-procurement-rest.client';
import { classifyOracleUpstreamError } from './oracle-procurement-upstream.errors';
import {
  evaluateOracleConnectorEffectiveHealth,
  healthFromUpstreamCode,
  isConnectorSyncStale,
} from './oracle-procurement-health.util';

export type OracleConnectorHealthSnapshot = {
  organizationId: string;
  health: OracleSupplierConnectorHealth;
  restEnabled: boolean;
  lastSuccessfulSyncAt: string | null;
  lastCursor: string | null;
  lastError: string | null;
  staleThresholdHours: number;
  isStale: boolean;
  evaluatedAt: string;
};

/**
 * PR-CMS-CONNECTOR-1D–1E — connector health + stale detection (no sync required).
 */
@Injectable()
export class OracleProcurementHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly restClient: HttpOracleProcurementRestClient,
  ) {}

  staleThresholdMs(): number {
    return getOracleProcurementStaleThresholdMs(this.config);
  }

  staleThresholdHours(): number {
    return this.staleThresholdMs() / (60 * 60 * 1000);
  }

  isRestEnabled(): boolean {
    return isOracleProcurementRestEnabled(this.config);
  }

  isStale(lastSuccessfulSyncAt: Date | null | undefined, now = new Date()): boolean {
    return isConnectorSyncStale(
      lastSuccessfulSyncAt,
      this.staleThresholdMs(),
      now,
    );
  }

  async getHealthSnapshot(organizationId: string): Promise<OracleConnectorHealthSnapshot> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        oracleSupplierLastSuccessfulSyncAt: true,
        oracleSupplierLastCursor: true,
        oracleSupplierConnectorHealth: true,
        oracleSupplierConnectorLastError: true,
      },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    const restEnabled = this.isRestEnabled();
    const health = evaluateOracleConnectorEffectiveHealth({
      restEnabled,
      storedHealth: org.oracleSupplierConnectorHealth,
      lastSuccessfulSyncAt: org.oracleSupplierLastSuccessfulSyncAt,
      staleThresholdMs: this.staleThresholdMs(),
    });

    const stale =
      restEnabled &&
      this.isStale(org.oracleSupplierLastSuccessfulSyncAt) &&
      health === OracleSupplierConnectorHealth.STALE;

    return {
      organizationId: org.id,
      health,
      restEnabled,
      lastSuccessfulSyncAt:
        org.oracleSupplierLastSuccessfulSyncAt?.toISOString() ?? null,
      lastCursor: org.oracleSupplierLastCursor,
      lastError: org.oracleSupplierConnectorLastError,
      staleThresholdHours: this.staleThresholdHours(),
      isStale: stale,
      evaluatedAt: new Date().toISOString(),
    };
  }

  async persistConnectorState(
    organizationId: string,
    health: OracleSupplierConnectorHealth,
    lastError: string | null,
  ): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        oracleSupplierConnectorHealth: health,
        oracleSupplierConnectorLastError: lastError,
      },
    });
  }

  async recordUpstreamFailure(
    organizationId: string,
    err: unknown,
  ): Promise<OracleSupplierConnectorHealth> {
    if (!this.isRestEnabled()) {
      await this.persistConnectorState(
        organizationId,
        OracleSupplierConnectorHealth.DISABLED,
        'Oracle Procurement REST is disabled',
      );
      return OracleSupplierConnectorHealth.DISABLED;
    }

    const classified = classifyOracleUpstreamError(err);
    const health = healthFromUpstreamCode(classified.upstreamCode);
    await this.persistConnectorState(organizationId, health, classified.message);
    return health;
  }

  async recordSuccessfulSync(organizationId: string): Promise<void> {
    await this.persistConnectorState(organizationId, OracleSupplierConnectorHealth.HEALTHY, null);
  }
}
