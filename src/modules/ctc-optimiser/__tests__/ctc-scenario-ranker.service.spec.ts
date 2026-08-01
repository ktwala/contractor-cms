import { CtcScenarioRankerService } from '../services/ctc-scenario-ranker.service';
import { RunCtcOptimiserDto } from '../dto/run-ctc-optimiser.dto';
import { CtcEvaluatedScenario } from '../domain/ctc-optimiser.types';

describe('CtcScenarioRankerService', () => {
  let ranker: CtcScenarioRankerService;

  beforeEach(() => {
    ranker = new CtcScenarioRankerService();
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

  function makeEvaluated(
    netPay: number,
    overrides: Partial<{
      status: 'PASS' | 'WARN' | 'BLOCK';
      retirement: number;
      otherTaxable: number;
      paye: number;
      taxableIncome: number;
      warnings: string[];
    }> = {},
  ): CtcEvaluatedScenario {
    return {
      scenario: {
        basicSalary: 60000,
        travelAllowance: 10000,
        reimbursiveTravelNonTaxable: 0,
        otherAllowanceTaxable: overrides.otherTaxable ?? 0,
        otherAllowanceNonTaxable: 0,
        medicalAidEmployerContribution: 10000,
        retirementContribution: overrides.retirement ?? 10000,
      },
      policy: { status: overrides.status ?? 'PASS', warnings: [], blocks: [] },
      evaluation: {
        taxableIncome: overrides.taxableIncome ?? 70000,
        paye: overrides.paye ?? 15000,
        uif: 177,
        netPay,
        grossEarnings: 80000,
        deductions: 10000,
        employerCost: 100000,
        engineOutput: {},
      },
      explanations: [],
      warnings: overrides.warnings ?? [],
    };
  }

  it('ranks higher net pay above lower in TARGET_NET mode', () => {
    const input = makeInput({ optimisationMode: 'TARGET_NET', targetNet: 70000 });
    const items = [makeEvaluated(65000), makeEvaluated(70000), makeEvaluated(60000)];
    const ranked = ranker.rank(input, items);
    expect(ranked[0].evaluation!.netPay).toBe(70000);
    expect(ranked[0].rank).toBe(1);
  });

  it('discards scenarios with netPay <= 0', () => {
    const input = makeInput();
    const items = [makeEvaluated(0), makeEvaluated(-5000), makeEvaluated(65000)];
    const ranked = ranker.rank(input, items);
    expect(ranked.length).toBe(1);
    expect(ranked[0].evaluation!.netPay).toBe(65000);
  });

  it('discards target-net scenarios below 60% of target', () => {
    const input = makeInput({ optimisationMode: 'TARGET_NET', targetNet: 70000 });
    const items = [
      makeEvaluated(30000),
      makeEvaluated(40000),
      makeEvaluated(65000),
    ];
    const ranked = ranker.rank(input, items);
    expect(ranked.every((r) => r.evaluation!.netPay >= 70000 * 0.60)).toBe(true);
  });

  it('discards blocked scenarios', () => {
    const input = makeInput();
    const blocked = makeEvaluated(65000, { status: 'BLOCK' });
    const valid = makeEvaluated(65000);
    const ranked = ranker.rank(input, [blocked, valid]);
    expect(ranked.length).toBe(1);
    expect(ranked[0].policy.status).toBe('PASS');
  });

  it('discards scenarios with no evaluation', () => {
    const input = makeInput();
    const noEval: CtcEvaluatedScenario = {
      scenario: makeEvaluated(0).scenario,
      policy: { status: 'PASS', warnings: [], blocks: [] },
      evaluation: null,
      explanations: [],
      warnings: [],
    };
    const ranked = ranker.rank(input, [noEval, makeEvaluated(65000)]);
    expect(ranked.length).toBe(1);
    expect(ranked[0].evaluation!.netPay).toBe(65000);
  });

  it('keeps only top 5 results', () => {
    const input = makeInput({ optimisationMode: 'MAX_NET' });
    const items = Array.from({ length: 10 }, (_, i) =>
      makeEvaluated(50000 + i * 1000, { retirement: 5000 + i * 500 }),
    );
    const ranked = ranker.rank(input, items);
    expect(ranked.length).toBeLessThanOrEqual(5);
  });

  it('removes dominated scenarios', () => {
    const input = makeInput({ optimisationMode: 'MAX_NET' });
    const dominator = makeEvaluated(75000, { paye: 12000, retirement: 10000 });
    const dominated = makeEvaluated(70000, { paye: 15000, retirement: 8000, warnings: ['w1'] });
    const ranked = ranker.rank(input, [dominated, dominator]);
    expect(ranked.length).toBe(1);
    expect(ranked[0].evaluation!.netPay).toBe(75000);
  });

  it('checksum is stable for the same input', () => {
    const input = makeInput();
    const items = [makeEvaluated(65000)];
    const ranked1 = ranker.rank(input, items);
    const ranked2 = ranker.rank(input, items);
    expect(ranked1[0].checksum).toBe(ranked2[0].checksum);
    expect(ranked1[0].checksum).toBeTruthy();
  });

  it('MAX_NET mode rewards higher net pay', () => {
    const input = makeInput({ optimisationMode: 'MAX_NET' });
    const items = [makeEvaluated(50000), makeEvaluated(75000)];
    const ranked = ranker.rank(input, items);
    expect(ranked[0].evaluation!.netPay).toBe(75000);
  });

  it('assigns sequential rank numbers starting at 1', () => {
    const input = makeInput({ optimisationMode: 'MAX_NET' });
    const ranked = ranker.rank(input, [
      makeEvaluated(65000, { retirement: 8000 }),
      makeEvaluated(70000, { retirement: 10000 }),
      makeEvaluated(60000, { retirement: 6000 }),
    ]);
    const ranks = ranked.map((r) => r.rank);
    expect(ranks).toEqual(ranks.map((_, i) => i + 1));
  });

  it('netFitScore gives 100 for TARGET_NET within 2% of target', () => {
    const input = makeInput({ optimisationMode: 'TARGET_NET', targetNet: 70000 });
    const items = [makeEvaluated(70500)];
    const ranked = ranker.rank(input, items);
    expect(ranked[0].score!.netFitScore).toBe(100);
  });

  it('penalises high filler ratio via simplicityScore', () => {
    const input = makeInput({ optimisationMode: 'MAX_NET' });
    const lowFiller = makeEvaluated(65000, { otherTaxable: 1000 });
    const highFiller = makeEvaluated(65000, { otherTaxable: 9000 });
    const ranked = ranker.rank(input, [highFiller, lowFiller]);
    const lowFillerResult = ranked.find((r) => r.scenario.otherAllowanceTaxable === 1000);
    const highFillerResult = ranked.find((r) => r.scenario.otherAllowanceTaxable === 9000);
    if (lowFillerResult && highFillerResult) {
      expect(lowFillerResult.score!.simplicityScore).toBeGreaterThan(highFillerResult.score!.simplicityScore);
    }
  });
});
