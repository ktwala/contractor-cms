import { Test } from '@nestjs/testing';
import { ContractorWorkforceState } from '@prisma/client';
import { SupplierPortalService } from './supplier-portal.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { IgaWorkforceEventWriter } from '../../core/iga/iga-workforce-event-writer.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { SupplierEvidenceChecklistService } from '../suppliers/supplier-evidence-checklist.service';
import { SupplierDocumentsService } from '../suppliers/supplier-documents.service';
import { SupplierLifecycleService } from '../suppliers/supplier-lifecycle.service';
import { PdpOperationalGuardService } from '../../pdp/pdp-operational-guard.service';
import { ContractorsService } from '../contractors/contractors.service';
import { ContractorWorkforceHistoryService } from '../contractors/contractor-workforce-history.service';
import { CONTRACTOR_WORKFORCE_DOMAIN_EVENTS } from '../contractors/contractor-workforce-domain-events.constants';

describe('SupplierPortalService workforce nomination (PR-SUPPLIER-PORTAL-WORKFORCE-NOMINATE-1)', () => {
  let service: SupplierPortalService;
  let nominate: jest.Mock;
  let findMany: jest.Mock;

  const accessContext: AccessContext = {
    actorUserId: 'user-1',
    actorOrganizationId: 'org-1',
    targetOrganizationId: 'org-1',
    isGlobalAccess: false,
    effectivePermissions: new Set(['supplier-contractors:create']),
    supplierScopeId: 'supplier-a',
    responsibleManagerEmployeeId: null,
  };

  const nominateDto = {
    firstName: 'Portal',
    lastName: 'Nominee',
    email: 'nominee@test.com',
    workerClassification: 'SUPPLIER_CONTRACTOR' as never,
    engagementModel: 'DIRECT' as never,
    taxResidency: 'ZA',
    engagement: {
      contractId: 'contract-1',
      role: 'Developer',
      startDate: '2026-06-01',
      rateType: 'HOURLY' as never,
      rateAmount: 500,
    },
  };

  beforeEach(async () => {
    nominate = jest.fn().mockResolvedValue({
      id: 'c-nom-1',
      workforceState: ContractorWorkforceState.NOMINATED,
      isActive: false,
    });
    findMany = jest.fn().mockResolvedValue([]);

    const prisma = {
      supplier: {
        findFirst: jest.fn().mockResolvedValue({ id: 'supplier-a', organizationId: 'org-1' }),
      },
      contractor: {
        findMany,
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SupplierPortalService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logAction: jest.fn() } },
        { provide: IgaWorkforceEventWriter, useValue: {} },
        { provide: SupplierEvidenceChecklistService, useValue: {} },
        { provide: SupplierDocumentsService, useValue: {} },
        { provide: SupplierLifecycleService, useValue: {} },
        {
          provide: PdpOperationalGuardService,
          useValue: { assertAllowed: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ContractorsService,
          useValue: { nominate },
        },
        {
          provide: ContractorWorkforceHistoryService,
          useValue: { listForContractor: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(SupplierPortalService);
  });

  it('createContractor delegates to ContractorsService.nominate with membership supplierId', async () => {
    await service.createContractor(accessContext, nominateDto);

    expect(nominate).toHaveBeenCalledWith(
      accessContext,
      expect.objectContaining({
        supplierId: 'supplier-a',
        email: 'nominee@test.com',
        engagement: nominateDto.engagement,
      }),
    );
  });

  it('listContractors includes nominated workers (not isActive-only filter)', async () => {
    await service.listContractors(accessContext, 1, 20);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          supplierId: 'supplier-a',
          workforceState: { not: ContractorWorkforceState.BLACKLISTED },
        }),
      }),
    );
  });

  it('uses ContractorNominated domain event constant in workforce plane', () => {
    expect(CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.NOMINATED).toBe('ContractorNominated');
  });
});
