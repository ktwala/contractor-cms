import { Injectable } from '@nestjs/common';
import {
  HcmContractorCorrelationConfidence,
  HcmContractorCorrelationMatchStatus,
  MigrationSourceSystem,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { HcmContractorNormalizationService } from '../contractor-migration/services/hcm-contractor-normalization.service';

export type ContractorCorrelationOutcome = {
  matchStatus: HcmContractorCorrelationMatchStatus;
  confidence: HcmContractorCorrelationConfidence | null;
  proposedContractorId: string | null;
  matchReason: string | null;
};

/**
 * PR-CTR-CONNECTOR-1C — identity correlation for HCM staging (not org reconciliation).
 */
@Injectable()
export class ContractorCorrelationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normalization: HcmContractorNormalizationService,
  ) {}

  async correlate(input: {
    organizationId: string;
    sourcePersonId: string;
    sourcePersonNumber?: string | null;
    sourcePayload: Record<string, unknown>;
  }): Promise<ContractorCorrelationOutcome> {
    const normalized = this.normalization.normalize(input.sourcePayload, {
      sourcePersonId: input.sourcePersonId,
      sourcePersonNumber: input.sourcePersonNumber ?? null,
    });

    const suppliers = await this.prisma.supplier.findMany({
      where: { organizationId: input.organizationId },
      select: { id: true },
    });
    const supplierIds = suppliers.map((s) => s.id);

    const contractors = await this.prisma.contractor.findMany({
      where: { supplierId: { in: supplierIds } },
      select: {
        id: true,
        email: true,
        idNumber: true,
        legacySourcePersonId: true,
        legacySourceSystem: true,
        isActive: true,
      },
    });

    const byPersonId = contractors.filter(
      (c) =>
        c.legacySourceSystem === MigrationSourceSystem.ORACLE_HCM &&
        c.legacySourcePersonId === input.sourcePersonId,
    );

    if (byPersonId.length > 1) {
      return {
        matchStatus: HcmContractorCorrelationMatchStatus.CONFLICT,
        confidence: HcmContractorCorrelationConfidence.MANUAL_REVIEW,
        proposedContractorId: null,
        matchReason: 'Multiple contractors share the same HCM person id',
      };
    }

    if (byPersonId.length === 1) {
      return {
        matchStatus: HcmContractorCorrelationMatchStatus.MATCHED,
        confidence: HcmContractorCorrelationConfidence.HIGH,
        proposedContractorId: byPersonId[0].id,
        matchReason: 'Matched by legacy HCM person id',
      };
    }

    const nationalId = this.extractNationalId(normalized, input.sourcePayload);
    if (nationalId) {
      const byId = contractors.filter(
        (c) => c.idNumber?.trim().toUpperCase() === nationalId,
      );
      if (byId.length > 1) {
        return {
          matchStatus: HcmContractorCorrelationMatchStatus.CONFLICT,
          confidence: HcmContractorCorrelationConfidence.MANUAL_REVIEW,
          proposedContractorId: null,
          matchReason: 'Multiple contractors share the same national ID',
        };
      }
      if (byId.length === 1) {
        return {
          matchStatus: HcmContractorCorrelationMatchStatus.MATCHED,
          confidence: HcmContractorCorrelationConfidence.HIGH,
          proposedContractorId: byId[0].id,
          matchReason: 'Matched by national ID',
        };
      }
    }

    const email = normalized.email?.trim().toLowerCase();
    if (email) {
      const byEmail = contractors.filter(
        (c) => c.email.trim().toLowerCase() === email,
      );
      if (byEmail.length > 1) {
        return {
          matchStatus: HcmContractorCorrelationMatchStatus.CONFLICT,
          confidence: HcmContractorCorrelationConfidence.MANUAL_REVIEW,
          proposedContractorId: null,
          matchReason: 'Multiple contractors share the same email',
        };
      }
      if (byEmail.length === 1) {
        return {
          matchStatus: HcmContractorCorrelationMatchStatus.POSSIBLE_MATCH,
          confidence: HcmContractorCorrelationConfidence.LOW,
          proposedContractorId: byEmail[0].id,
          matchReason: 'Possible match by email only — manual review required',
        };
      }
    }

    return {
      matchStatus: HcmContractorCorrelationMatchStatus.NEW,
      confidence: null,
      proposedContractorId: null,
      matchReason: 'No correlation to existing contractor',
    };
  }

  private extractNationalId(
    normalized: { email?: string | null },
    payload: Record<string, unknown>,
  ): string | null {
    const candidates = [
      payload.nationalId,
      payload.idNumber,
      payload.NationalId,
      (payload.PersonIdentification as { IdentificationNumber?: string } | undefined)
        ?.IdentificationNumber,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) {
        return c.trim().toUpperCase();
      }
    }
    return null;
  }
}
