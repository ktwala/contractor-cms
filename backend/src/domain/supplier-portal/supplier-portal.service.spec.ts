import { Test } from '@nestjs/testing';
import { IgaIntegrationPlaneStatus } from '@prisma/client';
import { SupplierPortalService } from './supplier-portal.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { IgaWorkforceEventWriter } from '../../core/iga/iga-workforce-event-writer.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

describe('SupplierPortalService (PR-SUPPLIER-CONTRACTOR-TERMINOLOGY-1)', () => {
  let service: SupplierPortalService;
  let persistCreated: jest.Mock;
  let logAction: jest.Mock;
  let txCreate: jest.Mock;

  const accessContext: AccessContext = {
    actorUserId: 'user-1',
    actorOrganizationId: 'org-1',
    targetOrganizationId: 'org-1',
    isGlobalAccess: false,
    supplierScopeId: 'supplier-a',
  };

  const contractorRow = {
    id: 'c-1',
    supplierId: 'supplier-a',
    email: 'portal@test.com',
    firstName: 'Portal',
    lastName: 'Contractor',
    phone: null,
    workerClassification: 'INDEPENDENT_CONTRACTOR',
    engagementModel: 'DIRECT',
    taxResidency: 'ZA',
    skills: [],
    isActive: true,
    createdAt: new Date(),
    externalPersonId: null,
    personType: null,
    workerArchetype: null,
    accessIntent: null,
    riskTier: null,
    igaIntegrationStatus: IgaIntegrationPlaneStatus.IGA_UNKNOWN,
  };

  beforeEach(async () => {
    persistCreated = jest.fn().mockResolvedValue(undefined);
    logAction = jest.fn().mockResolvedValue(undefined);
    txCreate = jest.fn().mockResolvedValue(contractorRow);

    const tx = {
      contractor: {
        create: txCreate,
        findUniqueOrThrow: jest.fn().mockResolvedValue(contractorRow),
      },
    };

    const prisma = {
      supplier: {
        findFirst: jest.fn().mockResolvedValue({ id: 'supplier-a', organizationId: 'org-1' }),
      },
      contractor: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SupplierPortalService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logAction } },
        {
          provide: IgaWorkforceEventWriter,
          useValue: { persistExternalPersonCreated: persistCreated },
        },
      ],
    }).compile();

    service = moduleRef.get(SupplierPortalService);
  });

  it('createContractor writes IGA outbox and audit like client create', async () => {
    await service.createContractor(accessContext, {
      firstName: 'Portal',
      lastName: 'Contractor',
      email: 'portal@test.com',
      workerClassification: 'INDEPENDENT_CONTRACTOR' as never,
      engagementModel: 'DIRECT' as never,
      taxResidency: 'ZA',
    });

    expect(persistCreated).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(
      'user-1',
      'CONTRACTOR_CREATED',
      'Contractor',
      'c-1',
      null,
      contractorRow,
      { organizationId: 'org-1' },
    );
  });
});
