import { ForbiddenException } from '@nestjs/common';
import { PayrunFinancialControlStatus } from '@prisma/client';
import {
  PayrunFinancialControlService,
  PAYRUN_FINANCIAL_OVERRIDE_PERMISSION,
} from '../payrun-financial-control.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import { PayrunGovernancePolicyResolutionService } from '../payrun-governance-policy-resolution.service';

describe('PayrunFinancialControlService.assertAllowsMarkPaidOrPosted', () => {
  const make = (row: {
    status: PayrunFinancialControlStatus;
    reviewedAt: Date | null;
    blockedReasonsJson?: unknown;
    softWarningsJson?: unknown;
  } | null) => {
    const prisma = {
      payrunFinancialControl: {
        findUnique: jest.fn().mockResolvedValue(
          row
            ? {
                payrunId: 'pr1',
                paymentBatchId: 'b1',
                employeeCountRegister: 2,
                employeeCountExport: 2,
                totalNetRegister: 100,
                totalNetExport: 100,
                varianceAmount: 0,
                varianceEmployeeCount: 0,
                status: row.status,
                thresholdPolicy: 'DEFAULT_ZAR_0_05',
                reviewRequired: false,
                reviewedByUserId: null,
                reviewedAt: row.reviewedAt,
                softWarningsJson: row.softWarningsJson ?? [],
                blockedReasonsJson: row.blockedReasonsJson ?? [],
                reconciledAt: new Date(),
                reconciledByUserId: 'u1',
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
    const svc = new PayrunFinancialControlService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      govPolicy as unknown as PayrunGovernancePolicyResolutionService,
    );
    return { svc, prisma, audit };
  };

  it('allows MATCH without override', async () => {
    const { svc, audit } = make({ status: PayrunFinancialControlStatus.MATCH, reviewedAt: null });
    await expect(
      svc.assertAllowsMarkPaidOrPosted('pr1', { sub: 'u1', permissions: [] }, {}, 'payrun.mark_paid'),
    ).resolves.toBeUndefined();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('allows VARIANCE after review', async () => {
    const { svc } = make({
      status: PayrunFinancialControlStatus.VARIANCE,
      reviewedAt: new Date(),
    });
    await expect(
      svc.assertAllowsMarkPaidOrPosted('pr1', { sub: 'u1', permissions: [] }, {}, 'payrun.mark_paid'),
    ).resolves.toBeUndefined();
  });

  it('blocks when control row missing', async () => {
    const { svc } = make(null);
    await expect(
      svc.assertAllowsMarkPaidOrPosted('pr1', { sub: 'u1', permissions: [] }, {}, 'payrun.mark_paid'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks BLOCKED without override', async () => {
    const { svc } = make({
      status: PayrunFinancialControlStatus.BLOCKED,
      reviewedAt: null,
      blockedReasonsJson: ['EXPORT_NOT_GENERATED'],
    });
    await expect(
      svc.assertAllowsMarkPaidOrPosted('pr1', { sub: 'u1', permissions: ['payrun:pay'] }, {}, 'payrun.mark_paid'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows audited financial override', async () => {
    const { svc, audit } = make({
      status: PayrunFinancialControlStatus.BLOCKED,
      reviewedAt: null,
    });
    await expect(
      svc.assertAllowsMarkPaidOrPosted(
        'pr1',
        { sub: 'u1', permissions: [PAYRUN_FINANCIAL_OVERRIDE_PERMISSION] },
        { overrideHeader: 'approved', justification: 'x'.repeat(20) },
        'payrun.mark_paid',
      ),
    ).resolves.toBeUndefined();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYRUN_FINANCIAL_CONTROL_OVERRIDE',
        entityId: 'pr1',
      }),
    );
  });
});
