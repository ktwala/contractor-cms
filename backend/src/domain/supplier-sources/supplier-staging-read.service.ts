import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SupplierSourceStagingMatchStatus,
  SupplierSourceSystem,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { OracleStagingRowDto } from './dto/oracle-staging-response.dto';
import { SupplierSourceReconciliationService } from './supplier-source-reconciliation.service';

@Injectable()
export class SupplierStagingReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: SupplierSourceReconciliationService,
  ) {}

  async presentStagingRow(
    row: {
      id: string;
      externalSupplierId: string;
      supplierNumber: string | null;
      name: string;
      countryCode: string;
      taxRegistrationNumber: string | null;
      matchStatus: SupplierSourceStagingMatchStatus;
      matchReason: string | null;
      proposedSupplierId: string | null;
      importedAt: Date;
      updatedAt: Date;
      proposedSupplier?: {
        id: string;
        companyName: string | null;
        tradingName: string | null;
        firstName: string | null;
        lastName: string | null;
        status: import('@prisma/client').SupplierStatus;
        countryCode: string | null;
        country: string;
      } | null;
    },
  ): Promise<OracleStagingRowDto> {
    const displayStatus =
      row.matchStatus === SupplierSourceStagingMatchStatus.UNMATCHED
        ? SupplierSourceStagingMatchStatus.NEW
        : row.matchStatus;

    return {
      id: row.id,
      externalSupplierId: row.externalSupplierId,
      supplierNumber: row.supplierNumber,
      name: row.name,
      countryCode: row.countryCode,
      taxRegistrationNumber: row.taxRegistrationNumber,
      matchStatus: displayStatus,
      matchReason: row.matchReason,
      proposedSupplierId: row.proposedSupplierId,
      matchedSupplier: row.proposedSupplier
        ? this.reconciliation.presentMatchedSupplierSummary(row.proposedSupplier)
        : null,
      importedAt: row.importedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listStagingRowsByIds(
    accessContext: AccessContext,
    stagingIds: string[],
  ): Promise<OracleStagingRowDto[]> {
    if (stagingIds.length === 0) {
      return [];
    }
    const organizationId = accessContext.targetOrganizationId;
    if (!organizationId) {
      return [];
    }
    const records = await this.prisma.supplierSourceStaging.findMany({
      where: {
        organizationId,
        id: { in: stagingIds },
      },
      include: {
        proposedSupplier: {
          select: {
            id: true,
            companyName: true,
            tradingName: true,
            firstName: true,
            lastName: true,
            status: true,
            countryCode: true,
            country: true,
          },
        },
      },
    });
    return Promise.all(records.map((r) => this.presentStagingRow(r)));
  }

  stagingListInclude() {
    return {
      proposedSupplier: {
        select: {
          id: true,
          companyName: true,
          tradingName: true,
          firstName: true,
          lastName: true,
          status: true,
          countryCode: true,
          country: true,
        },
      },
    };
  }

  listWhere(
    organizationId: string,
    query: { matchStatus?: SupplierSourceStagingMatchStatus },
  ): Prisma.SupplierSourceStagingWhereInput {
    const where: Prisma.SupplierSourceStagingWhereInput = {
      organizationId,
      sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
    };
    if (query.matchStatus) {
      where.matchStatus =
        query.matchStatus === SupplierSourceStagingMatchStatus.NEW
          ? {
              in: [
                SupplierSourceStagingMatchStatus.NEW,
                SupplierSourceStagingMatchStatus.UNMATCHED,
              ],
            }
          : query.matchStatus;
    }
    return where;
  }
}
