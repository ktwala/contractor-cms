import { CtcScenarioGeneratorService } from '../services/ctc-scenario-generator.service';
import { RunCtcOptimiserDto } from '../dto/run-ctc-optimiser.dto';

describe('CtcScenarioGeneratorService', () => {
  let generator: CtcScenarioGeneratorService;

  beforeEach(() => {
    generator = new CtcScenarioGeneratorService();
  });

  function makeInput(overrides: Partial<RunCtcOptimiserDto> = {}): RunCtcOptimiserDto {
    return {
      countryCode: 'ZA',
      taxYear: '2025/2026',
      payFrequency: 'monthly',
      ctc: 120000,
      optimisationMode: 'TARGET_NET',
      targetNet: 80000,
      medicalAid: { amount: 15000, beneficiaries: 2 },
      retirement: { minAmount: 5000, targetAmount: 10000 },
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

  it('generates between 1 and 40 scenarios', () => {
    const scenarios = generator.generate(makeInput());
    expect(scenarios.length).toBeGreaterThanOrEqual(1);
    expect(scenarios.length).toBeLessThanOrEqual(40);
  });

  it('every scenario sums to at most CTC', () => {
    const input = makeInput();
    const scenarios = generator.generate(input);
    for (const s of scenarios) {
      const total =
        s.basicSalary +
        s.travelAllowance +
        s.reimbursiveTravelNonTaxable +
        s.otherAllowanceTaxable +
        s.otherAllowanceNonTaxable +
        s.medicalAidEmployerContribution +
        s.retirementContribution;
      expect(total).toBeLessThanOrEqual(input.ctc);
    }
  });

  it('respects travel disabled — no travel allowance in any scenario', () => {
    const input = makeInput({ travel: { enabled: false } });
    const scenarios = generator.generate(input);
    for (const s of scenarios) {
      expect(s.travelAllowance).toBe(0);
    }
  });

  it('respects reimbursive disabled — no reimbursive in any scenario', () => {
    const input = makeInput({ reimbursive: { enabled: false } });
    const scenarios = generator.generate(input);
    for (const s of scenarios) {
      expect(s.reimbursiveTravelNonTaxable).toBe(0);
    }
  });

  it('produces no duplicates', () => {
    const scenarios = generator.generate(makeInput());
    const keys = scenarios.map((s) => JSON.stringify(s));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('basic salary is never below minBasicPercent', () => {
    const input = makeInput({ constraints: { ...makeInput().constraints, minBasicPercent: 65 } });
    const scenarios = generator.generate(input);
    for (const s of scenarios) {
      const basicPercent = (s.basicSalary / input.ctc) * 100;
      expect(basicPercent).toBeGreaterThanOrEqual(64.9);
    }
  });

  it('rejects scenarios where taxable filler exceeds 10% of CTC', () => {
    const input = makeInput();
    const scenarios = generator.generate(input);
    for (const s of scenarios) {
      expect(s.otherAllowanceTaxable).toBeLessThanOrEqual(input.ctc * 0.10);
    }
  });

  it('returns multiple reimbursive candidates, not always max', () => {
    const input = makeInput({
      reimbursive: { enabled: true, maxAmount: 5000 },
    });
    const scenarios = generator.generate(input);
    const reimbursiveValues = new Set(scenarios.map((s) => s.reimbursiveTravelNonTaxable));
    expect(reimbursiveValues.size).toBeGreaterThan(1);
  });

  it('returns diversified seeds for TARGET_NET', () => {
    const input = makeInput({
      optimisationMode: 'TARGET_NET',
      ctc: 200000,
      medicalAid: { amount: 5000, beneficiaries: 1 },
      retirement: { minAmount: 2000, targetAmount: 5000 },
      constraints: { minBasicPercent: 50, maxAllowancePercent: 45 },
    });
    const scenarios = generator.generate(input);
    const basicValues = new Set(scenarios.map((s) => s.basicSalary));
    expect(basicValues.size).toBeGreaterThanOrEqual(3);
  });

  it('uses different seeds for MAX_NET vs BALANCED', () => {
    const maxNetScenarios = generator.generate(makeInput({ optimisationMode: 'MAX_NET' }));
    const balancedScenarios = generator.generate(makeInput({ optimisationMode: 'BALANCED' }));
    const maxNetBasicAvg = maxNetScenarios.reduce((sum, s) => sum + s.basicSalary, 0) / maxNetScenarios.length;
    const balancedBasicAvg = balancedScenarios.reduce((sum, s) => sum + s.basicSalary, 0) / balancedScenarios.length;
    expect(maxNetBasicAvg).not.toBe(balancedBasicAvg);
  });

  it('allowance share never exceeds maxAllowancePercent', () => {
    const input = makeInput({ constraints: { ...makeInput().constraints, maxAllowancePercent: 30 } });
    const scenarios = generator.generate(input);
    for (const s of scenarios) {
      const allowanceShare = (s.travelAllowance + s.reimbursiveTravelNonTaxable + s.otherAllowanceTaxable + s.otherAllowanceNonTaxable) / input.ctc;
      expect(allowanceShare).toBeLessThanOrEqual(0.301);
    }
  });
});
