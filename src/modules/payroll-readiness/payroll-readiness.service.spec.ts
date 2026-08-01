import { Country } from '@prisma/client';
import { PayrollReadinessService } from './payroll-readiness.service';
import { StatutoryBootstrapReadinessService } from '../statutory-readiness/statutory-bootstrap-readiness.service';

describe('PayrollReadinessService (statutory bootstrap / 2C)', () => {
  const payGroupBase = {
    id: 'pg1',
    code: 'MONTHLY',
    country: Country.ZA,
    currency: 'ZAR',
    frequency: 'MONTHLY',
    legalEntity: { id: 'le1' },
  };

  function makePrismaGreenWorkforce() {
    return {
      payGroup: {
        findUnique: jest.fn().mockResolvedValue(payGroupBase),
      },
      employment: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([{ employeeId: 'e1' }, { employeeId: 'e2' }]),
      },
      payPeriod: { count: jest.fn().mockResolvedValue(1) },
      employeePayrollOpeningBalance: { count: jest.fn().mockResolvedValue(0) },
      compensation: { findMany: jest.fn().mockResolvedValue([{ employeeId: 'e1' }, { employeeId: 'e2' }]) },
      bankAccount: { findMany: jest.fn().mockResolvedValue([{ employeeId: 'e1' }, { employeeId: 'e2' }]) },
      taxProfile: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ employeeId: 'e1' }, { employeeId: 'e2' }])
          .mockResolvedValueOnce([{ employeeId: 'e1' }, { employeeId: 'e2' }]),
      },
    };
  }

  function statutoryEval(overrides: Partial<{ pack: boolean; paye: boolean; statutory: boolean }>) {
    const pack = overrides.pack !== false;
    const paye = overrides.paye !== false;
    const statutory = overrides.statutory !== false;
    return {
      country: Country.ZA,
      as_of: '2026-05-07',
      pack_registry: { ready: pack, rows: pack ? [{ id: 'p1' }] : [] },
      paye_tax_table: { ready: paye, rows: paye ? [{ id: 't1' }] : [] },
      statutory_configs: {
        ready: statutory,
        expected_types: ['UIF', 'SDL', 'MTC'],
        checks: [],
      },
      readiness: {
        snapshot_engine_ready: pack && paye,
        operator_bootstrap_complete: pack && paye && statutory,
      },
      notes: { rbac_vs_statutory: '', tta_vs_pack_registry: '' },
    };
  }

  it('adds statutory blockers and sets canCreatePayrun false when PAYE missing (ZA)', async () => {
    const prisma = makePrismaGreenWorkforce() as any;
    const statutoryBootstrapReadiness = {
      evaluate: jest.fn().mockResolvedValue(statutoryEval({ paye: false })),
    };
    const svc = new PayrollReadinessService(prisma, statutoryBootstrapReadiness as unknown as StatutoryBootstrapReadinessService);
    const r = await svc.getPayGroupReadiness('pg1');
    expect(statutoryBootstrapReadiness.evaluate).toHaveBeenCalledWith(Country.ZA, expect.any(Date));
    expect(r.blockingReasons.some((b) => b.code === 'MISSING_PAYE_TAX_TABLE')).toBe(true);
    expect(r.canCreatePayrun).toBe(false);
    expect(r.statutoryBootstrap?.payeTaxTableReady).toBe(false);
    expect(r.nextRecommendedAction).toBe('STATUTORY_BOOTSTRAP');
  });

  it('is green when workforce and statutory bootstrap are satisfied (ZA)', async () => {
    const prisma = makePrismaGreenWorkforce() as any;
    const statutoryBootstrapReadiness = {
      evaluate: jest.fn().mockResolvedValue(statutoryEval({})),
    };
    const svc = new PayrollReadinessService(prisma, statutoryBootstrapReadiness as unknown as StatutoryBootstrapReadinessService);
    const r = await svc.getPayGroupReadiness('pg1');
    expect(r.canCreatePayrun).toBe(true);
    expect(r.blockingReasons).toHaveLength(0);
    expect(r.statutoryBootstrap?.operatorBootstrapComplete).toBe(true);
  });

  it('does not evaluate statutory bootstrap when pay group country is outside ZA/LS slice', async () => {
    const prisma = makePrismaGreenWorkforce() as any;
    prisma.payGroup.findUnique.mockResolvedValue({ ...payGroupBase, country: 'GB' as Country });
    const statutoryBootstrapReadiness = { evaluate: jest.fn() };
    const svc = new PayrollReadinessService(prisma, statutoryBootstrapReadiness as unknown as StatutoryBootstrapReadinessService);
    const r = await svc.getPayGroupReadiness('pg1');
    expect(statutoryBootstrapReadiness.evaluate).not.toHaveBeenCalled();
    expect(r.statutoryBootstrap).toBeUndefined();
  });
});
