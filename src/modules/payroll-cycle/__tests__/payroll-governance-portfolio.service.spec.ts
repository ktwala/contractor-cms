import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PayrollGovernancePortfolioService } from '../services/payroll-governance-portfolio.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('PayrollGovernancePortfolioService (GOV-5B / GOV-5B-LOCK)', () => {
  let service: PayrollGovernancePortfolioService;
  const prisma = {
    payPeriod: { findUnique: jest.fn() },
    payGroup: { findUnique: jest.fn() },
    legalEntity: { findUnique: jest.fn() },
    payRun: { findMany: jest.fn(), count: jest.fn() },
    payrunFinancialControl: { findMany: jest.fn() },
    payrunBankReconciliation: { findMany: jest.fn() },
    payrunGLReconciliation: { findMany: jest.fn() },
    payrunException: { count: jest.fn() },
    auditLog: { count: jest.fn() },
  };

  const user = {
    sub: 'u1',
    legalEntityAccess: ['le1'],
    hasGlobalScope: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [PayrollGovernancePortfolioService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(PayrollGovernancePortfolioService);
  });

  it('denies portfolio when user has no legal entity access', async () => {
    prisma.payPeriod.findUnique.mockResolvedValue({
      payGroup: { legalEntityId: 'le99' },
    });
    await expect(service.summarizePeriod('p1', user)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns zeroed summary when period has no payruns', async () => {
    prisma.payPeriod.findUnique.mockResolvedValue({
      payGroup: { legalEntityId: 'le1', code: 'PG' },
      year: 2026,
      periodNum: 1,
      startDate: new Date('2026-01-01'),
    });
    prisma.payRun.findMany.mockResolvedValue([]);
    const s = await service.summarizePeriod('per1', user);
    expect(s.total_payruns).toBe(0);
    expect(s.scope).toBe('period');
  });
});
