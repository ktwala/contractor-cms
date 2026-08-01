import {
  ContractorAuthorityMode,
  SupplierAuthorityMode,
} from '@prisma/client';
import { SourceAdapterRegistry } from './source-adapter.registry';
import { SourceAdapterDisabledException } from './source-integration.errors';
import { SOURCE_SYSTEM_IDS } from './contracts/source-system.codes';

describe('SourceAdapterRegistry (PR-CMS-INT-3)', () => {
  const tenantAuthority = { resolveForOrganization: jest.fn() };
  const oracleSupplier = { sourceSystemId: SOURCE_SYSTEM_IDS.ORACLE_PROCUREMENT };
  const oracleHcmContractor = { sourceSystemId: SOURCE_SYSTEM_IDS.ORACLE_HCM };

  let registry: SourceAdapterRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new SourceAdapterRegistry(
      tenantAuthority as never,
      oracleSupplier as never,
      oracleHcmContractor as never,
    );
  });

  describe('resolveForAuthority', () => {
    it('enables Oracle supplier adapter for ORACLE_ONLY and HYBRID', () => {
      for (const mode of [
        SupplierAuthorityMode.ORACLE_ONLY,
        SupplierAuthorityMode.HYBRID,
      ]) {
        const resolved = registry.resolveForAuthority({
          supplierAuthorityMode: mode,
          contractorAuthorityMode: ContractorAuthorityMode.CMS_ONLY,
        });
        expect(resolved.supplier).toBe(oracleSupplier);
      }
    });

    it('disables Oracle supplier adapter for CMS_ONLY', () => {
      const resolved = registry.resolveForAuthority({
        supplierAuthorityMode: SupplierAuthorityMode.CMS_ONLY,
        contractorAuthorityMode: ContractorAuthorityMode.HCM_ONLY,
      });
      expect(resolved.supplier).toBeNull();
    });

    it('enables HCM contractor bootstrap for HCM_ONLY, HYBRID, and CMS_ONLY', () => {
      for (const mode of [
        ContractorAuthorityMode.HCM_ONLY,
        ContractorAuthorityMode.HYBRID,
        ContractorAuthorityMode.CMS_ONLY,
      ]) {
        const resolved = registry.resolveForAuthority({
          supplierAuthorityMode: SupplierAuthorityMode.CMS_ONLY,
          contractorAuthorityMode: mode,
        });
        expect(resolved.contractor).toBe(oracleHcmContractor);
      }
    });
  });

  describe('requireSupplierAdapter', () => {
    const accessContext = {
      targetOrganizationId: 'org-demo',
    } as never;

    it('throws SOURCE_ADAPTER_DISABLED when supplier adapter is off', async () => {
      tenantAuthority.resolveForOrganization.mockResolvedValue({
        supplierAuthorityMode: SupplierAuthorityMode.CMS_ONLY,
        contractorAuthorityMode: ContractorAuthorityMode.CMS_ONLY,
      });

      await expect(
        registry.requireSupplierAdapter(accessContext),
      ).rejects.toBeInstanceOf(SourceAdapterDisabledException);
    });

    it('returns Oracle supplier adapter when tenant allows Oracle sync', async () => {
      tenantAuthority.resolveForOrganization.mockResolvedValue({
        supplierAuthorityMode: SupplierAuthorityMode.ORACLE_ONLY,
        contractorAuthorityMode: ContractorAuthorityMode.HYBRID,
      });

      await expect(
        registry.requireSupplierAdapter(accessContext),
      ).resolves.toBe(oracleSupplier);
    });
  });

  describe('requireContractorBootstrapAdapter', () => {
    const accessContext = {
      targetOrganizationId: 'org-demo',
    } as never;

    it('returns HCM bootstrap adapter for CMS_ONLY demo tenant', async () => {
      tenantAuthority.resolveForOrganization.mockResolvedValue({
        supplierAuthorityMode: SupplierAuthorityMode.ORACLE_ONLY,
        contractorAuthorityMode: ContractorAuthorityMode.CMS_ONLY,
      });

      await expect(
        registry.requireContractorBootstrapAdapter(accessContext),
      ).resolves.toBe(oracleHcmContractor);
    });
  });
});
