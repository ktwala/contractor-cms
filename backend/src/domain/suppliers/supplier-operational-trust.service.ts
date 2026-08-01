import { Injectable, NotFoundException } from '@nestjs/common';
import { ContractorWorkforceState, SupplierSourceSystem, SupplierStatus } from '@prisma/client';
import { WORKFORCE_READINESS_STAGING_PIPELINES } from '../contractor-sources/workforce-readiness-telemetry.util';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { assertSupplierEntityAccess } from '../../core/auth/utils/supplier-scope.helper';
import {
  SupplierOperationalTrustEvidenceDto,
  SupplierOperationalTrustEventDto,
} from './dto/supplier-operational-trust-evidence.dto';
import {
  SUPPLIER_GOVERNANCE_WORKFORCE_IMPACT_POPULATION_SCOPE,
  SupplierOperationalTrustWorkforceImpactDto,
  SupplierOperationalTrustWorkforceImpactFindingDto,
} from './dto/supplier-operational-trust-workforce-impact.dto';
import { SupplierOperationalTrustIntegrityReportDto } from './dto/supplier-operational-trust-integrity.dto';
import { SUPPLIER_GOVERNANCE_INTEGRITY_VIOLATION_SAMPLE_LIMIT } from './supplier-operational-trust-integrity.constants';
import {
  assembleIntegrityReport,
  buildIntegrityInvariantResult,
  emptyIntegrityReport,
} from './supplier-operational-trust-integrity.util';
import { excludeComparisonAnchorSuppliersWhere } from '../demo/connector-demo-comparison.constants';
import {
  matchStagingVendorToSupplier,
  vendorFromNormalizedPayload,
  type SupplierWorkforceLinkRef,
} from './supplier-workforce-link.util';
import { isSupplierOperationalTrustGranted } from './supplier-operational-trust.util';

const OPERATIONAL_TRUST_AUDIT_ACTIONS = [
  'SUPPLIER_APPROVED',
  'SUPPLIER_SUSPENDED',
  'SUPPLIER_REJECTED',
] as const;

function operationalTrustStateLabel(status: SupplierStatus): string {
  switch (status) {
    case SupplierStatus.ACTIVE:
      return 'Operational Trust Granted';
    case SupplierStatus.PENDING_APPROVAL:
      return 'Operational Trust Pending';
    case SupplierStatus.SUSPENDED:
      return 'Operational Trust Suspended';
    default:
      return 'Operational Trust not evaluated';
  }
}

function mapAuditAction(
  action: string,
  metadata: Record<string, unknown> | null,
): SupplierOperationalTrustEventDto['kind'] | null {
  switch (action) {
    case 'SUPPLIER_APPROVED':
      return metadata?.fromStatus === SupplierStatus.SUSPENDED ? 'RESTORED' : 'GRANTED';
    case 'SUPPLIER_SUSPENDED':
      return 'SUSPENDED';
    case 'SUPPLIER_REJECTED':
      return 'DENIED';
    default:
      return null;
  }
}

function eventLabel(kind: SupplierOperationalTrustEventDto['kind']): string {
  switch (kind) {
    case 'GRANTED':
      return 'Operational Trust Granted';
    case 'RESTORED':
      return 'Operational Trust Restored';
    case 'SUSPENDED':
      return 'Operational Trust Suspended';
    case 'DENIED':
      return 'Operational Trust Denied';
    default:
      return 'Operational Trust changed';
  }
}

@Injectable()
export class SupplierOperationalTrustService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvidence(
    accessContext: AccessContext,
    supplierId: string,
  ): Promise<SupplierOperationalTrustEvidenceDto> {
    assertSupplierEntityAccess(accessContext, supplierId);

    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        ...(accessContext.isGlobalAccess
          ? {}
          : { organizationId: accessContext.targetOrganizationId ?? undefined }),
      },
      select: {
        id: true,
        status: true,
        externalSupplierId: true,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const rows = await this.prisma.auditLog.findMany({
      where: {
        targetType: 'Supplier',
        targetId: supplierId,
        action: { in: [...OPERATIONAL_TRUST_AUDIT_ACTIONS] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        actor: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const events: SupplierOperationalTrustEventDto[] = rows
      .map((row) => {
        const meta = row.metadata as Record<string, unknown> | null;
        const kind = mapAuditAction(row.action, meta);
        if (!kind) return null;
        const reason = typeof meta?.reason === 'string' ? meta.reason : null;
        const actor = row.actor;
        const actorDisplayName = actor
          ? [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim() || actor.email
          : null;
        return {
          kind,
          label: eventLabel(kind),
          actorDisplayName,
          occurredAt: row.createdAt.toISOString(),
          reason,
        };
      })
      .filter((event): event is SupplierOperationalTrustEventDto => event != null);

    const latestGrant =
      events.find((event) => event.kind === 'GRANTED' || event.kind === 'RESTORED') ?? null;
    const latestSuspension =
      events.find((event) => event.kind === 'SUSPENDED' || event.kind === 'DENIED') ?? null;

    return {
      supplierId: supplier.id,
      currentStateLabel: operationalTrustStateLabel(supplier.status),
      oracleProcurementLabel: supplier.externalSupplierId ? 'Approved' : null,
      events,
      latestGrant,
      latestSuspension,
    };
  }

  /**
   * Supplier Governance owns workforce impact from Operational Trust state.
   * Workforce Discovery consumes this projection — it does not recompute supplier impact.
   */
  async listWorkforceImpactFindings(
    accessContext: AccessContext,
  ): Promise<SupplierOperationalTrustWorkforceImpactDto> {
    const organizationId = accessContext.targetOrganizationId;
    if (!organizationId) {
      return {
        findings: [],
        workersAssessedPopulation: 0,
        populationScope: SUPPLIER_GOVERNANCE_WORKFORCE_IMPACT_POPULATION_SCOPE,
        evaluatedAt: new Date().toISOString(),
      };
    }

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
      select: { normalizedPayloadJson: true },
    });

    const populationMeta = {
      workersAssessedPopulation: stagingRows.length,
      populationScope: SUPPLIER_GOVERNANCE_WORKFORCE_IMPACT_POPULATION_SCOPE,
    };

    if (untrustedSuppliers.length === 0) {
      return {
        findings: [],
        ...populationMeta,
        evaluatedAt: new Date().toISOString(),
      };
    }

    const counts = new Map<string, number>();
    for (const row of stagingRows) {
      const vendor = vendorFromNormalizedPayload(row.normalizedPayloadJson);
      if (!vendor) continue;
      const match = matchStagingVendorToSupplier(
        vendor,
        untrustedSuppliers as SupplierWorkforceLinkRef[],
      );
      if (match) {
        counts.set(match.id, (counts.get(match.id) ?? 0) + 1);
      }
    }

    const findings: SupplierOperationalTrustWorkforceImpactFindingDto[] = untrustedSuppliers
      .filter((supplier) => (counts.get(supplier.id) ?? 0) > 0)
      .map((supplier) => ({
        supplierId: supplier.id,
        supplierName: supplier.tradingName ?? supplier.companyName ?? supplier.id,
        operationalTrustStatus: supplier.status,
        operationalTrustLabel: operationalTrustStateLabel(supplier.status),
        affectedWorkerCount: counts.get(supplier.id) ?? 0,
        impactSummary: 'Workers cannot be operationalized.',
        resolutionAction:
          supplier.status === SupplierStatus.SUSPENDED
            ? 'Restore Operational Trust'
            : 'Grant Operational Trust',
      }))
      .sort((a, b) => b.affectedWorkerCount - a.affectedWorkerCount);

    return {
      findings,
      ...populationMeta,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /** Trust-blocked worker totals for workforce readiness telemetry (owned here, not in Workforce Discovery). */
  async summarizeWorkforceImpactTrustCounts(organizationId: string): Promise<{
    workersBlockedPendingSupplierTrust: number;
    workersBlockedSuspendedSupplier: number;
  }> {
    const { findings } = await this.listWorkforceImpactFindings({
      targetOrganizationId: organizationId,
      isGlobalAccess: true,
    } as AccessContext);

    return {
      workersBlockedPendingSupplierTrust: findings
        .filter((f) => f.operationalTrustStatus === SupplierStatus.PENDING_APPROVAL)
        .reduce((sum, f) => sum + f.affectedWorkerCount, 0),
      workersBlockedSuspendedSupplier: findings
        .filter((f) => f.operationalTrustStatus === SupplierStatus.SUSPENDED)
        .reduce((sum, f) => sum + f.affectedWorkerCount, 0),
    };
  }

  /**
   * Governance Integrity — evaluates whether Supplier Governance business invariants hold.
   * First integrity inspection in the platform (Joiner / Mover will follow the same pattern).
   */
  async evaluateIntegrity(
    accessContext: AccessContext,
  ): Promise<SupplierOperationalTrustIntegrityReportDto> {
    const organizationId = accessContext.targetOrganizationId;
    if (!organizationId) {
      return emptyIntegrityReport();
    }

    const supplierAnchorWhere = excludeComparisonAnchorSuppliersWhere();
    const operationalWorkerWhere = {
      organizationId,
      workforceState: ContractorWorkforceState.ACTIVE,
      isActive: true,
    };

    const [stagingRows, untrustedOperationalWorkers, suspendedSuppliers, pendingSuppliers, grantedOracleSuppliers] =
      await Promise.all([
        this.prisma.supplierSourceStaging.findMany({
          where: { organizationId },
          select: { externalSupplierId: true },
        }),
        this.prisma.contractor.findMany({
          where: {
            ...operationalWorkerWhere,
            supplier: {
              status: { not: SupplierStatus.ACTIVE },
              ...supplierAnchorWhere,
            },
          },
          select: {
            id: true,
            supplier: {
              select: {
                id: true,
                status: true,
                companyName: true,
                tradingName: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: SUPPLIER_GOVERNANCE_INTEGRITY_VIOLATION_SAMPLE_LIMIT,
        }),
        this.prisma.supplier.findMany({
          where: {
            organizationId,
            status: SupplierStatus.SUSPENDED,
            ...supplierAnchorWhere,
          },
          select: {
            id: true,
            companyName: true,
            tradingName: true,
          },
        }),
        this.prisma.supplier.findMany({
          where: {
            organizationId,
            status: SupplierStatus.PENDING_APPROVAL,
            ...supplierAnchorWhere,
          },
          select: {
            id: true,
            companyName: true,
            tradingName: true,
          },
        }),
        this.prisma.supplier.findMany({
          where: {
            organizationId,
            status: SupplierStatus.ACTIVE,
            sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
            externalSupplierId: { not: null },
            ...supplierAnchorWhere,
          },
          select: {
            id: true,
            externalSupplierId: true,
            companyName: true,
            tradingName: true,
          },
        }),
      ]);

    const stagingExternalIds = new Set(
      stagingRows
        .map((row) => row.externalSupplierId)
        .filter((id): id is string => Boolean(id)),
    );

    const untrustedSupplierIds = [
      ...new Set([
        ...suspendedSuppliers.map((supplier) => supplier.id),
        ...pendingSuppliers.map((supplier) => supplier.id),
      ]),
    ];

    const operationalCountsBySupplier =
      untrustedSupplierIds.length === 0
        ? []
        : await this.prisma.contractor.groupBy({
            by: ['supplierId'],
            where: {
              ...operationalWorkerWhere,
              supplierId: { in: untrustedSupplierIds },
            },
            _count: { id: true },
          });

    const operationalCountMap = new Map(
      operationalCountsBySupplier.map((row) => [row.supplierId, row._count.id]),
    );

    const supplierName = (supplier: {
      tradingName?: string | null;
      companyName?: string | null;
      id: string;
    }) => supplier.tradingName ?? supplier.companyName ?? supplier.id;

    const invariant1Violations = untrustedOperationalWorkers
      .filter((row) => row.supplier && !isSupplierOperationalTrustGranted(row.supplier.status))
      .map((row) => ({
        summary: 'Operational worker linked to supplier without Operational Trust Granted',
        context: {
          contractorId: row.id,
          supplierId: row.supplier!.id,
          supplierName: supplierName(row.supplier!),
          supplierOperationalTrustStatus: row.supplier!.status,
        },
      }));

    const invariant2Violations = suspendedSuppliers
      .map((supplier) => ({
        supplier,
        operationalWorkerCount: operationalCountMap.get(supplier.id) ?? 0,
      }))
      .filter((entry) => entry.operationalWorkerCount > 0)
      .slice(0, SUPPLIER_GOVERNANCE_INTEGRITY_VIOLATION_SAMPLE_LIMIT)
      .map((entry) => ({
        summary: 'Suspended supplier still has operational workers',
        context: {
          supplierId: entry.supplier.id,
          supplierName: supplierName(entry.supplier),
          operationalWorkerCount: entry.operationalWorkerCount,
          supplierOperationalTrustStatus: SupplierStatus.SUSPENDED,
        },
      }));

    const invariant3Violations = pendingSuppliers
      .map((supplier) => ({
        supplier,
        operationalWorkerCount: operationalCountMap.get(supplier.id) ?? 0,
      }))
      .filter((entry) => entry.operationalWorkerCount > 0)
      .slice(0, SUPPLIER_GOVERNANCE_INTEGRITY_VIOLATION_SAMPLE_LIMIT)
      .map((entry) => ({
        summary: 'Pending supplier still has operational workers',
        context: {
          supplierId: entry.supplier.id,
          supplierName: supplierName(entry.supplier),
          operationalWorkerCount: entry.operationalWorkerCount,
          supplierOperationalTrustStatus: SupplierStatus.PENDING_APPROVAL,
        },
      }));

    const oracleSnapshotViolations = grantedOracleSuppliers
      .filter(
        (supplier) =>
          supplier.externalSupplierId != null &&
          !stagingExternalIds.has(supplier.externalSupplierId),
      )
      .slice(0, SUPPLIER_GOVERNANCE_INTEGRITY_VIOLATION_SAMPLE_LIMIT)
      .map((supplier) => ({
        summary: 'Granted trust supplier missing from Oracle synchronization snapshot',
        context: {
          supplierId: supplier.id,
          supplierName: supplierName(supplier),
          externalSupplierId: supplier.externalSupplierId!,
        },
      }));

    return assembleIntegrityReport([
      buildIntegrityInvariantResult({
        id: 'OPERATIONAL_WORKER_REQUIRES_GRANTED_TRUST',
        violations: invariant1Violations,
      }),
      buildIntegrityInvariantResult({
        id: 'SUSPENDED_SUPPLIER_HAS_NO_OPERATIONAL_WORKERS',
        violations: invariant2Violations,
      }),
      buildIntegrityInvariantResult({
        id: 'PENDING_SUPPLIER_HAS_NO_OPERATIONAL_WORKERS',
        violations: invariant3Violations,
      }),
      buildIntegrityInvariantResult({
        id: 'GRANTED_TRUST_REQUIRES_ORACLE_SNAPSHOT',
        violations: oracleSnapshotViolations,
      }),
      buildIntegrityInvariantResult({
        id: 'REMOVED_FROM_ORACLE_CANNOT_RETAIN_GRANTED_TRUST',
        violations: oracleSnapshotViolations.map((violation) => ({
          summary: 'Supplier removed from Oracle still holds Operational Trust Granted',
          context: violation.context,
        })),
      }),
    ]);
  }
}
