import { CtcExplanationService } from '../services/ctc-explanation.service';
import { RunCtcOptimiserDto } from '../dto/run-ctc-optimiser.dto';
import {
  CtcScenarioBreakdown,
  CtcScenarioEvaluation,
  CtcConstraintResult,
} from '../domain/ctc-optimiser.types';

describe('CtcExplanationService', () => {
  let service: CtcExplanationService;

  beforeEach(() => {
    service = new CtcExplanationService();
  });

  function makeInput(overrides: Partial<RunCtcOptimiserDto> = {}): RunCtcOptimiserDto {
    return {
      countryCode: 'ZA',
      taxYear: '2025/2026',
      payFrequency: 'monthly',
      ctc: 100000,
      optimisationMode: 'TARGET_NET',
      targetNet: 70000,
      medicalAid: { amount: 10000, beneficiaries: 2 },
      retirement: { minAmount: 5000, targetAmount: 8000 },
      travel: { enabled: true, maxPercent: 25 },
      reimbursive: { enabled: true, maxAmount: 5000 },
      constraints: { minBasicPercent: 55, maxAllowancePercent: 35 },
      ...overrides,
    } as RunCtcOptimiserDto;
  }

  const baseScenario: CtcScenarioBreakdown = {
    basicSalary: 65000,
    travelAllowance: 10000,
    reimbursiveTravelNonTaxable: 0,
    otherAllowanceTaxable: 0,
    otherAllowanceNonTaxable: 0,
    medicalAidEmployerContribution: 10000,
    retirementContribution: 8000,
  };

  const baseEval: CtcScenarioEvaluation = {
    taxableIncome: 75000,
    paye: 15000,
    uif: 177,
    netPay: 69500,
    grossEarnings: 80000,
    deductions: 10000,
    employerCost: 100000,
    engineOutput: {},
  };

  const passPolicy: CtcConstraintResult = { status: 'PASS', warnings: [], blocks: [] };
  const warnPolicy: CtcConstraintResult = { status: 'WARN', warnings: ['test warning'], blocks: [] };

  it('always includes estimated net pay', () => {
    const result = service.explainScenario({
      input: makeInput(),
      scenario: baseScenario,
      evaluation: baseEval,
      policy: passPolicy,
    });
    expect(result.some((r) => r.includes('Estimated net pay'))).toBe(true);
  });

  it('includes travel explanation when travel allowance > 0', () => {
    const result = service.explainScenario({
      input: makeInput(),
      scenario: baseScenario,
      evaluation: baseEval,
      policy: passPolicy,
    });
    expect(result.some((r) => r.includes('travel allowance'))).toBe(true);
  });

  it('includes employer-funded TDI explanation when medical is employer-funded', () => {
    const result = service.explainScenario({
      input: makeInput({ medicalAid: { amount: 10000, beneficiaries: 2, fundingModel: 'EMPLOYER_FUNDED' } as any }),
      scenario: baseScenario,
      evaluation: baseEval,
      policy: passPolicy,
    });
    expect(result.some((r) => r.includes('True Disposable includes employer-funded medical'))).toBe(true);
  });

  it('includes personal-obligation explanation when medical is employee-paid', () => {
    const result = service.explainScenario({
      input: makeInput({ medicalAid: { amount: 10000, beneficiaries: 2, fundingModel: 'EMPLOYEE_PAID' } as any }),
      scenario: baseScenario,
      evaluation: baseEval,
      policy: passPolicy,
    });
    expect(result.some((r) => r.includes('medical remains your personal obligation'))).toBe(true);
  });

  it('defaults to employer-funded explanation when funding model is not set', () => {
    const result = service.explainScenario({
      input: makeInput(),
      scenario: baseScenario,
      evaluation: baseEval,
      policy: passPolicy,
    });
    expect(result.some((r) => r.includes('True Disposable includes employer-funded medical'))).toBe(true);
  });

  it('includes retirement explanation when contribution > 0', () => {
    const result = service.explainScenario({
      input: makeInput(),
      scenario: baseScenario,
      evaluation: baseEval,
      policy: passPolicy,
    });
    expect(result.some((r) => r.includes('Retirement'))).toBe(true);
  });

  it('includes warning notice for WARN policy', () => {
    const result = service.explainScenario({
      input: makeInput(),
      scenario: baseScenario,
      evaluation: baseEval,
      policy: warnPolicy,
    });
    expect(result.some((r) => r.includes('warnings that should be reviewed'))).toBe(true);
  });

  it('includes target-net proximity explanation in TARGET_NET mode', () => {
    const result = service.explainScenario({
      input: makeInput({ optimisationMode: 'TARGET_NET', targetNet: 70000 }),
      scenario: baseScenario,
      evaluation: { ...baseEval, netPay: 70000 },
      policy: passPolicy,
    });
    expect(result.some((r) => r.includes('very close'))).toBe(true);
  });

  it('includes materially-below explanation when target is missed by more than 5000', () => {
    const result = service.explainScenario({
      input: makeInput({ optimisationMode: 'TARGET_NET', targetNet: 70000 }),
      scenario: baseScenario,
      evaluation: { ...baseEval, netPay: 55000 },
      policy: passPolicy,
    });
    expect(result.some((r) => r.includes('materially below'))).toBe(true);
  });

  it('uses falls-below message for small misses (1001-5000 gap)', () => {
    const result = service.explainScenario({
      input: makeInput({ optimisationMode: 'TARGET_NET', targetNet: 70000 }),
      scenario: baseScenario,
      evaluation: { ...baseEval, netPay: 66000 },
      policy: passPolicy,
    });
    expect(result.some((r) => r.includes('falls below'))).toBe(true);
    expect(result.some((r) => r.includes('materially below'))).toBe(false);
  });

  it('explains blocked scenario with block reasons', () => {
    const blockPolicy: CtcConstraintResult = {
      status: 'BLOCK',
      warnings: [],
      blocks: ['Basic too low', 'Travel not allowed'],
    };
    const result = service.explainBlockedScenario(blockPolicy);
    expect(result[0]).toContain('blocked by policy');
    expect(result).toContain('Basic too low');
    expect(result).toContain('Travel not allowed');
  });
});
