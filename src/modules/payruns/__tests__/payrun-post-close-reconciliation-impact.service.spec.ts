import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PayrunPostCloseReconciliationImpactService } from '../payrun-post-close-reconciliation-impact.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';

describe('PayrunPostCloseReconciliationImpactService (GOV-4 / GOV-4-LOCK)', () => {
  let service: PayrunPostCloseReconciliationImpactService;
  let prisma: {
    payRun: { findUnique: jest.Mock; update: jest.Mock };
    payrunReversalWorkflow: { findMany: jest.Mock; updateMany: jest.Mock };
    payrunCorrectionApproval: { findMany: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      payRun: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      payrunReversalWorkflow: { findMany: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      payrunCorrectionApproval: { findMany: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PayrunPostCloseReconciliationImpactService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(PayrunPostCloseReconciliationImpactService);
  });

  it('getSummary aggregates impact flags and workflow rows', async () => {
    prisma.payRun.findUnique.mockResolvedValue({
      id: 'p1',
      status: 'FINALIZED',
      payrunType: 'REGULAR',
      financialControlImpacted: true,
      bankReconciliationImpacted: false,
      glReconciliationImpacted: true,
    });
    prisma.payrunReversalWorkflow.findMany.mockResolvedValue([
      {
        id: 'w1',
        reversalPayrunId: 'adj1',
        status: 'COMPLETED',
        downstreamReconciliationRequired: true,
      },
    ]);
    prisma.payrunCorrectionApproval.findMany.mockResolvedValue([]);

    const s = await service.getSummary('p1');
    expect(s.any_impact).toBe(true);
    expect(s.downstream_reconciliation_outstanding).toBe(true);
    expect(s.reversal_workflows).toHaveLength(1);
    expect(s.financial_control_impacted).toBe(true);
    expect(s.gl_reconciliation_impacted).toBe(true);
  });

  it('acknowledgeImpact clears flags in a transaction and audits', async () => {
    let payrunReads = 0;
    prisma.payRun.findUnique.mockImplementation(async () => {
      payrunReads += 1;
      const cleared = payrunReads > 1;
      return {
        id: 'p1',
        status: 'FINALIZED',
        payrunType: 'REGULAR',
        financialControlImpacted: !cleared,
        bankReconciliationImpacted: !cleared,
        glReconciliationImpacted: !cleared,
      };
    });
    prisma.payrunReversalWorkflow.findMany.mockResolvedValue([]);
    prisma.payrunCorrectionApproval.findMany.mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue(undefined);

    const after = await service.acknowledgeImpact('p1', 'u1', 're-truthed 3A–3C');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYRUN_POST_CLOSE_RECON_IMPACT_ACK',
        entityId: 'p1',
      }),
    );
    expect(after.any_impact).toBe(false);
  });

  it('acknowledgeImpact throws when nothing pending', async () => {
    prisma.payRun.findUnique.mockResolvedValue({
      id: 'p1',
      status: 'FINALIZED',
      payrunType: 'REGULAR',
      financialControlImpacted: false,
      bankReconciliationImpacted: false,
      glReconciliationImpacted: false,
    });
    prisma.payrunReversalWorkflow.findMany.mockResolvedValue([]);
    prisma.payrunCorrectionApproval.findMany.mockResolvedValue([]);

    await expect(service.acknowledgeImpact('p1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assertAllowsPeriodClose throws when any impact flag is set', async () => {
    prisma.payRun.findUnique.mockResolvedValue({
      financialControlImpacted: false,
      bankReconciliationImpacted: true,
      glReconciliationImpacted: false,
    });
    await expect(service.assertAllowsPeriodClose('p1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assertAllowsPeriodClose passes when flags clear', async () => {
    prisma.payRun.findUnique.mockResolvedValue({
      financialControlImpacted: false,
      bankReconciliationImpacted: false,
      glReconciliationImpacted: false,
    });
    await expect(service.assertAllowsPeriodClose('p1')).resolves.toBeUndefined();
  });
});
