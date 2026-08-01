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

describe('SupplierPortalService (PR-SUPPLIER-CONTRACTOR-TERMINOLOGY-1)', () => {
  let service: SupplierPortalService;
  let nominate: jest.Mock;

  const accessContext: AccessContext = {
    actorUserId: 'user-1',
    actorOrganizationId: 'org-1',
    targetOrganizationId: 'org-1',
    isGlobalAccess: false,
    effectivePermissions: new Set(['supplier-contractors:create']),
    supplierScopeId: 'supplier-a',
    responsibleManagerEmployeeId: null,
  };

  beforeEach(async () => {
    nominate = jest.fn().mockResolvedValue({
      id: 'c-1',
      workforceState: ContractorWorkforceState.NOMINATED,
      isActive: false,
    });

    const prisma = {
      supplier: {
        findFirst: jest.fn().mockResolvedValue({ id: 'supplier-a', organizationId: 'org-1' }),
      },
      contractor: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        count: jest.fn(),
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

  it('createContractor nominates via ContractorsService (not direct ACTIVE create)', async () => {
    const created = await service.createContractor(accessContext, {
      firstName: 'Portal',
      lastName: 'Contractor',
      email: 'portal@test.com',
      workerClassification: 'INDEPENDENT_CONTRACTOR' as never,
      engagementModel: 'DIRECT' as never,
      taxResidency: 'ZA',
      engagement: {
        contractId: 'contract-1',
        role: 'Developer',
        startDate: '2026-06-01',
        rateType: 'HOURLY' as never,
        rateAmount: 500,
      },
    });

    expect(nominate).toHaveBeenCalledTimes(1);
    expect(nominate).toHaveBeenCalledWith(
      accessContext,
      expect.objectContaining({ supplierId: 'supplier-a' }),
    );
    expect(created.workforceState).toBe(ContractorWorkforceState.NOMINATED);
  });
});
