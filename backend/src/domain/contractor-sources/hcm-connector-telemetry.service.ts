import { BadRequestException, Injectable } from '@nestjs/common';
import { ContractorGovernanceRemediationStatus } from '@prisma/client';
import {
  ContractorSourceSyncRunMode,
  ContractorSourceSyncRunStatus,
  ContractorWorkforceState,
  HcmContractorCorrelationConfidence,
  HcmContractorCorrelationMatchStatus,
  HcmMigrationPipelineStatus,
  HcmOracleConnectorHealth,
  HcmQuarantineReasonCode,
  HcmStagingValidationStatus,
  MigrationSourceSystem,
  SupplierStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { isUpstreamHcmLifecycleDriftEnabled } from '../../core/authority/contractor-lifecycle-authority.util';
import {
  COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX,
  excludeComparisonAnchorContractorsWhere,
  excludeComparisonAnchorSuppliersWhere,
} from '../demo/connector-demo-comparison.constants';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { OracleHcmHealthService } from '../../integration/oracle-hcm/oracle-hcm-health.service';
import { isUpstreamWorkforceTerminated } from './utils/hcm-workforce-risk.util';
import {
  HcmConnectorCorrelationTelemetryDto,
  HcmConnectorGovernanceTelemetryDto,
  HcmConnectorOperationalRiskTelemetryDto,
  HcmConnectorOperationalWorkforceTelemetryDto,
  HcmConnectorSyncTelemetryDto,
  HcmConnectorTelemetryResponseDto,
} from './dto/hcm-connector-telemetry.dto';
import { WorkforceAssessmentService } from './workforce-assessment.service';
import {
  summarizeWorkforceReadinessFromStaging,
  WORKFORCE_READINESS_STAGING_PIPELINES,
  type StagingReadinessRow,
} from './workforce-readiness-telemetry.util';
import { WORKFORCE_TELEMETRY_POPULATION_SCOPES } from './workforce-telemetry-population.constants';
import { SupplierOperationalTrustService } from '../suppliers/supplier-operational-trust.service';
import type { SupplierWorkforceLinkRef } from '../suppliers/supplier-workforce-link.util';
import {
  EMPTY_HCM_CORRELATION_TELEMETRY,
  EMPTY_HCM_GOVERNANCE_TELEMETRY,
  EMPTY_HCM_OPERATIONAL_WORKFORCE_TELEMETRY,
  gateHcmOperationalRiskTelemetry,
  isWorkforceAssessmentTelemetryVisible,
} from './workforce-assessment-telemetry-gate.util';

const ACTIVE_REMEDIATION_STATUSES: ContractorGovernanceRemediationStatus[] = [
  ContractorGovernanceRemediationStatus.OPEN,
  ContractorGovernanceRemediationStatus.ACKNOWLEDGED,
  ContractorGovernanceRemediationStatus.REMEDIATION_IN_PROGRESS,
  ContractorGovernanceRemediationStatus.VERIFIED,
];

const STAGING_BACKLOG_PIPELINES: HcmMigrationPipelineStatus[] = [
  HcmMigrationPipelineStatus.EXTRACTED,
  HcmMigrationPipelineStatus.NORMALIZED,
  HcmMigrationPipelineStatus.VALIDATED,
  HcmMigrationPipelineStatus.QUARANTINED,
  HcmMigrationPipelineStatus.APPROVED,
  HcmMigrationPipelineStatus.CTR_ISSUED,
];

/**
 * PR-CTR-CONNECTOR-1E — workforce telemetry from ledger + staging (not import optimism).
 */
@Injectable()
export class HcmConnectorTelemetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthService: OracleHcmHealthService,
    private readonly workforceAssessment: WorkforceAssessmentService,
    private readonly supplierOperationalTrust: SupplierOperationalTrustService,
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
  ): Promise<HcmConnectorTelemetryResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);
    const [assessment, connector, correlation, governance, operationalRisk, operationalWorkforce] =
      await Promise.all([
        this.workforceAssessment.resolveStatus(organizationId),
        this.buildSyncTelemetry(organizationId),
        this.buildCorrelationTelemetry(organizationId),
        this.buildGovernanceTelemetry(organizationId),
        this.buildOperationalRiskTelemetry(organizationId),
        this.buildOperationalWorkforceTelemetry(organizationId),
      ]);

    const visible = isWorkforceAssessmentTelemetryVisible(assessment.lifecyclePhase);

    return {
      organizationId,
      connector,
      correlation: visible ? correlation : EMPTY_HCM_CORRELATION_TELEMETRY,
      governance: visible ? governance : EMPTY_HCM_GOVERNANCE_TELEMETRY,
      operationalRisk: gateHcmOperationalRiskTelemetry(operationalRisk, assessment.lifecyclePhase),
      operationalWorkforce: visible
        ? operationalWorkforce
        : EMPTY_HCM_OPERATIONAL_WORKFORCE_TELEMETRY,
      evaluatedAt: new Date().toISOString(),
    };
  }

  async buildSyncTelemetry(
    organizationId: string,
  ): Promise<HcmConnectorSyncTelemetryDto> {
    const runs = await this.prisma.contractorSourceSyncRun.findMany({
      where: { organizationId },
      select: {
        status: true,
        startedAt: true,
        finishedAt: true,
        importedCount: true,
        matchedCount: true,
        newCount: true,
        failedCount: true,
        correlationFailures: true,
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

    const stagingBacklog = await this.prisma.hcmContractorStaging.count({
      where: {
        organizationId,
        pipelineStatus: { in: STAGING_BACKLOG_PIPELINES },
      },
    });

    return {
      totalSyncRuns: runs.length,
      successfulSyncRuns: runs.filter(
        (r) => r.status === ContractorSourceSyncRunStatus.SUCCEEDED,
      ).length,
      failedSyncRuns: runs.filter(
        (r) => r.status === ContractorSourceSyncRunStatus.FAILED,
      ).length,
      partialSyncRuns: runs.filter(
        (r) => r.status === ContractorSourceSyncRunStatus.PARTIAL,
      ).length,
      runningSyncRuns: runs.filter(
        (r) => r.status === ContractorSourceSyncRunStatus.RUNNING,
      ).length,
      lastSyncDurationMs: lastDuration,
      averageSyncDurationMs: averageDuration,
      workersImported: runs.reduce((sum, r) => sum + r.importedCount, 0),
      workersMatched: runs.reduce((sum, r) => sum + r.matchedCount, 0),
      workersNew: runs.reduce((sum, r) => sum + r.newCount, 0),
      workersFailed: runs.reduce((sum, r) => sum + r.failedCount, 0),
      correlationFailures: runs.reduce((sum, r) => sum + r.correlationFailures, 0),
      stagingBacklog,
    };
  }

  async buildCorrelationTelemetry(
    organizationId: string,
  ): Promise<HcmConnectorCorrelationTelemetryDto> {
    const [
      highConfidenceMatches,
      lowConfidenceMatches,
      manualReviewRequired,
      correlationConflicts,
      unlinkedWorkers,
    ] = await Promise.all([
      this.prisma.hcmContractorStaging.count({
        where: {
          organizationId,
          correlationMatchStatus: HcmContractorCorrelationMatchStatus.MATCHED,
          correlationConfidence: HcmContractorCorrelationConfidence.HIGH,
        },
      }),
      this.prisma.hcmContractorStaging.count({
        where: {
          organizationId,
          correlationMatchStatus: HcmContractorCorrelationMatchStatus.POSSIBLE_MATCH,
          correlationConfidence: HcmContractorCorrelationConfidence.LOW,
        },
      }),
      this.prisma.hcmContractorStaging.count({
        where: {
          organizationId,
          OR: [
            { correlationConfidence: HcmContractorCorrelationConfidence.MANUAL_REVIEW },
            { correlationMatchStatus: HcmContractorCorrelationMatchStatus.CONFLICT },
          ],
        },
      }),
      this.prisma.hcmContractorStaging.count({
        where: {
          organizationId,
          correlationMatchStatus: HcmContractorCorrelationMatchStatus.CONFLICT,
        },
      }),
      this.prisma.hcmContractorStaging.count({
        where: {
          organizationId,
          correlationMatchStatus: {
            in: [
              HcmContractorCorrelationMatchStatus.NEW,
              HcmContractorCorrelationMatchStatus.UNMATCHED,
            ],
          },
          proposedContractorId: null,
        },
      }),
    ]);

    return {
      highConfidenceMatches,
      lowConfidenceMatches,
      manualReviewRequired,
      correlationConflicts,
      unlinkedWorkers,
    };
  }

  async buildGovernanceTelemetry(
    organizationId: string,
  ): Promise<HcmConnectorGovernanceTelemetryDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { contractorAuthorityMode: true },
    });
    const upstreamLifecycleTelemetryEnabled = isUpstreamHcmLifecycleDriftEnabled(
      org?.contractorAuthorityMode ?? 'CMS_ONLY',
    );

    const supplierIds = await this.supplierIdsForOrg(organizationId);
    const hcmContractorWhere =
      supplierIds.length > 0
        ? {
            supplierId: { in: supplierIds },
            legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
            ...excludeComparisonAnchorContractorsWhere(),
          }
        : { id: { in: [] as string[] } };

    const [
      pendingVerificationContractors,
      activeContractors,
      blockedContractors,
      terminatedUpstreamButActive,
      readinessSummary,
    ] = await Promise.all([
      this.prisma.hcmContractorStaging.count({
        where: {
          organizationId,
          pipelineStatus: { not: HcmMigrationPipelineStatus.PROMOTED },
          validationStatus: {
            in: [
              HcmStagingValidationStatus.PENDING,
              HcmStagingValidationStatus.PASSED,
            ],
          },
        },
      }),
      supplierIds.length > 0
        ? this.prisma.contractor.count({
            where: { ...hcmContractorWhere, isActive: true },
          })
        : Promise.resolve(0),
      supplierIds.length > 0
        ? this.prisma.contractor.count({
            where: { ...hcmContractorWhere, isActive: false },
          })
        : Promise.resolve(0),
      upstreamLifecycleTelemetryEnabled
        ? this.countTerminatedUpstreamButActive(organizationId)
        : Promise.resolve(0),
      this.buildWorkforceReadinessSummary(organizationId),
    ]);

    return {
      pendingVerificationContractors,
      activeContractors,
      blockedContractors,
      terminatedUpstreamButActive,
      missingResponsibleManagerCount: readinessSummary.missingResponsibleManagerCount,
      missingSupplierLinks: readinessSummary.missingSupplierLinks,
      workersBlockedPendingSupplierTrust: readinessSummary.workersBlockedPendingSupplierTrust,
      workersBlockedSuspendedSupplier: readinessSummary.workersBlockedSuspendedSupplier,
      workersAssessed: readinessSummary.workersAssessed,
      workersNotReadyUnique: readinessSummary.workersNotReadyUnique,
      readinessReasonsDetected: readinessSummary.readinessReasonsDetected,
      duplicateWorkerCount: readinessSummary.duplicateWorkerCount,
    };
  }

  async buildWorkforceReadinessSummary(organizationId: string) {
    const untrustedSuppliers = await this.prisma.supplier.findMany({
      where: {
        organizationId,
        status: { not: SupplierStatus.ACTIVE },
        ...excludeComparisonAnchorSuppliersWhere(),
      },
      select: {
        id: true,
        status: true,
        companyName: true,
        tradingName: true,
      },
    });

    const stagingRows = await this.prisma.hcmContractorStaging.findMany({
      where: {
        organizationId,
        pipelineStatus: { in: WORKFORCE_READINESS_STAGING_PIPELINES },
      },
      select: {
        id: true,
        normalizedPayloadJson: true,
        correlationMatchStatus: true,
        correlationConfidence: true,
        proposedContractorId: true,
        proposedContractor: {
          select: {
            isActive: true,
            engagements: {
              where: { isActive: true },
              select: { responsibleManagerEmployeeId: true },
            },
          },
        },
        quarantineEntries: {
          select: { reasonCode: true },
        },
      },
    });

    const trustCounts =
      await this.supplierOperationalTrust.summarizeWorkforceImpactTrustCounts(organizationId);

    return summarizeWorkforceReadinessFromStaging(
      stagingRows as StagingReadinessRow[],
      untrustedSuppliers as SupplierWorkforceLinkRef[],
      trustCounts,
    );
  }

  async buildOperationalWorkforceTelemetry(
    organizationId: string,
  ): Promise<HcmConnectorOperationalWorkforceTelemetryDto> {
    const supplierIds = await this.supplierIdsForOrg(organizationId);
    const hcmContractorWhere =
      supplierIds.length > 0
        ? {
            supplierId: { in: supplierIds },
            legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
            ...excludeComparisonAnchorContractorsWhere(),
          }
        : { id: { in: [] as string[] } };

    const [
      registryTotal,
      operationallyReady,
      blocked,
      suspendedInactive,
      exited,
      restrictedRows,
    ] = await Promise.all([
      this.prisma.contractor.count({
        where: hcmContractorWhere,
      }),
      this.prisma.contractor.count({
        where: {
          ...hcmContractorWhere,
          workforceState: ContractorWorkforceState.ACTIVE,
          isActive: true,
        },
      }),
      this.prisma.contractor.count({
        where: {
          ...hcmContractorWhere,
          workforceState: {
            in: [ContractorWorkforceState.REJECTED, ContractorWorkforceState.BLACKLISTED],
          },
        },
      }),
      this.prisma.contractor.count({
        where: {
          ...hcmContractorWhere,
          OR: [
            { workforceState: ContractorWorkforceState.SUSPENDED },
            {
              isActive: false,
              workforceState: { not: ContractorWorkforceState.TERMINATED },
            },
          ],
        },
      }),
      this.prisma.contractor.count({
        where: {
          ...hcmContractorWhere,
          workforceState: ContractorWorkforceState.TERMINATED,
        },
      }),
      this.prisma.contractorGovernanceRemediation.findMany({
        where: {
          organizationId,
          remediationStatus: { in: ACTIVE_REMEDIATION_STATUSES },
          pdpRestrictionsApplied: true,
          contractor: hcmContractorWhere,
        },
        select: { contractorId: true },
        distinct: ['contractorId'],
      }),
    ]);

    return {
      populationScope: WORKFORCE_TELEMETRY_POPULATION_SCOPES.materializedHcmContractors,
      registryTotal,
      operationallyReady,
      blocked,
      restricted: restrictedRows.filter((row) => row.contractorId != null).length,
      suspendedInactive,
      exited,
    };
  }

  private async countUnsponsoredActiveContractors(
    organizationId: string,
    supplierIds: string[],
  ): Promise<number> {
    if (supplierIds.length === 0) {
      return 0;
    }
    return this.prisma.contractor.count({
      where: {
        supplierId: { in: supplierIds },
        isActive: true,
        legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
        legacySourcePersonId: { not: null },
        email: { not: { startsWith: COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX } },
        engagements: {
          none: {
            isActive: true,
            responsibleManagerEmployeeId: { not: null },
          },
        },
      },
    });
  }

  async buildOperationalRiskTelemetry(
    organizationId: string,
  ): Promise<HcmConnectorOperationalRiskTelemetryDto> {
    const [healthSnapshot, failedSyncRuns, checkpointGapCount, identityConflictCount] =
      await Promise.all([
        this.healthService.getHealthSnapshot(organizationId),
        this.prisma.contractorSourceSyncRun.count({
          where: {
            organizationId,
            status: ContractorSourceSyncRunStatus.FAILED,
          },
        }),
        this.prisma.contractorSourceSyncRun.count({
          where: {
            organizationId,
            mode: ContractorSourceSyncRunMode.INCREMENTAL,
            status: ContractorSourceSyncRunStatus.FAILED,
            errorCode: { not: 'DISABLED' },
          },
        }),
        this.prisma.hcmContractorStaging.count({
          where: {
            organizationId,
            correlationMatchStatus: HcmContractorCorrelationMatchStatus.CONFLICT,
          },
        }),
      ]);

    return {
      staleConnectorCount:
        healthSnapshot.health === HcmOracleConnectorHealth.STALE ? 1 : 0,
      failedSyncRuns,
      checkpointGapCount,
      identityConflictCount,
    };
  }

  private async supplierIdsForOrg(organizationId: string): Promise<string[]> {
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        organizationId,
        ...excludeComparisonAnchorSuppliersWhere(),
      },
      select: { id: true },
    });
    return suppliers.map((s) => s.id);
  }

  private async countMissingSupplierLinks(organizationId: string): Promise<number> {
    const [quarantineCount, stagingRows] = await Promise.all([
      this.prisma.hcmContractorQuarantine.count({
        where: {
          organizationId,
          reasonCode: HcmQuarantineReasonCode.SUPPLIER_UNRESOLVED,
        },
      }),
      this.prisma.hcmContractorStaging.findMany({
        where: {
          organizationId,
          pipelineStatus: { not: HcmMigrationPipelineStatus.PROMOTED },
        },
        select: { normalizedPayloadJson: true },
      }),
    ]);

    const stagingWithoutSupplier = stagingRows.filter((row) => {
      const normalized = row.normalizedPayloadJson as { supplier?: string | null } | null;
      return !normalized?.supplier?.trim();
    }).length;

    return quarantineCount + stagingWithoutSupplier;
  }

  async countTerminatedUpstreamButActive(organizationId: string): Promise<number> {
    const rows = await this.prisma.hcmContractorStaging.findMany({
      where: {
        organizationId,
        OR: [
          { proposedContractorId: { not: null } },
          { promotedContractorId: { not: null } },
        ],
      },
      select: {
        normalizedPayloadJson: true,
        proposedContractorId: true,
        promotedContractorId: true,
        proposedContractor: { select: { isActive: true } },
      },
    });

    const promotedIds = rows
      .map((r) => r.promotedContractorId)
      .filter((id): id is string => id != null);

    const promotedActive = new Map<string, boolean>();
    if (promotedIds.length > 0) {
      const contractors = await this.prisma.contractor.findMany({
        where: { id: { in: promotedIds } },
        select: { id: true, isActive: true },
      });
      for (const c of contractors) {
        promotedActive.set(c.id, c.isActive);
      }
    }

    let count = 0;
    for (const row of rows) {
      if (!isUpstreamWorkforceTerminated(row.normalizedPayloadJson)) {
        continue;
      }
      const contractorId = row.proposedContractorId ?? row.promotedContractorId;
      if (!contractorId) {
        continue;
      }
      const isActive =
        row.proposedContractor?.isActive ?? promotedActive.get(contractorId) ?? false;
      if (isActive) {
        count += 1;
      }
    }
    return count;
  }
}
