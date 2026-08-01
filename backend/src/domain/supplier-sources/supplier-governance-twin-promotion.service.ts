import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SupplierSourceStagingMatchStatus,
  SupplierSourceSyncStatus,
  SupplierSourceSystem,
  SupplierStatus,
  SupplierType,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import {
  SupplierOracleExternalIdConflictException,
  SupplierStagingNotPromotableException,
} from './supplier-governance-twin.errors';
import {
  governanceTwinEmail,
  isOracleLinkedSupplier,
} from './supplier-source-identity.helper';
import {
  GovernanceTwinPromotionResultDto,
  PromoteOracleStagingBatchResponseDto,
} from './dto/governance-twin-promotion-response.dto';

const PROMOTABLE_STATUSES: SupplierSourceStagingMatchStatus[] = [
  SupplierSourceStagingMatchStatus.MATCHED,
  SupplierSourceStagingMatchStatus.NEW,
  SupplierSourceStagingMatchStatus.UNMATCHED,
];

@Injectable()
export class SupplierGovernanceTwinPromotionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private resolveOrgId(accessContext: AccessContext): string {
    const orgId = accessContext.targetOrganizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    return orgId;
  }

  private assertPromotableStatus(
    matchStatus: SupplierSourceStagingMatchStatus,
    matchReason: string | null,
  ): void {
    if (matchStatus === SupplierSourceStagingMatchStatus.IMPORTED) {
      return;
    }
    if (matchStatus === SupplierSourceStagingMatchStatus.CONFLICT) {
      throw new SupplierStagingNotPromotableException(
        matchStatus,
        'Resolve staging conflicts before creating a CMS governance record.',
      );
    }
    if (matchStatus === SupplierSourceStagingMatchStatus.POSSIBLE_MATCH) {
      throw new SupplierStagingNotPromotableException(
        matchStatus,
        'Confirm or reject possible matches before promotion. Use governance review.',
      );
    }
    if (!PROMOTABLE_STATUSES.includes(matchStatus)) {
      throw new SupplierStagingNotPromotableException(
        matchStatus,
        `Staging row status ${matchStatus} cannot be promoted.`,
      );
    }
    if (!matchReason && matchStatus === SupplierSourceStagingMatchStatus.NEW) {
      return;
    }
  }

  private async assertNoDuplicateOracleLink(
    organizationId: string,
    externalSupplierId: string,
    exceptSupplierId?: string,
  ): Promise<void> {
    const conflict = await this.prisma.supplier.findFirst({
      where: {
        organizationId,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId,
        ...(exceptSupplierId ? { id: { not: exceptSupplierId } } : {}),
      },
      select: { id: true },
    });
    if (conflict) {
      throw new SupplierOracleExternalIdConflictException(
        externalSupplierId,
        conflict.id,
      );
    }
  }

  private linkFieldsFromStaging(row: {
    externalSupplierId: string;
    supplierNumber: string | null;
    name: string;
    countryCode: string;
    taxRegistrationNumber: string | null;
  }) {
    const now = new Date();
    return {
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      externalSupplierId: row.externalSupplierId,
      externalSupplierNumber: row.supplierNumber,
      sourceLastSyncedAt: now,
      sourceSyncStatus: SupplierSourceSyncStatus.SYNCED,
      country: row.countryCode,
      countryCode: row.countryCode,
      companyName: row.name.trim(),
      tradingName: row.name.trim(),
      ...(row.taxRegistrationNumber
        ? { taxNumber: row.taxRegistrationNumber.trim() }
        : {}),
    };
  }

  private async promoteMatched(
    accessContext: AccessContext,
    organizationId: string,
    row: {
      id: string;
      externalSupplierId: string;
      supplierNumber: string | null;
      name: string;
      countryCode: string;
      taxRegistrationNumber: string | null;
      proposedSupplierId: string | null;
    },
  ): Promise<GovernanceTwinPromotionResultDto> {
    if (!row.proposedSupplierId) {
      throw new SupplierStagingNotPromotableException(
        SupplierSourceStagingMatchStatus.MATCHED,
        'Matched staging row has no proposed supplier id.',
      );
    }

    await this.assertNoDuplicateOracleLink(
      organizationId,
      row.externalSupplierId,
      row.proposedSupplierId,
    );

    const existing = await this.prisma.supplier.findFirst({
      where: { id: row.proposedSupplierId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Proposed supplier not found');
    }

    const linkData = this.linkFieldsFromStaging(row);
    const statusUpdate =
      existing.status === SupplierStatus.DRAFT
        ? SupplierStatus.PENDING_APPROVAL
        : existing.status;

    if (statusUpdate === SupplierStatus.ACTIVE) {
      // Import/promotion never grants ACTIVE — preserve only if already ACTIVE.
    }

    const updated = await this.prisma.supplier.update({
      where: { id: existing.id },
      data: {
        ...linkData,
        status: statusUpdate,
      },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'SUPPLIER_GOVERNANCE_TWIN_LINKED',
      'Supplier',
      updated.id,
      {
        sourceSystem: existing.sourceSystem,
        externalSupplierId: existing.externalSupplierId,
        status: existing.status,
      },
      {
        sourceSystem: updated.sourceSystem,
        externalSupplierId: updated.externalSupplierId,
        status: updated.status,
      },
      { organizationId, metadata: { stagingId: row.id } },
    );

    return {
      stagingId: row.id,
      outcome: 'LINKED',
      supplierId: updated.id,
      status: updated.status,
      externalSupplierId: updated.externalSupplierId!,
      sourceSystem: updated.sourceSystem,
    };
  }

  private async promoteNew(
    accessContext: AccessContext,
    organizationId: string,
    row: {
      id: string;
      externalSupplierId: string;
      supplierNumber: string | null;
      name: string;
      countryCode: string;
      taxRegistrationNumber: string | null;
    },
  ): Promise<GovernanceTwinPromotionResultDto> {
    await this.assertNoDuplicateOracleLink(organizationId, row.externalSupplierId);

    const existingByOracle = await this.prisma.supplier.findFirst({
      where: {
        organizationId,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
        externalSupplierId: row.externalSupplierId,
      },
    });
    if (existingByOracle) {
      return {
        stagingId: row.id,
        outcome: 'LINKED',
        supplierId: existingByOracle.id,
        status: existingByOracle.status,
        externalSupplierId: existingByOracle.externalSupplierId!,
        sourceSystem: existingByOracle.sourceSystem,
        idempotent: true,
      };
    }

    const linkData = this.linkFieldsFromStaging(row);
    const created = await this.prisma.supplier.create({
      data: {
        organizationId,
        type: SupplierType.COMPANY,
        status: SupplierStatus.PENDING_APPROVAL,
        email: governanceTwinEmail(organizationId, row.externalSupplierId),
        phone: null,
        ...linkData,
      },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'SUPPLIER_GOVERNANCE_TWIN_CREATED',
      'Supplier',
      created.id,
      null,
      {
        id: created.id,
        status: created.status,
        sourceSystem: created.sourceSystem,
        externalSupplierId: created.externalSupplierId,
      },
      { organizationId, metadata: { stagingId: row.id } },
    );

    return {
      stagingId: row.id,
      outcome: 'CREATED',
      supplierId: created.id,
      status: created.status,
      externalSupplierId: created.externalSupplierId!,
      sourceSystem: created.sourceSystem,
    };
  }

  async promoteStagingRow(
    accessContext: AccessContext,
    stagingId: string,
  ): Promise<GovernanceTwinPromotionResultDto> {
    const organizationId = this.resolveOrgId(accessContext);

    const row = await this.prisma.supplierSourceStaging.findFirst({
      where: {
        id: stagingId,
        organizationId,
        sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      },
    });
    if (!row) {
      throw new NotFoundException('Staging row not found');
    }

    if (
      row.matchStatus === SupplierSourceStagingMatchStatus.IMPORTED &&
      row.proposedSupplierId
    ) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: row.proposedSupplierId },
      });
      if (supplier) {
        return {
          stagingId: row.id,
          outcome: isOracleLinkedSupplier(supplier) ? 'LINKED' : 'CREATED',
          supplierId: supplier.id,
          status: supplier.status,
          externalSupplierId: supplier.externalSupplierId ?? row.externalSupplierId,
          sourceSystem: supplier.sourceSystem,
          idempotent: true,
        };
      }
    }

    this.assertPromotableStatus(row.matchStatus, row.matchReason);

    let result: GovernanceTwinPromotionResultDto;

    if (row.matchStatus === SupplierSourceStagingMatchStatus.MATCHED) {
      result = await this.promoteMatched(accessContext, organizationId, row);
    } else {
      result = await this.promoteNew(accessContext, organizationId, row);
    }

    await this.prisma.supplierSourceStaging.update({
      where: { id: row.id },
      data: {
        matchStatus: SupplierSourceStagingMatchStatus.IMPORTED,
        proposedSupplierId: result.supplierId,
        matchReason: 'CMS governance record created (linked to Oracle supplier)',
      },
    });

    return result;
  }

  async promoteStagingBatch(
    accessContext: AccessContext,
    stagingIds?: string[],
  ): Promise<PromoteOracleStagingBatchResponseDto> {
    const organizationId = this.resolveOrgId(accessContext);

    const where: Prisma.SupplierSourceStagingWhereInput = {
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
      matchStatus: {
        in: [
          SupplierSourceStagingMatchStatus.MATCHED,
          SupplierSourceStagingMatchStatus.NEW,
          SupplierSourceStagingMatchStatus.UNMATCHED,
        ],
      },
    };

    if (stagingIds?.length) {
      where.id = { in: stagingIds };
    }

    const rows = await this.prisma.supplierSourceStaging.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const results: GovernanceTwinPromotionResultDto[] = [];
    const errors: Array<{ stagingId: string; message: string; code?: string }> =
      [];

    for (const row of rows) {
      try {
        const result = await this.promoteStagingRow(accessContext, row.id);
        results.push(result);
      } catch (err: unknown) {
        const response =
          err &&
          typeof err === 'object' &&
          'getResponse' in err &&
          typeof (err as { getResponse: () => unknown }).getResponse === 'function'
            ? ((err as { getResponse: () => Record<string, unknown> }).getResponse() as Record<
                string,
                unknown
              >)
            : undefined;
        errors.push({
          stagingId: row.id,
          message:
            (typeof response?.message === 'string'
              ? response.message
              : Array.isArray(response?.message)
                ? response.message.join(', ')
                : undefined) ??
            (err instanceof Error ? err.message : 'Promotion failed'),
          code: response?.code as string | undefined,
        });
      }
    }

    await this.auditService.logAction(
      accessContext.actorUserId,
      'SUPPLIER_GOVERNANCE_TWIN_PROMOTED',
      'SupplierSourceStaging',
      organizationId,
      null,
      {
        promoted: results.length,
        failed: errors.length,
      },
      { organizationId },
    );

    return {
      promoted: results.length,
      failed: errors.length,
      results,
      errors,
    };
  }
}
