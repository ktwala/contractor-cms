import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { BadRequestException } from '@nestjs/common';
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
      },
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

  it('should throw BadRequestException if one or more timesheets are already invoiced', async () => {
    prismaMock.timesheet.findMany.mockResolvedValue([
      {
        id: 'ts-1',
        status: 'APPROVED',
        invoiceId: 'inv-123', // already invoiced!
        contractor: {
          supplierId: 'supplier-1',
          supplier: {
            organizationId: 'org-1',
          },
          engagements: [
            {
              id: 'eng-1',
              rateAmount: 100,
              rateType: 'HOURLY',
              currency: 'ZAR',
            },
          ],
        },
        entries: [],
      },
    ]);

    await expect(
      service.generateFromTimesheets(accessContext, {
        timesheetIds: ['ts-1'],
        invoiceNumber: 'INV-123',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
      }),
    ).rejects.toThrow(
      new BadRequestException('One or more timesheets are already invoiced'),
    );
  });

  it('should not throw already invoiced exception if no timesheets are already invoiced', async () => {
    prismaMock.timesheet.findMany.mockResolvedValue([
      {
        id: 'ts-1',
        status: 'APPROVED',
        invoiceId: null, // not invoiced!
        contractor: {
          supplierId: 'supplier-1',
          supplier: {
            organizationId: 'org-1',
          },
          engagements: [
            {
              id: 'eng-1',
              rateAmount: 100,
              rateType: 'HOURLY',
              currency: 'ZAR',
            },
          ],
        },
        entries: [],
      },
    ]);

    try {
      await service.generateFromTimesheets(accessContext, {
        timesheetIds: ['ts-1'],
        invoiceNumber: 'INV-123',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
      });
    } catch (err) {
      expect(err.message).not.toBe('One or more timesheets are already invoiced');
    }
  });
});
