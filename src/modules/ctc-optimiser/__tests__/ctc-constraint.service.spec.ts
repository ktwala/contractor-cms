import { CtcConstraintService } from '../services/ctc-constraint.service';
import { RunCtcOptimiserDto } from '../dto/run-ctc-optimiser.dto';
import { CtcScenarioBreakdown } from '../domain/ctc-optimiser.types';

describe('CtcConstraintService', () => {
  let service: CtcConstraintService;

  beforeEach(() => {
    service = new CtcConstraintService();
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
      constraints: {
        minBasicPercent: 55,
        maxAllowancePercent: 35,
        requireMedicalAidAsEmployerContribution: true,
        requireRetirementFund: true,
      },
      ...overrides,
    } as RunCtcOptimiserDto;
  }

  function makeScenario(overrides: Partial<CtcScenarioBreakdown> = {}): CtcScenarioBreakdown {
    return {
      basicSalary: 65000,
      travelAllowance: 10000,
      reimbursiveTravelNonTaxable: 5000,
      otherAllowanceTaxable: 2000,
      otherAllowanceNonTaxable: 0,
      medicalAidEmployerContribution: 10000,
      retirementContribution: 8000,
      ...overrides,
    };
  }

  it('returns PASS for a compliant scenario', () => {
    const result = service.validate(makeInput(), makeScenario());
    expect(result.status).not.toBe('BLOCK');
  });

  it('BLOCK: basic salary below minimum policy threshold', () => {
    const input = makeInput({ constraints: { ...makeInput().constraints, minBasicPercent: 70 } });
    const scenario = makeScenario({ basicSalary: 55000 });
    const result = service.validate(input, scenario);
    expect(result.status).toBe('BLOCK');
    expect(result.blocks.some((b) => b.includes('below minimum policy threshold'))).toBe(true);
  });

  it('BLOCK: allowance share exceeds maximum policy threshold', () => {
    const input = makeInput({ constraints: { ...makeInput().constraints, maxAllowancePercent: 10 } });
    const scenario = makeScenario({ travelAllowance: 20000 });
    const result = service.validate(input, scenario);
    expect(result.status).toBe('BLOCK');
    expect(result.blocks.some((b) => b.includes('exceeds maximum policy threshold'))).toBe(true);
  });

  it('BLOCK: travel allowance when travel disabled', () => {
    const input = makeInput({ travel: { enabled: false } });
    const scenario = makeScenario({ travelAllowance: 10000 });
    const result = service.validate(input, scenario);
    expect(result.status).toBe('BLOCK');
    expect(result.blocks.some((b) => b.includes('not permitted'))).toBe(true);
  });

  it('BLOCK: reimbursive when reimbursive disabled', () => {
    const input = makeInput({ reimbursive: { enabled: false } });
    const scenario = makeScenario({ reimbursiveTravelNonTaxable: 5000 });
    const result = service.validate(input, scenario);
    expect(result.status).toBe('BLOCK');
  });

  it('BLOCK: retirement required but zero', () => {
    const input = makeInput();
    const scenario = makeScenario({ retirementContribution: 0 });
    const result = service.validate(input, scenario);
    expect(result.status).toBe('BLOCK');
    expect(result.blocks.some((b) => b.includes('Retirement contribution is required'))).toBe(true);
  });

  it('BLOCK: medical aid employer contribution mismatch', () => {
    const input = makeInput();
    const scenario = makeScenario({ medicalAidEmployerContribution: 5000 });
    const result = service.validate(input, scenario);
    expect(result.status).toBe('BLOCK');
    expect(result.blocks.some((b) => b.includes('employer contribution'))).toBe(true);
  });

  it('WARN: travel allowance triggers logbook warning', () => {
    const input = makeInput({
      constraints: { minBasicPercent: 50, maxAllowancePercent: 50 },
    });
    const scenario = makeScenario();
    const result = service.validate(input, scenario);
    expect(result.warnings.some((w) => w.includes('logbook'))).toBe(true);
  });

  it('WARN: low retirement contribution', () => {
    const input = makeInput({
      constraints: {
        minBasicPercent: 50,
        maxAllowancePercent: 50,
        requireRetirementFund: false,
        requireMedicalAidAsEmployerContribution: false,
      },
    });
    const scenario = makeScenario({ retirementContribution: 3000, travelAllowance: 0, reimbursiveTravelNonTaxable: 0 });
    const result = service.validate(input, scenario);
    expect(result.warnings.some((w) => w.includes('relatively low'))).toBe(true);
  });
});
