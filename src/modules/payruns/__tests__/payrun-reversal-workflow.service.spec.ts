import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PayrunReversalWorkflowStatus } from '@prisma/client';
import { PayrunReversalWorkflowService } from '../payrun-reversal-workflow.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';

describe('PayrunReversalWorkflowService (GOV-3D-2-LOCK)', () => {
  let service: PayrunReversalWorkflowService;
  let prisma: {
    payrunReversalWorkflow: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      payrunReversalWorkflow: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PayrunReversalWorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(PayrunReversalWorkflowService);
  });

  it('forbids initiator approving own reversal workflow (SoD)', async () => {
    prisma.payrunReversalWorkflow.findUnique.mockResolvedValue({
      id: 'w1',
      sourcePayrunId: 'p1',
      initiatedByUserId: 'u1',
      status: PayrunReversalWorkflowStatus.PENDING_APPROVAL,
      auditChain: [],
    });
    await expect(service.approve('w1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('isApprovedWorkflowForSourceMutation is false after reversal payrun is linked (reuse guard)', async () => {
    prisma.payrunReversalWorkflow.count.mockResolvedValue(0);
    await expect(service.isApprovedWorkflowForSourceMutation('w1', 'p1')).resolves.toBe(false);
    expect(prisma.payrunReversalWorkflow.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reversalPayrunId: null,
          status: PayrunReversalWorkflowStatus.APPROVED,
        }),
      }),
    );
  });

  it('isApprovedWorkflowForSourceMutation is true only for approved pre-link rows', async () => {
    prisma.payrunReversalWorkflow.count.mockResolvedValue(1);
    await expect(service.isApprovedWorkflowForSourceMutation('w1', 'p1')).resolves.toBe(true);
  });
});
