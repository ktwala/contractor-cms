import { ForbiddenException } from '@nestjs/common';
import { PayrunBankReconciliationStatus } from '@prisma/client';
import {
  PayrunBankReconciliationService,
  PAYRUN_BANK_OVERRIDE_PERMISSION,
} from '../payrun-bank-reconciliation.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import { PayrunGovernancePolicyResolutionService } from '../payrun-governance-policy-resolution.service';

describe('PayrunBankReconciliationService.assertAllowsMarkPostedBankGate', () => {
  const make = (recon: {
    status: PayrunBankReconciliationStatus;
    reviewedAt: Date | null;
    reviewRequired: boolean;
    blockedReasonsJson?: unknown;
    softWarningsJson?: unknown;
  } | null) => {
    const prisma = {
      payRun: {
        findUnique: jest.fn().mockResolvedValue({
          payGroupId: 'pg1',
          payGroup: { legalEntityId: 'le1' },
        }),
      },
      payrunFinancialControl: {
        findUnique: jest.fn().mockResolvedValue({ paymentBatchId: 'b1' }),
      },
      paymentBatch: {
        findUnique: jest.fn().mockResolvedValue({ exportStatus: 'GENERATED' }),
      },
      payrunBankReconciliation: {
        findUnique: jest.fn().mockResolvedValue(
          recon
            ? {
                id: 'r1',
                paymentBatchId: 'b1',
                status: recon.status,
                reviewedAt: recon.reviewedAt,
                reviewRequired: recon.reviewRequired,
                blockedReasonsJson: recon.blockedReasonsJson ?? [],
                softWarningsJson: recon.softWarningsJson ?? [],
              }
            : null,
        ),
      },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const govPolicy = {
      resolvePayrunContext: jest.fn().mockResolvedValue({ legalEntityId: 'le1', payGroupId: 'pg1' }),
      resolveJustificationMinForContext: jest.fn().mockResolvedValue({
        value: 20,
        source: 'default',
        policy_id: null,
        policy_key: 'override.justification_min_length',
      }),
    };
    const svc = new PayrunBankReconciliationService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      govPolicy as unknown as PayrunGovernancePolicyResolutionService,
    );
    return { svc, prisma, audit };
  };

  it('allows MATCH without override', async () => {
    const { svc, audit } = make({
      status: PayrunBankReconciliationStatus.MATCH,
      reviewedAt: null,
      reviewRequired: false,
    });
    await expect(
      svc.assertAllowsMarkPostedBankGate('pr1', { sub: 'u1', permissions: [] }, {}, 'payrun.mark_posted'),
    ).resolves.toBeUndefined();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('allows VARIANCE after review', async () => {
    const { svc } = make({
      status: PayrunBankReconciliationStatus.VARIANCE,
      reviewedAt: new Date(),
      reviewRequired: false,
    });
    await expect(
      svc.assertAllowsMarkPostedBankGate('pr1', { sub: 'u1', permissions: [] }, {}, 'payrun.mark_posted'),
    ).resolves.toBeUndefined();
  });

  it('allows soft-only VARIANCE when review is not required', async () => {
    const { svc } = make({
      status: PayrunBankReconciliationStatus.VARIANCE,
      reviewedAt: null,
      reviewRequired: false,
    });
    await expect(
      svc.assertAllowsMarkPostedBankGate('pr1', { sub: 'u1', permissions: [] }, {}, 'payrun.mark_posted'),
    ).resolves.toBeUndefined();
  });

  it('blocks when recon row missing', async () => {
    const { svc } = make(null);
    await expect(
      svc.assertAllowsMarkPostedBankGate('pr1', { sub: 'u1', permissions: [] }, {}, 'payrun.mark_posted'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks BLOCKED without override', async () => {
    const { svc } = make({
      status: PayrunBankReconciliationStatus.BLOCKED,
      reviewedAt: null,
      reviewRequired: true,
      blockedReasonsJson: ['BANK_TOTAL_MISMATCH'],
    });
    await expect(
      svc.assertAllowsMarkPostedBankGate('pr1', { sub: 'u1', permissions: ['payrun:post'] }, {}, 'payrun.mark_posted'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows audited bank override', async () => {
    const { svc, audit } = make({
      status: PayrunBankReconciliationStatus.BLOCKED,
      reviewedAt: null,
      reviewRequired: true,
    });
    await expect(
      svc.assertAllowsMarkPostedBankGate(
        'pr1',
        { sub: 'u1', permissions: [PAYRUN_BANK_OVERRIDE_PERMISSION] },
        { overrideHeader: 'approved', justification: 'x'.repeat(20) },
        'payrun.mark_posted',
      ),
    ).resolves.toBeUndefined();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYRUN_BANK_RECON_OVERRIDE',
        entityId: 'pr1',
      }),
    );
  });
});
