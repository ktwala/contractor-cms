import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  SupplierSourceDriftSeverity,
  SupplierSourceDriftStatus,
  SupplierSourceDriftType,
  SupplierSourceSystem,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { HcmContractorNormalizationService } from '../contractor-migration/services/hcm-contractor-normalization.service';
import {
  HCM_SUPPLIER_REFERENCE_OBSERVATION_SOURCE,
  MTN_DEMO_HCM_SUPPLIER_REFERENCES,
  REMOVED_DEMO_OVERLAY_STAGING_EXTERNAL_IDS,
  type HcmSupplierReferenceReconciliationKind,
} from '../demo/demo-hcm-supplier-reference.constants';
import {
  buildDriftFingerprint,
  OPEN_DRIFT_STATUSES,
} from './supplier-source-drift.util';

export type HcmSupplierReferenceObservation = {
  referenceName: string;
  reconciliationKind: HcmSupplierReferenceReconciliationKind;
  proposedSupplierId: string | null;
  proposedSupplierName: string | null;
  workerDisplayNames: string[];
};

export type SupplierReconciliationWorkItemDto = {
  id: string;
  referenceName: string;
  reconciliationKind: HcmSupplierReferenceReconciliationKind;
  summary: string;
  proposedSupplierName: string | null;
  workerCount: number;
  observationSource: typeof HCM_SUPPLIER_REFERENCE_OBSERVATION_SOURCE;
};

@Injectable()
export class HcmSupplierReferenceReconciliationService {
  private readonly logger = new Logger(HcmSupplierReferenceReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hcmNormalization: HcmContractorNormalizationService,
  ) {}

  async removeLegacyDemoOverlayStaging(organizationId: string): Promise<void> {
    await this.prisma.supplierSourceStaging.deleteMany({
      where: {
        organizationId,
        externalSupplierId: { in: [...REMOVED_DEMO_OVERLAY_STAGING_EXTERNAL_IDS] },
      },
    });
  }

  async syncObservations(
    organizationId: string,
    detectedByRunId?: string | null,
  ): Promise<{ observations: number }> {
    await this.removeLegacyDemoOverlayStaging(organizationId);

    const [hcmRows, portalSuppliers] = await Promise.all([
      this.prisma.hcmContractorStaging.findMany({
        where: { organizationId },
        select: {
          sourcePersonId: true,
          sourcePersonNumber: true,
          sourcePayloadJson: true,
        },
      }),
      this.prisma.supplier.findMany({
        where: {
          organizationId,
          sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
          externalSupplierId: { not: null },
        },
        select: { id: true, tradingName: true, companyName: true },
      }),
    ]);

    if (hcmRows.length === 0) {
      return { observations: 0 };
    }

    const portalNameKeys = new Set(
      portalSuppliers.flatMap((s) =>
        [s.tradingName, s.companyName]
          .filter((name): name is string => Boolean(name?.trim()))
          .map((name) => name.trim().toLowerCase()),
      ),
    );

    const refs = new Map<string, Set<string>>();

    for (const row of hcmRows) {
      const normalized = this.hcmNormalization.normalize(row.sourcePayloadJson, {
        sourcePersonId: row.sourcePersonId,
        sourcePersonNumber: row.sourcePersonNumber,
      });
      const referenceName = normalized.supplier?.trim();
      if (!referenceName) continue;
      if (portalNameKeys.has(referenceName.toLowerCase())) continue;

      const workers = refs.get(referenceName) ?? new Set<string>();
      if (normalized.displayName) {
        workers.add(normalized.displayName);
      }
      refs.set(referenceName, workers);
    }

    let observations = 0;
    for (const [referenceName, workerNames] of refs) {
      const observation = this.classifyReference(
        referenceName,
        [...workerNames],
        portalSuppliers,
      );
      if (!observation) continue;

      await this.upsertObservationDrift(organizationId, observation, detectedByRunId);
      observations += 1;
    }

    if (observations > 0) {
      this.logger.log(
        `Synced ${observations} HCM supplier reference observation(s) for org ${organizationId}`,
      );
    }

    return { observations };
  }

  async listWorkItems(organizationId: string): Promise<SupplierReconciliationWorkItemDto[]> {
    const drifts = await this.prisma.supplierSourceDrift.findMany({
      where: {
        organizationId,
        driftType: SupplierSourceDriftType.RECONCILIATION_CONFLICT,
        status: { in: OPEN_DRIFT_STATUSES },
      },
      orderBy: { detectedAt: 'desc' },
    });

    return drifts
      .map((row) => this.toWorkItem(row))
      .filter((item): item is SupplierReconciliationWorkItemDto => item != null);
  }

  async countOpenByKind(
    organizationId: string,
  ): Promise<{ possibleMatches: number; conflicts: number }> {
    const drifts = await this.prisma.supplierSourceDrift.findMany({
      where: {
        organizationId,
        driftType: SupplierSourceDriftType.RECONCILIATION_CONFLICT,
        status: { in: OPEN_DRIFT_STATUSES },
      },
      select: { sourceSnapshot: true },
    });

    let possibleMatches = 0;
    let conflicts = 0;
    for (const row of drifts) {
      const snapshot = row.sourceSnapshot as Record<string, unknown> | null;
      if (snapshot?.observationSource !== HCM_SUPPLIER_REFERENCE_OBSERVATION_SOURCE) {
        continue;
      }
      if (snapshot.reconciliationKind === 'POSSIBLE_MATCH') {
        possibleMatches += 1;
      } else if (snapshot.reconciliationKind === 'CONFLICT') {
        conflicts += 1;
      }
    }
    return { possibleMatches, conflicts };
  }

  private classifyReference(
    referenceName: string,
    workerDisplayNames: string[],
    portalSuppliers: Array<{ id: string; tradingName: string | null; companyName: string | null }>,
  ): HcmSupplierReferenceObservation | null {
    const demoRule = MTN_DEMO_HCM_SUPPLIER_REFERENCES.find(
      (rule) => rule.referenceName.toLowerCase() === referenceName.toLowerCase(),
    );

    const proposedSupplier = demoRule
      ? portalSuppliers.find((s) => s.tradingName === demoRule.proposedSupplierTradingName)
      : null;

    const reconciliationKind: HcmSupplierReferenceReconciliationKind =
      demoRule?.reconciliationKind ?? 'POSSIBLE_MATCH';

    return {
      referenceName,
      reconciliationKind,
      proposedSupplierId: proposedSupplier?.id ?? null,
      proposedSupplierName:
        proposedSupplier?.tradingName ?? demoRule?.proposedSupplierTradingName ?? null,
      workerDisplayNames,
    };
  }

  private async upsertObservationDrift(
    organizationId: string,
    observation: HcmSupplierReferenceObservation,
    detectedByRunId?: string | null,
  ): Promise<void> {
    const externalSupplierId = `HCM-REF:${observation.referenceName}`;
    const severity =
      observation.reconciliationKind === 'CONFLICT'
        ? SupplierSourceDriftSeverity.HIGH
        : SupplierSourceDriftSeverity.MEDIUM;

    const sourceSnapshot: Prisma.InputJsonValue = {
      observationSource: HCM_SUPPLIER_REFERENCE_OBSERVATION_SOURCE,
      referenceName: observation.referenceName,
      reconciliationKind: observation.reconciliationKind,
      proposedSupplierId: observation.proposedSupplierId,
      proposedSupplierName: observation.proposedSupplierName,
      workerDisplayNames: observation.workerDisplayNames,
      workerCount: observation.workerDisplayNames.length,
    };

    const driftFingerprint = buildDriftFingerprint({
      organizationId,
      driftType: SupplierSourceDriftType.RECONCILIATION_CONFLICT,
      externalSupplierId,
    });

    const now = new Date();
    const existing = await this.prisma.supplierSourceDrift.findUnique({
      where: {
        organizationId_driftFingerprint: { organizationId, driftFingerprint },
      },
    });

    if (existing && OPEN_DRIFT_STATUSES.includes(existing.status)) {
      await this.prisma.supplierSourceDrift.update({
        where: { id: existing.id },
        data: {
          severity,
          supplierId: observation.proposedSupplierId,
          detectedAt: now,
          detectedByRunId: detectedByRunId ?? existing.detectedByRunId,
          sourceSnapshot,
        },
      });
      return;
    }

    if (existing) {
      return;
    }

    await this.prisma.supplierSourceDrift.create({
      data: {
        organizationId,
        supplierId: observation.proposedSupplierId,
        stagingId: null,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId,
        driftType: SupplierSourceDriftType.RECONCILIATION_CONFLICT,
        severity,
        status: SupplierSourceDriftStatus.CLASSIFIED,
        driftFingerprint,
        detectedAt: now,
        classifiedAt: now,
        detectedByRunId: detectedByRunId ?? null,
        sourceSnapshot,
      },
    });
  }

  private toWorkItem(row: {
    id: string;
    sourceSnapshot: Prisma.JsonValue;
  }): SupplierReconciliationWorkItemDto | null {
    const snapshot = row.sourceSnapshot as Record<string, unknown> | null;
    if (snapshot?.observationSource !== HCM_SUPPLIER_REFERENCE_OBSERVATION_SOURCE) {
      return null;
    }
    const referenceName = String(snapshot.referenceName ?? '');
    const reconciliationKind = snapshot.reconciliationKind as HcmSupplierReferenceReconciliationKind;
    const proposedSupplierName =
      typeof snapshot.proposedSupplierName === 'string' ? snapshot.proposedSupplierName : null;
    const workerCount =
      typeof snapshot.workerCount === 'number'
        ? snapshot.workerCount
        : Array.isArray(snapshot.workerDisplayNames)
          ? snapshot.workerDisplayNames.length
          : 0;

    return {
      id: row.id,
      referenceName,
      reconciliationKind,
      proposedSupplierName,
      workerCount,
      observationSource: HCM_SUPPLIER_REFERENCE_OBSERVATION_SOURCE,
      summary: this.workItemSummary(referenceName, reconciliationKind, proposedSupplierName),
    };
  }

  private workItemSummary(
    referenceName: string,
    kind: HcmSupplierReferenceReconciliationKind,
    proposedSupplierName: string | null,
  ): string {
    if (kind === 'POSSIBLE_MATCH' && proposedSupplierName) {
      return `HCM workers reference "${referenceName}" — possible match with ${proposedSupplierName}`;
    }
    if (kind === 'CONFLICT' && proposedSupplierName) {
      return `HCM workers reference "${referenceName}" — conflicts with ${proposedSupplierName}`;
    }
    return `HCM workers reference "${referenceName}" — not found in Supplier Portal`;
  }
}
