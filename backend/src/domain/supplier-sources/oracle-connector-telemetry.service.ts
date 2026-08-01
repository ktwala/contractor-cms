import { BadRequestException, Injectable } from '@nestjs/common';
import {
  OracleSupplierConnectorHealth,
  SupplierSourceStagingMatchStatus,
  SupplierSourceSyncRunStatus,
  SupplierSourceSyncStatus,
  SupplierSourceSystem,
  SupplierStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { OracleProcurementHealthService } from '../../integration/oracle-procurement/oracle-procurement-health.service';
import { SupplierEvidenceChecklistService } from '../suppliers/supplier-evidence-checklist.service';
import { resolveSupplierJurisdictionCode } from '../suppliers/supplier-jurisdiction.constants';
import { resolveSupplierEvidenceAuthorityMode } from '../suppliers/supplier-evidence-policy';
import {
  OracleConnectorDriftTelemetryDto,
  OracleConnectorGovernanceTelemetryDto,
  OracleConnectorSyncTelemetryDto,
  OracleConnectorTelemetryResponseDto,
} from './dto/oracle-connector-telemetry.dto';
import { SupplierSyncAssessmentService } from './supplier-sync-assessment.service';
import { HcmSupplierReferenceReconciliationService } from './hcm-supplier-reference-reconciliation.service';
import {
  EMPTY_ORACLE_DRIFT_TELEMETRY,
  EMPTY_ORACLE_GOVERNANCE_TELEMETRY,
  isSupplierAssessmentTelemetryVisible,
} from './supplier-sync-assessment-telemetry-gate.util';

const PROMOTABLE_STAGING: SupplierSourceStagingMatchStatus[] = [
  SupplierSourceStagingMatchStatus.NEW,
  SupplierSourceStagingMatchStatus.MATCHED,
  SupplierSourceStagingMatchStatus.UNMATCHED,
  SupplierSourceStagingMatchStatus.POSSIBLE_MATCH,
];

const STAGING_BACKLOG_STATUSES: SupplierSourceStagingMatchStatus[] = [
  ...PROMOTABLE_STAGING,
  SupplierSourceStagingMatchStatus.CONFLICT,
];

/**
 * PR-CMS-CONNECTOR-1F — telemetry derived from sync-run ledger and staging tables.
 */
@Injectable()
export class OracleConnectorTelemetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthService: OracleProcurementHealthService,
    private readonly evidenceChecklist: SupplierEvidenceChecklistService,
    private readonly syncAssessment: SupplierSyncAssessmentService,
    private readonly hcmSupplierReferenceReconciliation: HcmSupplierReferenceReconciliationService,
  ) {}

  private resolveOrgId(accessContext: AccessContext): string {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return orgId;
  }

  async getTelemetry(
    accessContext: AccessContext,
  ): Promise<OracleConnectorTelemetryResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const [assessment, connector, governance, drift] = await Promise.all([
      this.syncAssessment.resolveStatus(organizationId),
      this.buildSyncTelemetry(organizationId),
      this.buildGovernanceTelemetry(organizationId),
      this.buildDriftTelemetry(organizationId),
    ]);

    const visible = isSupplierAssessmentTelemetryVisible(assessment.lifecyclePhase);

    return {
      organizationId,
      connector,
      governance: visible ? governance : EMPTY_ORACLE_GOVERNANCE_TELEMETRY,
      drift: visible ? drift : EMPTY_ORACLE_DRIFT_TELEMETRY,
      evaluatedAt: new Date().toISOString(),
    };
  }

  async buildSyncTelemetry(
    organizationId: string,
  ): Promise<OracleConnectorSyncTelemetryDto> {
    const runs = await this.prisma.supplierSourceSyncRun.findMany({
      where: { organizationId },
      select: {
        status: true,
        startedAt: true,
        finishedAt: true,
        importedCount: true,
        matchedCount: true,
        newCount: true,
        failedCount: true,
      },
    });

    const completed = runs.filter((r) => r.finishedAt != null);
    const durations = completed.map(
      (r) => r.finishedAt!.getTime() - r.startedAt.getTime(),
    );

    const latestCompleted = [...completed].sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
    )[0];
    const lastDuration = latestCompleted
      ? latestCompleted.finishedAt!.getTime() - latestCompleted.startedAt.getTime()
      : null;

    const averageDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

    const stagingBacklogCount = await this.prisma.supplierSourceStaging.count({
      where: {
        organizationId,
        matchStatus: { in: STAGING_BACKLOG_STATUSES },
      },
    });

    return {
      totalSyncRuns: runs.length,
      successfulSyncRuns: runs.filter(
        (r) => r.status === SupplierSourceSyncRunStatus.SUCCEEDED,
      ).length,
      failedSyncRuns: runs.filter(
        (r) => r.status === SupplierSourceSyncRunStatus.FAILED,
      ).length,
      partialSyncRuns: runs.filter(
        (r) => r.status === SupplierSourceSyncRunStatus.PARTIAL,
      ).length,
      runningSyncRuns: runs.filter(
        (r) => r.status === SupplierSourceSyncRunStatus.RUNNING,
      ).length,
      lastSyncDurationMs: lastDuration,
      averageSyncDurationMs: averageDuration,
      recordsImported: runs.reduce((sum, r) => sum + r.importedCount, 0),
      recordsMatched: runs.reduce((sum, r) => sum + r.matchedCount, 0),
      recordsNew: runs.reduce((sum, r) => sum + r.newCount, 0),
      recordsFailed: runs.reduce((sum, r) => sum + r.failedCount, 0),
      stagingBacklogCount,
    };
  }

  async buildGovernanceTelemetry(
    organizationId: string,
  ): Promise<OracleConnectorGovernanceTelemetryDto> {
    const oracleWhere = {
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: { not: null },
    };

    const [
      activeSuppliers,
      suspendedSuppliers,
      pendingCandidates,
      stagingPossibleMatches,
      stagingConflicts,
      oldestPromotable,
      healthSnapshot,
      org,
    ] = await Promise.all([
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
      this.prisma.supplierSourceStaging.count({
        where: {
          organizationId,
          matchStatus: SupplierSourceStagingMatchStatus.POSSIBLE_MATCH,
        },
      }),
      this.prisma.supplierSourceStaging.count({
        where: {
          organizationId,
          matchStatus: SupplierSourceStagingMatchStatus.CONFLICT,
        },
      }),
      this.prisma.supplierSourceStaging.findFirst({
        where: {
          organizationId,
          matchStatus: { in: PROMOTABLE_STAGING },
        },
        orderBy: { importedAt: 'asc' },
        select: { importedAt: true },
      }),
      this.healthService.getHealthSnapshot(organizationId),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { supplierAuthorityMode: true },
      }),
    ]);

    const hcmReferenceCounts =
      await this.hcmSupplierReferenceReconciliation.countOpenByKind(organizationId);
    const unresolvedPossibleMatches =
      stagingPossibleMatches + hcmReferenceCounts.possibleMatches;
    const reconciliationFailures = stagingConflicts + hcmReferenceCounts.conflicts;

    const evidenceAuthorityMode = resolveSupplierEvidenceAuthorityMode(
      org?.supplierAuthorityMode ?? 'CMS_ONLY',
    );

    let pendingEvidenceSuppliers = 0;
    if (evidenceAuthorityMode === 'ORACLE_PROCUREMENT_TRUSTED') {
      pendingEvidenceSuppliers = pendingCandidates.length + suspendedSuppliers;
    } else {
      for (const supplier of pendingCandidates) {
        const jurisdictionCode = resolveSupplierJurisdictionCode(
          supplier.country,
          supplier.countryCode,
        );
        const checklist = this.evidenceChecklist.evaluateChecklist(
          supplier.id,
          supplier.type,
          jurisdictionCode,
          supplier.documents,
        );
        if (!checklist.complete) {
          pendingEvidenceSuppliers += 1;
        }
      }
    }

    const promotionQueueAgeHours = oldestPromotable
      ? (Date.now() - oldestPromotable.importedAt.getTime()) / (60 * 60 * 1000)
      : null;

    const staleConnectorCount =
      healthSnapshot.health === OracleSupplierConnectorHealth.STALE ? 1 : 0;

    return {
      pendingEvidenceSuppliers,
      activeSuppliers,
      suspendedSuppliers,
      staleConnectorCount,
      promotionQueueAgeHours:
        promotionQueueAgeHours != null
          ? Math.round(promotionQueueAgeHours * 10) / 10
          : null,
      unresolvedPossibleMatches,
      reconciliationFailures,
    };
  }

  async buildDriftTelemetry(
    organizationId: string,
  ): Promise<OracleConnectorDriftTelemetryDto> {
    const oracleWhere = {
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: { not: null },
    };

    const [
      supplierSourceDriftCount,
      missingSourceRecords,
      duplicateExternalIds,
      promotionFailures,
    ] = await Promise.all([
      this.prisma.supplier.count({
        where: {
          ...oracleWhere,
          sourceSyncStatus: { not: SupplierSourceSyncStatus.SYNCED },
        },
      }),
      this.prisma.supplierSourceStaging.count({
        where: {
          organizationId,
          matchStatus: { in: PROMOTABLE_STAGING },
        },
      }),
      this.countDuplicateOracleExternalIds(organizationId),
      this.prisma.supplierSourceSyncRun.count({
        where: {
          organizationId,
          status: SupplierSourceSyncRunStatus.FAILED,
          errorCode: { contains: 'PROMOTION' },
        },
      }),
    ]);

    return {
      supplierSourceDriftCount,
      missingSourceRecords,
      duplicateExternalIds,
      promotionFailures,
    };
  }

  private async countDuplicateOracleExternalIds(
    organizationId: string,
  ): Promise<number> {
    const grouped = await this.prisma.supplier.groupBy({
      by: ['externalSupplierId'],
      where: {
        organizationId,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: { not: null },
      },
      _count: { id: true },
      having: {
        id: { _count: { gt: 1 } },
      },
    });
    return grouped.length;
  }
}
