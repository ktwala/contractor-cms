import { Injectable } from '@nestjs/common';
import {
  Supplier,
  SupplierSourceStagingMatchStatus,
  SupplierStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { SUPPLIER_SOURCE_SYSTEMS } from '../suppliers/supplier-source.constants';
import { resolveSupplierJurisdictionCode } from '../suppliers/supplier-jurisdiction.constants';

export type ReconciliationInput = {
  organizationId: string;
  externalSupplierId: string;
  supplierNumber?: string | null;
  taxRegistrationNumber?: string | null;
  name: string;
  countryCode: string;
};

export type ReconciliationOutcome = {
  matchStatus: SupplierSourceStagingMatchStatus;
  proposedSupplierId: string | null;
  matchReason: string | null;
};

@Injectable()
export class SupplierSourceReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcile(input: ReconciliationInput): Promise<ReconciliationOutcome> {
    const suppliers = await this.prisma.supplier.findMany({
      where: { organizationId: input.organizationId },
      select: {
        id: true,
        companyName: true,
        tradingName: true,
        firstName: true,
        lastName: true,
        status: true,
        sourceSystem: true,
        externalSupplierId: true,
        externalSupplierNumber: true,
        taxNumber: true,
        countryCode: true,
        country: true,
      },
    });

    const byExternalId = suppliers.filter(
      (s) =>
        s.sourceSystem === SUPPLIER_SOURCE_SYSTEMS.ORACLE_SUPPLIER_SAAS &&
        s.externalSupplierId != null &&
        s.externalSupplierId === input.externalSupplierId,
    );

    if (byExternalId.length > 1) {
      return {
        matchStatus: SupplierSourceStagingMatchStatus.CONFLICT,
        proposedSupplierId: null,
        matchReason: 'Multiple CMS suppliers share the same Oracle externalSupplierId',
      };
    }

    if (byExternalId.length === 1) {
      return {
        matchStatus: SupplierSourceStagingMatchStatus.MATCHED,
        proposedSupplierId: byExternalId[0].id,
        matchReason: 'Matched by externalSupplierId',
      };
    }

    const candidateIds = new Set<string>();

    if (input.supplierNumber?.trim()) {
      for (const s of suppliers) {
        if (s.externalSupplierNumber === input.supplierNumber.trim()) {
          candidateIds.add(s.id);
        }
      }
    }

    if (input.taxRegistrationNumber?.trim()) {
      for (const s of suppliers) {
        if (s.taxNumber === input.taxRegistrationNumber.trim()) {
          candidateIds.add(s.id);
        }
      }
    }

    if (candidateIds.size === 0) {
      return {
        matchStatus: SupplierSourceStagingMatchStatus.NEW,
        proposedSupplierId: null,
        matchReason: 'No CMS supplier matched by external id, supplier number, or tax number',
      };
    }

    if (candidateIds.size > 1) {
      return {
        matchStatus: SupplierSourceStagingMatchStatus.CONFLICT,
        proposedSupplierId: null,
        matchReason:
          'Multiple CMS suppliers matched by supplier number and/or tax registration number',
      };
    }

    const supplier = suppliers.find((s) => s.id === [...candidateIds][0])!;

    if (
      supplier.externalSupplierId &&
      supplier.externalSupplierId !== input.externalSupplierId
    ) {
      return {
        matchStatus: SupplierSourceStagingMatchStatus.CONFLICT,
        proposedSupplierId: supplier.id,
        matchReason:
          'CMS supplier is linked to a different Oracle externalSupplierId',
      };
    }

    const reasons: string[] = [];
    if (
      input.supplierNumber?.trim() &&
      supplier.externalSupplierNumber === input.supplierNumber.trim()
    ) {
      reasons.push('supplierNumber');
    }
    if (
      input.taxRegistrationNumber?.trim() &&
      supplier.taxNumber === input.taxRegistrationNumber.trim()
    ) {
      reasons.push('taxRegistrationNumber');
    }

    return {
      matchStatus: SupplierSourceStagingMatchStatus.POSSIBLE_MATCH,
      proposedSupplierId: supplier.id,
      matchReason: `Possible match by ${reasons.join(' and ')}`,
    };
  }

  presentMatchedSupplierSummary(supplier: {
    id: string;
    companyName: string | null;
    tradingName: string | null;
    firstName: string | null;
    lastName: string | null;
    status: SupplierStatus;
    countryCode: string | null;
    country: string;
  }) {
    const name =
      supplier.companyName?.trim() ||
      supplier.tradingName?.trim() ||
      [supplier.firstName, supplier.lastName].filter(Boolean).join(' ').trim() ||
      'Supplier';

    return {
      id: supplier.id,
      displayName: name,
      status: supplier.status,
      jurisdictionCode: resolveSupplierJurisdictionCode(
        supplier.country,
        supplier.countryCode,
      ),
    };
  }
}
