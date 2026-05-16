import { Test } from '@nestjs/testing';
import { ContractorsService } from './contractors.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

describe('ContractorsService', () => {
  let service: ContractorsService;
  let prisma: {
    contractor: { findMany: jest.Mock; count: jest.Mock };
  };

  const auditService = {
    logAction: jest.fn().mockResolvedValue(undefined),
  };

  const globalAccess: AccessContext = {
    actorUserId: 'user-1',
    actorOrganizationId: null,
    targetOrganizationId: null,
    isGlobalAccess: true,
    supplierScopeId: null,
  };

  beforeEach(async () => {
    prisma = {
      contractor: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ContractorsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = moduleRef.get(ContractorsService);
  });

  it('findAll includes supplier.type in nested select', async () => {
    await service.findAll(globalAccess, { page: 1, limit: 10 } as any);

    expect(prisma.contractor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          supplier: {
            select: {
              id: true,
              type: true,
              companyName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    );
  });
});
