import { Test } from '@nestjs/testing';
import { PayrunGovernanceHealthService } from '../payrun-governance-health.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { PayrollReadinessService } from '../../payroll-readiness/payroll-readiness.service';
import { PayrunsService } from '../payruns.service';
import { PayrunFinancialControlService } from '../payrun-financial-control.service';
import { PayrunBankReconciliationService } from '../payrun-bank-reconciliation.service';
import { PayrunGLReconciliationService } from '../payrun-gl-reconciliation.service';
import { PayrunReversalWorkflowService } from '../payrun-reversal-workflow.service';
import { PayrunCorrectionApprovalService } from '../payrun-correction-approval.service';
import { PayrunPostCloseReconciliationImpactService } from '../payrun-post-close-reconciliation-impact.service';

describe('PayrunGovernanceHealthService (GOV-5A / GOV-5A-LOCK)', () => {
  let service: PayrunGovernanceHealthService;

  const payruns = {
    findOne: jest.fn().mockResolvedValue({
      id: 'pr1',
      pay_group_id: 'pg1',
      period_id: 'per1',
      status: 'FINALIZED',
      payrun_type: 'REGULAR',
    }),
  };
  const prisma = {
    payPeriod: { findUnique: jest.fn().mockResolvedValue({ closedAt: new Date() }) },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const readiness = {
    getPayGroupReadiness: jest.fn().mockResolvedValue({
      canCreatePayrun: true,
      readinessPercent: 100,
      blockingReasons: [],
    }),
  };
  const financial = {
    getForPayrun: jest.fn().mockResolvedValue({
      status: 'MATCH',
      post_close_reconciliation_impact_pending: false,
      blocked_reasons: [],
      review_required: false,
      reviewed_at: null,
    }),
  };
  const bank = {
    getForPayrun: jest.fn().mockResolvedValue({
      status: 'MATCH',
      post_close_reconciliation_impact_pending: false,
      reviewed_at: '2026-01-01T00:00:00.000Z',
      review_required: false,
    }),
  };
  const gl = {
    getForPayrun: jest.fn().mockResolvedValue({
      status: 'MATCH',
      post_close_reconciliation_impact_pending: false,
      review_required: false,
      reviewed_at: '2026-01-01T00:00:00.000Z',
    }),
  };
  const reversals = { listForSourcePayrun: jest.fn().mockResolvedValue([]) };
  const corrections = { listForPayrun: jest.fn().mockResolvedValue([]) };
  const postClose = {
    getSummary: jest.fn().mockResolvedValue({
      any_impact: false,
      downstream_reconciliation_outstanding: false,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PayrunGovernanceHealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PayrunsService, useValue: payruns },
        { provide: PayrollReadinessService, useValue: readiness },
        { provide: PayrunFinancialControlService, useValue: financial },
        { provide: PayrunBankReconciliationService, useValue: bank },
        { provide: PayrunGLReconciliationService, useValue: gl },
        { provide: PayrunReversalWorkflowService, useValue: reversals },
        { provide: PayrunCorrectionApprovalService, useValue: corrections },
        { provide: PayrunPostCloseReconciliationImpactService, useValue: postClose },
      ],
    }).compile();
    service = moduleRef.get(PayrunGovernanceHealthService);
  });

  it('returns governance health with ladder and overall RAG', async () => {
    const h = await service.getHealthForPayrun('pr1', { sub: 'u1', permissions: ['payrun:read'] });
    expect(h.payrun_id).toBe('pr1');
    expect(h.closed_period_status).toBe('CLOSED');
    expect(h.readiness_status).toBe('GREEN');
    expect(h.financial_control_status).toBe('GREEN');
    expect(h.ladder.length).toBeGreaterThanOrEqual(6);
    expect(h.overall_governance_rag).toBeDefined();
    expect(postClose.getSummary).toHaveBeenCalledWith('pr1');
  });
});
