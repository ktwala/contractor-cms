import { Test } from '@nestjs/testing';
import {
  ContractorWorkforceHistorySource,
  ContractorWorkforceState,
} from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
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

describe('SupplierPortalService workforce timeline (PR-SUPPLIER-PORTAL-WORKFORCE-TIMELINE-1)', () => {
  let service: SupplierPortalService;
  let prisma: {
    contractor: { findFirst: jest.Mock };
  };
  let listForContractor: jest.Mock;

  const accessContext: AccessContext = {
    actorUserId: 'user-1',
    actorOrganizationId: 'org-1',
    targetOrganizationId: 'org-1',
    isGlobalAccess: false,
    effectivePermissions: new Set(['supplier-contractors:read']),
    supplierScopeId: 'supplier-a',
    responsibleManagerEmployeeId: null,
  };

  beforeEach(async () => {
    listForContractor = jest.fn().mockResolvedValue([
      {
        id: 'hist-1',
        contractorId: 'c-1',
        organizationId: 'org-1',
        fromState: null,
        toState: ContractorWorkforceState.NOMINATED,
        transitionLabel: 'Nominated',
        occurredAt: new Date('2026-01-01T10:00:00Z'),
        effectiveAt: null,
        actorUserId: 'ops-user',
        reason: 'Internal note',
        source: ContractorWorkforceHistorySource.SUPPLIER_PORTAL,
        metadata: { stagingId: 'secret' },
      },
    ]);

    prisma = {
      contractor: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c-1' }),
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
        { provide: ContractorsService, useValue: { nominate: jest.fn() } },
        {
          provide: ContractorWorkforceHistoryService,
          useValue: { listForContractor },
        },
      ],
    }).compile();

    service = moduleRef.get(SupplierPortalService);
  });

  it('returns supplier-scoped workforce timeline without ops metadata', async () => {
    const response = await service.getContractorWorkforceHistory(accessContext, 'c-1');

    expect(prisma.contractor.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'c-1',
          supplierId: 'supplier-a',
        }),
      }),
    );
    expect(listForContractor).toHaveBeenCalledWith('c-1');
    expect(response.data).toEqual([
      expect.objectContaining({
        id: 'hist-1',
        transitionLabel: 'Nominated',
        source: ContractorWorkforceHistorySource.SUPPLIER_PORTAL,
      }),
    ]);
    expect(response.data[0]).not.toHaveProperty('actorUserId');
    expect(response.data[0]).not.toHaveProperty('metadata');
    expect(response.data[0]).not.toHaveProperty('reason');
  });

  it('rejects contractors outside supplier scope', async () => {
    prisma.contractor.findFirst.mockResolvedValue(null);

    await expect(
      service.getContractorWorkforceHistory(accessContext, 'other-c'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(listForContractor).not.toHaveBeenCalled();
  });
});
