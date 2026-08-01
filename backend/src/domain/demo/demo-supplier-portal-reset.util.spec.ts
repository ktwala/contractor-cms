import { clearSupplierPortalWorkers } from './demo-supplier-portal-reset.util';

describe('clearSupplierPortalWorkers', () => {
  it('returns 0 when the supplier has no external workers', async () => {
    const prisma = {
      contractor: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const removed = await clearSupplierPortalWorkers(
      prisma as any,
      'org-1',
      'supplier-atlas',
    );

    expect(removed).toBe(0);
  });

  it('deletes portal workers and clears HCM staging links', async () => {
    const prisma = {
      contractor: {
        findMany: jest.fn().mockResolvedValue([{ id: 'worker-1' }]),
        deleteMany: jest.fn(),
      },
      contractorEngagement: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      responsibleManagerAccountabilityTask: { deleteMany: jest.fn() },
      contractorGovernanceRemediation: { deleteMany: jest.fn() },
      contractorSourceDrift: { deleteMany: jest.fn() },
      withholdingInstruction: { deleteMany: jest.fn() },
      contractorTaxClassification: { deleteMany: jest.fn() },
      timesheet: { deleteMany: jest.fn() },
      contractorIdentityMap: { deleteMany: jest.fn() },
      contractorMigrationAudit: { deleteMany: jest.fn() },
      contractorWorkforceHistory: { deleteMany: jest.fn() },
      user: { updateMany: jest.fn() },
      hcmContractorStaging: { updateMany: jest.fn() },
    };

    const removed = await clearSupplierPortalWorkers(
      prisma as any,
      'org-1',
      'supplier-atlas',
    );

    expect(removed).toBe(1);
    expect(prisma.hcmContractorStaging.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          proposedContractorId: { in: ['worker-1'] },
        },
        data: { proposedContractorId: null },
      }),
    );
    expect(prisma.contractor.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['worker-1'] } },
    });
  });
});
