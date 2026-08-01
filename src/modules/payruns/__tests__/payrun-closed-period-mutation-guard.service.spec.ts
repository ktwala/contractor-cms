import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PayRunType } from '@prisma/client';
import { PayrunClosedPeriodMutationGuardService } from '../payrun-closed-period-mutation-guard.service';
import { PayrunReversalWorkflowService } from '../payrun-reversal-workflow.service';
import { PayrunCorrectionApprovalService } from '../payrun-correction-approval.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import { PayrunGovernancePolicyResolutionService } from '../payrun-governance-policy-resolution.service';

describe('PayrunClosedPeriodMutationGuardService', () => {
  let service: PayrunClosedPeriodMutationGuardService;
  let prisma: { payRun: { findUnique: jest.Mock }; payPeriod: { findUnique: jest.Mock } };
  let audit: { log: jest.Mock };
  let reversalWorkflows: { isApprovedWorkflowForSourceMutation: jest.Mock };
  let correctionApprovals: { isApprovedCorrectionForSourceMutation: jest.Mock };
  let govPolicy: {
    resolveJustificationMinForContext: jest.Mock;
    resolveClosedPeriodMutationMode: jest.Mock;
  };

  const closedRegularRow = {
    periodId: 'pp1',
    payrunType: PayRunType.REGULAR,
    payGroupId: 'pg1',
    payGroup: { legalEntityId: 'le1' },
  };

  beforeEach(async () => {
    prisma = {
      payRun: { findUnique: jest.fn() },
      payPeriod: { findUnique: jest.fn() },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    reversalWorkflows = { isApprovedWorkflowForSourceMutation: jest.fn().mockResolvedValue(false) };
    correctionApprovals = { isApprovedCorrectionForSourceMutation: jest.fn().mockResolvedValue(false) };
    govPolicy = {
      resolveJustificationMinForContext: jest.fn().mockResolvedValue({
        value: 20,
        source: 'default',
        policy_id: null,
        policy_key: 'override.justification_min_length',
      }),
      resolveClosedPeriodMutationMode: jest.fn().mockResolvedValue({
        value: 'STANDARD',
        source: 'default',
        policy_id: null,
        policy_key: 'closed_period.mutation_policy',
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PayrunClosedPeriodMutationGuardService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: PayrunReversalWorkflowService, useValue: reversalWorkflows },
        { provide: PayrunCorrectionApprovalService, useValue: correctionApprovals },
        { provide: PayrunGovernancePolicyResolutionService, useValue: govPolicy },
      ],
    }).compile();

    service = moduleRef.get(PayrunClosedPeriodMutationGuardService);
  });

  it('allows mutation when payrun has no period', async () => {
    prisma.payRun.findUnique.mockResolvedValue({ ...closedRegularRow, periodId: null });
    await expect(
      service.assertAllowsPayrunTemporalMutation('pr1', { sub: 'u1', permissions: [] }, {}, 'payrun.snapshot'),
    ).resolves.toBeUndefined();
  });

  it('allows mutation for ADJUSTMENT payrun even if period is closed', async () => {
    prisma.payRun.findUnique.mockResolvedValue({
      periodId: 'pp1',
      payrunType: PayRunType.ADJUSTMENT,
      payGroupId: 'pg1',
      payGroup: { legalEntityId: 'le1' },
    });
    await expect(
      service.assertAllowsPayrunTemporalMutation('pr1', { sub: 'u1', permissions: [] }, {}, 'payrun.snapshot'),
    ).resolves.toBeUndefined();
    expect(prisma.payPeriod.findUnique).not.toHaveBeenCalled();
  });

  it('blocks REGULAR payrun when period is closed', async () => {
    prisma.payRun.findUnique.mockResolvedValue(closedRegularRow);
    prisma.payPeriod.findUnique.mockResolvedValue({ closedAt: new Date() });
    await expect(
      service.assertAllowsPayrunTemporalMutation('pr1', { sub: 'u1', permissions: [] }, {}, 'payrun.snapshot'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows bypass with override permission + approved + justification', async () => {
    prisma.payRun.findUnique.mockResolvedValue(closedRegularRow);
    prisma.payPeriod.findUnique.mockResolvedValue({ closedAt: new Date() });
    await expect(
      service.assertAllowsPayrunTemporalMutation(
        'pr1',
        { sub: 'u1', permissions: ['payrun:closed_period_override'] },
        {
          bypassHeader: 'approved',
          justification: 'x'.repeat(20),
        },
        'payrun.snapshot',
      ),
    ).resolves.toBeUndefined();
    expect(audit.log).toHaveBeenCalled();
  });

  it('throws NotFound when payrun is missing', async () => {
    prisma.payRun.findUnique.mockResolvedValue(null);
    await expect(
      service.assertAllowsPayrunTemporalMutation('missing', { sub: 'u1' }, {}, 'op'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows governed reversal path when pre-link workflow is approved (GOV-3D-2)', async () => {
    prisma.payRun.findUnique.mockResolvedValue(closedRegularRow);
    prisma.payPeriod.findUnique.mockResolvedValue({ closedAt: new Date() });
    reversalWorkflows.isApprovedWorkflowForSourceMutation.mockResolvedValue(true);
    await expect(
      service.assertAllowsPayrunTemporalMutation(
        'pr1',
        { sub: 'u1', permissions: [] },
        { reversalWorkflowId: 'wf-uuid-here', justification: 'y'.repeat(20) },
        'payrun.snapshot',
      ),
    ).resolves.toBeUndefined();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PAYRUN_CLOSED_PERIOD_GOVERNED_MUTATION' }),
    );
  });

  it('GOV-6B: denies break-glass bypass when closed_period.mutation_policy is GOVERNED_PATHS_ONLY', async () => {
    prisma.payRun.findUnique.mockResolvedValue(closedRegularRow);
    prisma.payPeriod.findUnique.mockResolvedValue({ closedAt: new Date() });
    govPolicy.resolveClosedPeriodMutationMode.mockResolvedValue({
      value: 'GOVERNED_PATHS_ONLY',
      source: 'registry',
      policy_id: 'pol-1',
      policy_key: 'closed_period.mutation_policy',
    });
    await expect(
      service.assertAllowsPayrunTemporalMutation(
        'pr1',
        { sub: 'u1', permissions: ['payrun:closed_period_override'] },
        { bypassHeader: 'approved', justification: 'x'.repeat(20) },
        'payrun.snapshot',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
