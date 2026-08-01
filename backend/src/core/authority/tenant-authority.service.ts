import { Injectable } from '@nestjs/common';
import { ContractorAuthorityMode, SupplierAuthorityMode } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  DEFAULT_CONTRACTOR_AUTHORITY_MODE,
  DEFAULT_SUPPLIER_AUTHORITY_MODE,
  TenantAuthorityProfile,
} from './authority.constants';

@Injectable()
export class TenantAuthorityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForOrganization(
    organizationId: string | null | undefined,
  ): Promise<TenantAuthorityProfile> {
    if (!organizationId) {
      return {
        supplierAuthorityMode: DEFAULT_SUPPLIER_AUTHORITY_MODE,
        contractorAuthorityMode: DEFAULT_CONTRACTOR_AUTHORITY_MODE,
      };
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        supplierAuthorityMode: true,
        contractorAuthorityMode: true,
      },
    });

    return {
      supplierAuthorityMode:
        org?.supplierAuthorityMode ?? DEFAULT_SUPPLIER_AUTHORITY_MODE,
      contractorAuthorityMode:
        org?.contractorAuthorityMode ?? DEFAULT_CONTRACTOR_AUTHORITY_MODE,
    };
  }

  isOracleSupplierAuthority(mode: SupplierAuthorityMode): boolean {
    return mode === SupplierAuthorityMode.ORACLE_ONLY;
  }
}
