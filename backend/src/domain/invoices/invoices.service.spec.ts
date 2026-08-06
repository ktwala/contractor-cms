import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { ConflictException } from '@nestjs/common';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

describe('InvoicesService.generateFromTimesheets', () => {
  let service: InvoicesService;
  let prismaMock: any;
  let auditMock: any;

  const accessContext: AccessContext = {
    actorUserId: 'user-1',
    actorOrganizationId: 'org-1',
    targetOrganizationId: 'org-1',
    isGlobalAccess: false,
    effectivePermissions: new Set(['invoices:create']),
    supplierScopeId: null,
    responsibleManagerEmployeeId: null,
  };

  beforeEach(async () => {
    prismaMock = {
      timesheet: {
        findMany: jest.fn(),
      },
      invoice: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      supplier: {
        findFirst: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    auditMock = {
      logAction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('should throw ConflictException if one or more timesheets are already invoiced', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { id: 'ts-1', invoiceId: 'inv-123', status: 'APPROVED' },
    ]);

    await expect(
      service.generateFromTimesheets(accessContext, {
        timesheetIds: ['ts-1'],
        invoiceNumber: 'INV-123',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      }),
    ).rejects.toThrow(
      new ConflictException('One or more timesheets are already invoiced'),
    );
  });

  it('should claim timesheets and create invoice if available', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { id: 'ts-1', invoiceId: null, status: 'APPROVED' },
    ]);

    prismaMock.timesheet.findMany.mockResolvedValue([
      {
        id: 'ts-1',
        status: 'APPROVED',
        invoiceId: null,
        totalHours: 8,
        periodStart: new Date(Date.now() - 86400000),
        periodEnd: new Date(),
        contractor: {
          supplierId: 'supplier-1',
          firstName: 'John',
          lastName: 'Doe',
          supplier: {
            organizationId: 'org-1',
          },
          engagements: [
            {
              id: 'eng-1',
              rateAmount: 100,
              rateType: 'HOURLY',
              currency: 'ZAR',
              role: 'Dev',
              isActive: true,
            },
          ],
        },
        entries: [],
      },
    ]);

    prismaMock.supplier.findFirst.mockResolvedValue({
      id: 'supplier-1',
      organizationId: 'org-1',
    });

    prismaMock.invoice.create.mockResolvedValue({
      id: 'invoice-123',
      invoiceNumber: 'INV-123',
      lineItems: [],
      timesheets: [],
    });

    const result = await service.generateFromTimesheets(accessContext, {
      timesheetIds: ['ts-1'],
      invoiceNumber: 'INV-123',
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    });

    expect(prismaMock.$queryRaw).toHaveBeenCalled();
    expect(prismaMock.timesheet.findMany).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
