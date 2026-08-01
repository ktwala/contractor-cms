import { Test } from '@nestjs/testing';
import { SupplierPortalService } from './supplier-portal.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { IgaWorkforceEventWriter } from '../../core/iga/iga-workforce-event-writer.service';
import { SupplierEvidenceChecklistService } from '../suppliers/supplier-evidence-checklist.service';
import { SupplierDocumentsService } from '../suppliers/supplier-documents.service';
import { SupplierLifecycleService } from '../suppliers/supplier-lifecycle.service';
import { PdpOperationalGuardService } from '../../pdp/pdp-operational-guard.service';
import { ContractorsService } from '../contractors/contractors.service';
import { ContractorWorkforceHistoryService } from '../contractors/contractor-workforce-history.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { SUPPLIER_PORTAL_EMPTY_STATES } from './supplier-portal.types';

describe('SupplierPortalService.listInvoices (PR-SUPPLIER-PORTAL-INVOICES-1)', () => {
  let service: SupplierPortalService;
  let findMany: jest.Mock;
  let count: jest.Mock;

  const accessContext: AccessContext = {
    actorUserId: 'user-1',
    actorOrganizationId: 'org-1',
    targetOrganizationId: 'org-1',
    isGlobalAccess: false,
    effectivePermissions: new Set(['supplier-invoices:read']),
    supplierScopeId: 'supplier-a',
    responsibleManagerEmployeeId: null,
  };

  const invoiceRow = {
    id: 'inv-1',
    invoiceNumber: 'INV-2024-001',
    invoiceDate: new Date('2024-06-01'),
    dueDate: new Date('2024-06-30'),
    periodStart: new Date('2024-05-01'),
    periodEnd: new Date('2024-05-31'),
    status: 'SUBMITTED',
    currency: 'ZAR',
    subtotal: '1000.00',
    vatAmount: '150.00',
    totalAmount: '1150.00',
    submittedAt: new Date('2024-06-02'),
    approvedAt: null,
    paidAt: null,
    paymentReference: null,
  };

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([invoiceRow]);
    count = jest.fn().mockResolvedValue(1);

    const prisma = {
      invoice: { findMany, count },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SupplierPortalService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logAction: jest.fn() } },
        {
          provide: IgaWorkforceEventWriter,
          useValue: { persistExternalPersonCreated: jest.fn() },
        },
        {
          provide: SupplierEvidenceChecklistService,
          useValue: { buildChecklistForSupplier: jest.fn() },
        },
        { provide: SupplierDocumentsService, useValue: {} },
        { provide: SupplierLifecycleService, useValue: {} },
        { provide: PdpOperationalGuardService, useValue: { assertAllowed: jest.fn() } },
        { provide: ContractorsService, useValue: { nominate: jest.fn() } },
        {
          provide: ContractorWorkforceHistoryService,
          useValue: { listForContractor: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(SupplierPortalService);
  });

  it('scopes list to membership supplierId and organization', async () => {
    const result = await service.listInvoices(accessContext, { page: 1, limit: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          supplierId: 'supplier-a',
          organizationId: 'org-1',
        }),
      }),
    );
    expect(result.supplier_context.supplier_id).toBe('supplier-a');
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as Record<string, unknown>).financialFieldsRestricted).toBe(true);
    expect((result.data[0] as Record<string, unknown>).totalAmount).toBeNull();
  });

  it('returns NO_INVOICES empty state when none exist', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const result = await service.listInvoices(accessContext, {});

    expect(result.empty_state).toBe(SUPPLIER_PORTAL_EMPTY_STATES.NO_INVOICES);
  });
});
