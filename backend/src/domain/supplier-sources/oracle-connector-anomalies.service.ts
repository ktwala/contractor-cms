import { BadRequestException, Injectable } from '@nestjs/common';
import {
  SupplierSourceStagingMatchStatus,
  SupplierSourceSyncRunStatus,
  SupplierSourceSyncStatus,
  SupplierSourceSystem,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import {
  OracleConnectorAnomaliesResponseDto,
  OracleConnectorAnomalyItemDto,
} from './dto/oracle-connector-anomalies.dto';

/**
 * PR-CMS-CONNECTOR-1F — operational anomaly surfacing (pre–CONNECTOR-4 drift engine).
 */
@Injectable()
export class OracleConnectorAnomaliesService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveOrgId(accessContext: AccessContext): string {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return orgId;
  }

  async getAnomalies(
    accessContext: AccessContext,
  ): Promise<OracleConnectorAnomaliesResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const anomalies: OracleConnectorAnomalyItemDto[] = [];

    const [
      conflictStaging,
      possibleMatchStaging,
      driftSuppliers,
      duplicateIds,
      recentFailedRuns,
    ] = await Promise.all([
      this.prisma.supplierSourceStaging.findMany({
        where: {
          organizationId,
          matchStatus: SupplierSourceStagingMatchStatus.CONFLICT,
        },
        take: 1,
        select: { id: true, externalSupplierId: true },
      }),
      this.prisma.supplierSourceStaging.findMany({
        where: {
          organizationId,
          matchStatus: SupplierSourceStagingMatchStatus.POSSIBLE_MATCH,
        },
        take: 1,
        select: { id: true, externalSupplierId: true },
      }),
      this.prisma.supplier.findMany({
        where: {
          organizationId,
          sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
          externalSupplierId: { not: null },
          sourceSyncStatus: { not: SupplierSourceSyncStatus.SYNCED },
        },
        take: 1,
        select: { id: true, externalSupplierId: true },
      }),
      this.prisma.supplier.groupBy({
        by: ['externalSupplierId'],
        where: {
          organizationId,
          sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
          externalSupplierId: { not: null },
        },
        _count: { id: true },
        having: { id: { _count: { gt: 1 } } },
      }),
      this.prisma.supplierSourceSyncRun.findMany({
        where: {
          organizationId,
          status: SupplierSourceSyncRunStatus.FAILED,
        },
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: { id: true, errorCode: true, errorMessage: true },
      }),
    ]);

    const conflictCount = await this.prisma.supplierSourceStaging.count({
      where: {
        organizationId,
        matchStatus: SupplierSourceStagingMatchStatus.CONFLICT,
      },
    });
    if (conflictCount > 0) {
      anomalies.push({
        code: 'STAGING_RECONCILIATION_CONFLICT',
        severity: 'high',
        message: 'Staging rows blocked by reconciliation conflict',
        count: conflictCount,
        sampleStagingId: conflictStaging[0]?.id ?? null,
        sampleExternalSupplierId: conflictStaging[0]?.externalSupplierId ?? null,
      });
    }

    const possibleCount = await this.prisma.supplierSourceStaging.count({
      where: {
        organizationId,
        matchStatus: SupplierSourceStagingMatchStatus.POSSIBLE_MATCH,
      },
    });
    if (possibleCount > 0) {
      anomalies.push({
        code: 'UNRESOLVED_POSSIBLE_MATCH',
        severity: 'medium',
        message: 'Possible matches awaiting operator review',
        count: possibleCount,
        sampleStagingId: possibleMatchStaging[0]?.id ?? null,
        sampleExternalSupplierId: possibleMatchStaging[0]?.externalSupplierId ?? null,
      });
    }

    const driftCount = await this.prisma.supplier.count({
      where: {
        organizationId,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: { not: null },
        sourceSyncStatus: { not: SupplierSourceSyncStatus.SYNCED },
      },
    });
    if (driftCount > 0) {
      anomalies.push({
        code: 'SUPPLIER_SOURCE_DRIFT',
        severity: 'medium',
        message: 'Oracle-linked suppliers not in SYNCED governance state',
        count: driftCount,
        sampleExternalSupplierId: driftSuppliers[0]?.externalSupplierId ?? null,
      });
    }

    if (duplicateIds.length > 0) {
      anomalies.push({
        code: 'DUPLICATE_ORACLE_EXTERNAL_ID',
        severity: 'high',
        message: 'Multiple CMS governance records share the same Oracle external ID',
        count: duplicateIds.length,
        sampleExternalSupplierId: duplicateIds[0].externalSupplierId,
      });
    }

    if (recentFailedRuns.length > 0) {
      const failedCount = await this.prisma.supplierSourceSyncRun.count({
        where: {
          organizationId,
          status: SupplierSourceSyncRunStatus.FAILED,
        },
      });
      anomalies.push({
        code: 'SYNC_RUN_FAILURE',
        severity: 'high',
        message: 'Recent connector sync runs failed',
        count: failedCount,
        sampleStagingId: recentFailedRuns[0]?.id ?? null,
      });
    }

    const totalAnomalyCount = anomalies.reduce((sum, a) => sum + a.count, 0);

    return {
      organizationId,
      anomalies,
      totalAnomalyCount,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
