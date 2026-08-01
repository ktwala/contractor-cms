import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SupplierSourceStagingMatchStatus,
  SupplierSourceSystem,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { resolveSupplierJurisdictionCode } from '../suppliers/supplier-jurisdiction.constants';
import { UnsupportedSupplierJurisdictionException } from '../suppliers/supplier-jurisdiction.errors';
import { NormalizedOracleSupplierRecord } from '../../integration/oracle-procurement/oracle-procurement.types';
import { SupplierSourceReconciliationService } from './supplier-source-reconciliation.service';

export type StagingWriteSummary = {
  imported: number;
  matched: number;
  possibleMatch: number;
  new: number;
  conflict: number;
  failed: number;
};

export type StagingWriteResult = {
  summary: StagingWriteSummary;
  stagingIds: string[];
};

/**
 * PR-CMS-CONNECTOR-1C — replay-safe idempotent staging upsert (never touches Supplier ACTIVE).
 */
@Injectable()
export class SupplierStagingWriterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: SupplierSourceReconciliationService,
  ) {}

  private normalizeCountryCode(code: string): string {
    const upper = code.trim().toUpperCase();
    if (upper !== 'ZA' && upper !== 'LS') {
      throw new UnsupportedSupplierJurisdictionException(upper);
    }
    return resolveSupplierJurisdictionCode(upper, upper);
  }

  async upsertRecords(
    organizationId: string,
    records: NormalizedOracleSupplierRecord[],
    options?: { sourceLabel?: string },
  ): Promise<StagingWriteResult> {
    const summary: StagingWriteSummary = {
      imported: 0,
      matched: 0,
      possibleMatch: 0,
      new: 0,
      conflict: 0,
      failed: 0,
    };
    const stagingIds: string[] = [];

    for (const record of records) {
      try {
        const countryCode = this.normalizeCountryCode(record.countryCode);
        const externalSupplierId = record.externalSupplierId.trim();

        const outcome = await this.reconciliation.reconcile({
          organizationId,
          externalSupplierId,
          supplierNumber: record.supplierNumber ?? null,
          taxRegistrationNumber: record.taxNumber ?? null,
          name: record.legalName.trim(),
          countryCode,
        });

        const rawPayload = {
          sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
          externalSupplierId,
          supplierNumber: record.supplierNumber,
          legalName: record.legalName,
          tradingName: record.tradingName,
          taxNumber: record.taxNumber,
          email: record.email,
          phone: record.phone,
          countryCode,
          rawHash: record.rawHash,
          rawPayloadRef: record.rawPayloadRef,
          sourceUpdatedAt: record.sourceUpdatedAt?.toISOString() ?? null,
          importedAt: new Date().toISOString(),
          source: options?.sourceLabel ?? 'ORACLE_PROCUREMENT_REST',
        } as Prisma.InputJsonValue;

        const upserted = await this.prisma.supplierSourceStaging.upsert({
          where: {
            organizationId_sourceSystem_externalSupplierId: {
              organizationId,
              sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
              externalSupplierId,
            },
          },
          create: {
            organizationId,
            sourceSystem: SupplierSourceSystem.ORACLE_SUPPLIER_SAAS,
            externalSupplierId,
            supplierNumber: record.supplierNumber?.trim() || null,
            name: record.legalName.trim(),
            countryCode,
            taxRegistrationNumber: record.taxNumber?.trim() || null,
            rawPayload,
            matchStatus: outcome.matchStatus,
            matchReason: outcome.matchReason,
            proposedSupplierId: outcome.proposedSupplierId,
          },
          update: {
            supplierNumber: record.supplierNumber?.trim() || null,
            name: record.legalName.trim(),
            countryCode,
            taxRegistrationNumber: record.taxNumber?.trim() || null,
            rawPayload,
            matchStatus: outcome.matchStatus,
            matchReason: outcome.matchReason,
            proposedSupplierId: outcome.proposedSupplierId,
          },
        });

        stagingIds.push(upserted.id);
        summary.imported += 1;
        switch (outcome.matchStatus) {
          case SupplierSourceStagingMatchStatus.MATCHED:
            summary.matched += 1;
            break;
          case SupplierSourceStagingMatchStatus.POSSIBLE_MATCH:
            summary.possibleMatch += 1;
            break;
          case SupplierSourceStagingMatchStatus.CONFLICT:
            summary.conflict += 1;
            break;
          default:
            summary.new += 1;
        }
      } catch {
        summary.failed += 1;
      }
    }

    return { summary, stagingIds };
  }
}
