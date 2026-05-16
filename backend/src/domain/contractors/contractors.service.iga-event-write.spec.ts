import { Test } from '@nestjs/testing';
import { IgaIntegrationPlaneStatus } from '@prisma/client';
import { ContractorsService } from './contractors.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { IgaWorkforceEventWriter } from '../../core/iga/iga-workforce-event-writer.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

describe('ContractorsService IGA event writes (PR-IGA-EVENT-WRITE-1)', () => {
  let service: ContractorsService;
  let persistCreated: jest.Mock;
  let persistUpdated: jest.Mock;
  let txCreate: jest.Mock;
  let txUpdate: jest.Mock;

  const accessContext: AccessContext = {
    actorUserId: 'user-1',
    actorOrganizationId: 'org-1',
    targetOrganizationId: 'org-1',
    isGlobalAccess: false,
  };

  const contractorRow = {
    id: 'c-1',
    supplierId: 's-1',
    email: 'a@b.com',
    firstName: 'A',
    lastName: 'B',
    engagementModel: 'DIRECT',
    taxResidency: 'ZA',
    skills: [],
    externalPersonId: null,
    personType: null,
    workerArchetype: null,
    accessIntent: null,
    riskTier: null,
    igaIntegrationStatus: IgaIntegrationPlaneStatus.IGA_UNKNOWN,
  };

  const supplier = { id: 's-1', organizationId: 'org-1' };

  beforeEach(async () => {
    persistCreated = jest.fn().mockResolvedValue(undefined);
    persistUpdated = jest.fn().mockResolvedValue(undefined);
    txCreate = jest.fn().mockResolvedValue(contractorRow);
    txUpdate = jest.fn().mockResolvedValue(contractorRow);

    const tx = {
      contractor: {
        create: txCreate,
        update: txUpdate,
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...contractorRow,
          supplier: { id: 's-1', type: 'COMPANY' },
        }),
      },
    };

    const prisma = {
      supplier: { findFirst: jest.fn().mockResolvedValue(supplier) },
      contractor: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ContractorsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logAction: jest.fn() } },
        {
          provide: IgaWorkforceEventWriter,
          useValue: {
            persistExternalPersonCreated: persistCreated,
            persistExternalPersonUpdated: persistUpdated,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ContractorsService);
  });

  it('create writes one EXTERNAL_PERSON_CREATED outbox event in the transaction', async () => {
    await service.create(accessContext, {
      supplierId: 's-1',
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      engagementModel: 'DIRECT',
      taxResidency: 'ZA',
    } as any);

    expect(persistCreated).toHaveBeenCalledTimes(1);
    expect(persistUpdated).not.toHaveBeenCalled();
    expect(persistCreated.mock.calls[0][1]).toBeDefined();
  });

  it('update writes one EXTERNAL_PERSON_UPDATED outbox event in the transaction', async () => {
    const prisma = (service as any).prisma;
    prisma.contractor.findFirst.mockResolvedValue(contractorRow);

    await service.update(accessContext, 'c-1', { firstName: 'Updated' } as any);

    expect(persistUpdated).toHaveBeenCalledTimes(1);
    expect(persistCreated).not.toHaveBeenCalled();
  });

  it('create fails when outbox persist fails (mutation not completed from caller view)', async () => {
    persistCreated.mockRejectedValue(new Error('outbox unavailable'));

    await expect(
      service.create(accessContext, {
        supplierId: 's-1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        engagementModel: 'DIRECT',
        taxResidency: 'ZA',
      } as any),
    ).rejects.toThrow('outbox unavailable');
  });
});
