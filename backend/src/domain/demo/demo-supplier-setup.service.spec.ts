import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractType, SupplierStatus } from '@prisma/client';
import { DemoSupplierSetupService } from './demo-supplier-setup.service';
import {
  DEMO_CLEAN_SUPPLIER_EXTERNAL_ID,
  DEMO_SEED_CONTRACT_NUMBER,
  DEMO_SUPPLIER_ADMIN_EMAIL,
} from './demo-supplier.constants';

describe('DemoSupplierSetupService', () => {
  const organizationId = 'org-1';
  const supplierId = 'supplier-atlas';
  const accessContext = {
    targetOrganizationId: organizationId,
    actorUserId: 'ops-user',
    isGlobalAccess: false,
  } as any;

  let service: DemoSupplierSetupService;
  let prisma: {
    supplier: { findFirst: jest.Mock; update: jest.Mock };
    contractor: { findMany: jest.Mock; deleteMany: jest.Mock };
    contractorEngagement: { findMany: jest.Mock; deleteMany: jest.Mock };
    responsibleManagerAccountabilityTask: { deleteMany: jest.Mock };
    contractorGovernanceRemediation: { deleteMany: jest.Mock };
    contractorSourceDrift: { deleteMany: jest.Mock };
    withholdingInstruction: { deleteMany: jest.Mock };
    contractorTaxClassification: { deleteMany: jest.Mock };
    timesheet: { deleteMany: jest.Mock };
    contractorIdentityMap: { deleteMany: jest.Mock };
    contractorMigrationAudit: { deleteMany: jest.Mock };
    contractorWorkforceHistory: { deleteMany: jest.Mock };
    user: { updateMany: jest.Mock };
    hcmContractorStaging: { updateMany: jest.Mock };
    supplierContract: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let suppliersService: { assignPortalMembership: jest.Mock; transitionStatus: jest.Mock };
  let auditService: { logAction: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      supplier: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      contractor: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      contractorEngagement: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      responsibleManagerAccountabilityTask: { deleteMany: jest.fn() },
      contractorGovernanceRemediation: { deleteMany: jest.fn() },
      contractorSourceDrift: { deleteMany: jest.fn() },
      withholdingInstruction: { deleteMany: jest.fn() },
      contractorTaxClassification: { deleteMany: jest.fn() },
      timesheet: { deleteMany: jest.fn() },
      contractorIdentityMap: { deleteMany: jest.fn() },
      contractorMigrationAudit: { deleteMany: jest.fn() },
      contractorWorkforceHistory: { deleteMany: jest.fn() },
      user: { updateMany: jest.fn() },
      hcmContractorStaging: { updateMany: jest.fn() },
      supplierContract: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    suppliersService = {
      assignPortalMembership: jest.fn(),
      transitionStatus: jest.fn(),
    };
    auditService = { logAction: jest.fn() };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'DEMO_MODE') return 'true';
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    };

    service = new DemoSupplierSetupService(
      prisma as any,
      config as unknown as ConfigService,
      suppliersService as any,
      auditService as any,
    );
  });

  it('rejects when demo mode is disabled in production', () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'DEMO_MODE') return 'false';
      if (key === 'NODE_ENV') return 'production';
      return undefined;
    });

    expect(() => service.assertDemoMode()).toThrow(BadRequestException);
  });

  it('requires a promoted Oracle demo supplier', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null);

    await expect(service.completeSupplierSetup(accessContext)).rejects.toThrow(
      DEMO_CLEAN_SUPPLIER_EXTERNAL_ID,
    );
  });

  it('assigns membership and seeds an ACTIVE demo contract', async () => {
    prisma.supplier.findFirst.mockResolvedValue({
      id: supplierId,
      status: SupplierStatus.ACTIVE,
      organizationId,
    });
    suppliersService.assignPortalMembership.mockResolvedValue({
      userEmail: DEMO_SUPPLIER_ADMIN_EMAIL,
      role: 'ADMIN',
    });
    prisma.supplierContract.findFirst.mockResolvedValue(null);
    prisma.supplierContract.create.mockResolvedValue({
      id: 'contract-1',
      contractNumber: DEMO_SEED_CONTRACT_NUMBER,
      status: 'ACTIVE',
    });

    const result = await service.completeSupplierSetup(accessContext);

    expect(suppliersService.assignPortalMembership).toHaveBeenCalledWith(
      accessContext,
      supplierId,
      { userEmail: DEMO_SUPPLIER_ADMIN_EMAIL, role: 'ADMIN' },
    );
    expect(prisma.supplierContract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supplierId,
          organizationId,
          contractNumber: DEMO_SEED_CONTRACT_NUMBER,
          contractType: ContractType.TIME_AND_MATERIALS,
          status: 'ACTIVE',
        }),
      }),
    );
    expect(result.contract.created).toBe(true);
    expect(result.portalWorkersRemoved).toBe(0);
    expect(result.portalMembership.userEmail).toBe(DEMO_SUPPLIER_ADMIN_EMAIL);
  });
});
