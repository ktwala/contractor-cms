import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupplierSourceSyncStatus, SupplierStatus } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import {
  getOracleProcurementStaleThresholdMs,
  isOracleProcurementRestEnabled,
} from '../../core/config/oracle-procurement.config';
import { evaluateOracleConnectorEffectiveHealth } from '../../integration/oracle-procurement/oracle-procurement-health.util';
import { SupplierEvidenceChecklistService } from './supplier-evidence-checklist.service';
import {
  SupplierGovernanceDashboardDto,
  SupplierGovernanceDashboardBucketsDto,
} from './dto/supplier-governance-dashboard.dto';
import {
  buildOracleLinkedSupplierWhere,
  filterSuppliersByPendingEvidence,
} from './supplier-governance-query.util';
import { resolveSupplierEvidenceAuthorityMode } from './supplier-evidence-policy';

/**
 * PR-CMS-GOV-1E — Oracle-linked supplier lifecycle buckets for ops visibility.
 */
@Injectable()
export class SupplierGovernanceDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceChecklist: SupplierEvidenceChecklistService,
    private readonly config: ConfigService,
  ) {}

  private resolveOrgId(accessContext: AccessContext): string {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return orgId;
  }

  async getDashboard(
    accessContext: AccessContext,
  ): Promise<SupplierGovernanceDashboardDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const oracleWhere = buildOracleLinkedSupplierWhere(organizationId);

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        supplierAuthorityMode: true,
        oracleSupplierConnectorHealth: true,
        oracleSupplierLastSuccessfulSyncAt: true,
        oracleSupplierConnectorLastError: true,
      },
    });

    const connectorHealth = org
      ? evaluateOracleConnectorEffectiveHealth({
          restEnabled: isOracleProcurementRestEnabled(this.config),
          storedHealth: org.oracleSupplierConnectorHealth,
          lastSuccessfulSyncAt: org.oracleSupplierLastSuccessfulSyncAt,
          staleThresholdMs: getOracleProcurementStaleThresholdMs(this.config),
        })
      : undefined;

    const [synced, active, suspended, pendingCandidates, oracleLinkedTotal] =
      await Promise.all([
        this.prisma.supplier.count({
          where: {
            ...oracleWhere,
            sourceSyncStatus: SupplierSourceSyncStatus.SYNCED,
          },
        }),
        this.prisma.supplier.count({
          where: { ...oracleWhere, status: SupplierStatus.ACTIVE },
        }),
        this.prisma.supplier.count({
          where: { ...oracleWhere, status: SupplierStatus.SUSPENDED },
        }),
        this.prisma.supplier.findMany({
          where: {
            ...oracleWhere,
            status: SupplierStatus.PENDING_APPROVAL,
          },
          select: {
            id: true,
            type: true,
            country: true,
            countryCode: true,
            sourceSystem: true,
            externalSupplierId: true,
            sourceSyncStatus: true,
            documents: {
              select: {
                id: true,
                type: true,
                fileName: true,
                expiryDate: true,
                uploadedAt: true,
              },
            },
          },
        }),
        this.prisma.supplier.count({ where: oracleWhere }),
      ]);

    const supplierAuthorityMode = org?.supplierAuthorityMode ?? 'CMS_ONLY';
    const evidenceAuthorityMode =
      resolveSupplierEvidenceAuthorityMode(supplierAuthorityMode);
    const pendingEvidence =
      evidenceAuthorityMode === 'ORACLE_PROCUREMENT_TRUSTED'
        ? pendingCandidates.length
        : filterSuppliersByPendingEvidence({
            suppliers: pendingCandidates,
            supplierAuthorityMode,
            evidenceChecklist: this.evidenceChecklist,
          }).length;

    const buckets: SupplierGovernanceDashboardBucketsDto = {
      synced,
      pendingEvidence,
      active,
      suspended,
    };

    return {
      organizationId,
      buckets,
      oracleLinkedTotal,
      oracleConnectorHealth: connectorHealth,
      oracleConnectorLastError: org?.oracleSupplierConnectorLastError ?? null,
    };
  }
}
