import { Injectable } from '@nestjs/common';
import {
  ContractorAuthorityMode,
  SupplierAuthorityMode,
} from '@prisma/client';
import { AccessContext } from '../core/auth/interfaces/access-context.interface';
import { TenantAuthorityService } from '../core/authority/tenant-authority.service';
import { OracleHcmContractorSourceAdapter } from '../domain/contractor-migration/adapters/oracle-hcm-contractor-source.adapter';
import { OracleSupplierSourceAdapter } from '../domain/supplier-sources/adapters/oracle-supplier-source.adapter';
import { ContractorSourceAdapter } from './contracts/contractor-source.adapter';
import { SupplierSourceAdapter } from './contracts/supplier-source.adapter';
import { SOURCE_SYSTEM_IDS } from './contracts/source-system.codes';
import { SourceAdapterDisabledException } from './source-integration.errors';

export type ResolvedSourceAdapters = {
  supplier: SupplierSourceAdapter | null;
  contractor: ContractorSourceAdapter | null;
  authority: {
    supplierAuthorityMode: SupplierAuthorityMode;
    contractorAuthorityMode: ContractorAuthorityMode;
  };
};

@Injectable()
export class SourceAdapterRegistry {
  constructor(
    private readonly tenantAuthority: TenantAuthorityService,
    private readonly oracleSupplier: OracleSupplierSourceAdapter,
    private readonly oracleHcmContractor: OracleHcmContractorSourceAdapter,
  ) {}

  resolveForAuthority(authority: {
    supplierAuthorityMode: SupplierAuthorityMode;
    contractorAuthorityMode: ContractorAuthorityMode;
  }): ResolvedSourceAdapters {
    const supplierEnabled =
      authority.supplierAuthorityMode === SupplierAuthorityMode.ORACLE_ONLY ||
      authority.supplierAuthorityMode === SupplierAuthorityMode.HYBRID;

    const contractorEnabled =
      authority.contractorAuthorityMode === ContractorAuthorityMode.HCM_ONLY ||
      authority.contractorAuthorityMode === ContractorAuthorityMode.HYBRID ||
      authority.contractorAuthorityMode === ContractorAuthorityMode.CMS_ONLY;

    return {
      supplier: supplierEnabled ? this.oracleSupplier : null,
      contractor: contractorEnabled ? this.oracleHcmContractor : null,
      authority: {
        supplierAuthorityMode: authority.supplierAuthorityMode,
        contractorAuthorityMode: authority.contractorAuthorityMode,
      },
    };
  }

  async resolveForContext(
    accessContext: AccessContext,
  ): Promise<ResolvedSourceAdapters> {
    const authority = await this.tenantAuthority.resolveForOrganization(
      accessContext.targetOrganizationId,
    );
    return this.resolveForAuthority(authority);
  }

  async requireSupplierAdapter(
    accessContext: AccessContext,
  ): Promise<SupplierSourceAdapter> {
    const resolved = await this.resolveForContext(accessContext);
    if (!resolved.supplier) {
      throw new SourceAdapterDisabledException(
        SOURCE_SYSTEM_IDS.ORACLE_PROCUREMENT,
        resolved.authority.supplierAuthorityMode,
      );
    }
    return resolved.supplier;
  }

  async requireContractorBootstrapAdapter(
    accessContext: AccessContext,
  ): Promise<ContractorSourceAdapter> {
    const resolved = await this.resolveForContext(accessContext);
    if (!resolved.contractor) {
      throw new SourceAdapterDisabledException(
        SOURCE_SYSTEM_IDS.ORACLE_HCM,
        undefined,
        resolved.authority.contractorAuthorityMode,
      );
    }
    return resolved.contractor;
  }
}
