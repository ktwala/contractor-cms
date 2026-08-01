import { ContractorWorkforceState } from '@prisma/client';
import { ContractorsService } from './contractors.service';
import {
  resolveOpsReviewNextTargetState,
  WORKFORCE_OPS_REVIEW_STATES,
} from './contractor-workforce-state.constants';

describe('PR-WORKFORCE-OPS-REVIEW-1 workforce review queue', () => {
  const accessContext = {
    actorUserId: 'user-1',
    targetOrganizationId: 'org-1',
    isGlobalAccess: false,
    effectivePermissions: new Set(['contractors:read', 'contractors:update']),
    supplierScopeId: null,
    responsibleManagerEmployeeId: null,
  } as never;

  it('resolveOpsReviewNextTargetState maps review actions', () => {
    expect(resolveOpsReviewNextTargetState(ContractorWorkforceState.NOMINATED)).toBe(
      ContractorWorkforceState.PENDING_APPROVAL,
    );
    expect(resolveOpsReviewNextTargetState(ContractorWorkforceState.PENDING_APPROVAL)).toBe(
      ContractorWorkforceState.ACTIVE,
    );
    expect(resolveOpsReviewNextTargetState(ContractorWorkforceState.ACTIVE)).toBeNull();
  });

  it('listWorkforceReviewQueue returns nominated and pending rows with placement intent', async () => {
    const nominatedAt = new Date('2026-05-01');
    const prisma = {
      contractor: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ctr-1',
            supplierId: 'sup-1',
            firstName: 'Nom',
            lastName: 'Inee',
            email: 'nom@example.com',
            workerClassification: 'SUPPLIER_CONTRACTOR',
            engagementModel: 'AGENCY',
            workforceState: ContractorWorkforceState.NOMINATED,
            isActive: false,
            createdAt: nominatedAt,
            supplier: {
              id: 'sup-1',
              type: 'COMPANY',
              companyName: 'Acme Supplier',
              tradingName: null,
              firstName: null,
              lastName: null,
              email: 'ops@acme.com',
            },
            engagements: [
              {
                id: 'eng-1',
                role: 'Developer',
                startDate: new Date('2026-06-01'),
                endDate: null,
                rateType: 'HOURLY',
                rateAmount: { toString: () => '750' },
                currency: 'ZAR',
                responsibleManagerEmployeeId: 'hcm:sponsor-1',
                contract: {
                  id: 'contract-1',
                  contractNumber: 'MSA-001',
                  title: 'Master agreement',
                },
              },
            ],
          },
        ]),
      },
    };

    const service = new ContractorsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.listWorkforceReviewQueue(accessContext);

    expect(prisma.contractor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              workforceState: { in: WORKFORCE_OPS_REVIEW_STATES },
            }),
          ]),
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.data[0].canSubmitForReview).toBe(true);
    expect(result.data[0].canActivate).toBe(false);
    expect(result.data[0].canReject).toBe(true);
    expect(result.data[0].canSendBack).toBe(false);
    expect(result.data[0].canBlacklist).toBe(true);
    expect(result.data[0].placementIntent?.contractNumber).toBe('MSA-001');
  });
});
