import { CtcResponseMapper } from '../services/ctc-response.mapper';
import { CtcEvaluatedScenario } from '../domain/ctc-optimiser.types';

describe('CtcResponseMapper', () => {
  let mapper: CtcResponseMapper;

  beforeEach(() => {
    mapper = new CtcResponseMapper();
  });

  function makeRanked(
    netPay: number,
    retirement = 10000,
    status: 'PASS' | 'WARN' = 'PASS',
  ): CtcEvaluatedScenario {
    return {
      scenario: {
        basicSalary: 70000,
        travelAllowance: 10000,
        reimbursiveTravelNonTaxable: 0,
        otherAllowanceTaxable: 0,
        otherAllowanceNonTaxable: 0,
        medicalAidEmployerContribution: 10000,
        retirementContribution: retirement,
      },
      policy: { status, warnings: status === 'WARN' ? ['w'] : [], blocks: [] },
      evaluation: {
        taxableIncome: 80000,
        paye: 15000,
        uif: 177,
        netPay,
        grossEarnings: 100000,
        deductions: 20000,
        employerCost: 100000,
        engineOutput: {},
      },
      explanations: ['test explanation'],
      warnings: status === 'WARN' ? ['w'] : [],
      rank: 1,
      score: { netFitScore: 90, complianceScore: 100, policyScore: 100, sustainabilityScore: 80, simplicityScore: 90, totalScore: 92 },
    };
  }

  it('returns ON_TARGET when best net is within 2% of target', () => {
    const result = mapper.mapToAdvisoryResponse(
      'run-1', 'TARGET_NET', 100000, 70000,
      [makeRanked(69500)],
    );
    expect(result.summary.outcomeStatus).toBe('ON_TARGET');
    expect(result.summary.bestAchievedNet).toBe(69500);
    expect(result.summary.gapToTarget).toBe(-500);
  });

  it('returns CLOSE when best net is within 10%', () => {
    const result = mapper.mapToAdvisoryResponse(
      'run-2', 'TARGET_NET', 100000, 70000,
      [makeRanked(65000)],
    );
    expect(result.summary.outcomeStatus).toBe('CLOSE');
  });

  it('returns BELOW_TARGET when gap is large', () => {
    const result = mapper.mapToAdvisoryResponse(
      'run-3', 'TARGET_NET', 100000, 70000,
      [makeRanked(55000)],
    );
    expect(result.summary.outcomeStatus).toBe('BELOW_TARGET');
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('returns UNREACHABLE_UNDER_RULES when no valid results', () => {
    const result = mapper.mapToAdvisoryResponse(
      'run-4', 'TARGET_NET', 100000, 70000,
      [],
    );
    expect(result.summary.outcomeStatus).toBe('UNREACHABLE_UNDER_RULES');
    expect(result.recommendations.length).toBe(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('returns ON_TARGET for MAX_NET with valid results', () => {
    const result = mapper.mapToAdvisoryResponse(
      'run-5', 'MAX_NET', 100000, undefined,
      [makeRanked(75000)],
    );
    expect(result.summary.outcomeStatus).toBe('ON_TARGET');
    expect(result.summary.gapToTarget).toBeUndefined();
  });

  it('limits recommendations to 3', () => {
    const items = [makeRanked(70000), makeRanked(68000), makeRanked(66000), makeRanked(64000)];
    items.forEach((item, i) => { item.rank = i + 1; });
    const result = mapper.mapToAdvisoryResponse('run-6', 'MAX_NET', 100000, undefined, items);
    expect(result.recommendations.length).toBe(3);
  });

  it('assigns Recommended label to first item', () => {
    const result = mapper.mapToAdvisoryResponse(
      'run-7', 'TARGET_NET', 100000, 70000,
      [makeRanked(69000), makeRanked(67000, 15000)],
    );
    expect(result.recommendations[0].label).toBe('Recommended');
  });

  it('assigns Stronger Retirement label when retirement is higher', () => {
    const result = mapper.mapToAdvisoryResponse(
      'run-8', 'TARGET_NET', 100000, 70000,
      [makeRanked(69000, 8000), makeRanked(67000, 15000)],
    );
    expect(result.recommendations[1].label).toBe('Stronger Retirement');
  });

  it('maps payroll fields correctly', () => {
    const result = mapper.mapToAdvisoryResponse(
      'run-9', 'MAX_NET', 100000, undefined,
      [makeRanked(75000)],
    );
    const rec = result.recommendations[0];
    expect(rec.payroll.netPay).toBe(75000);
    expect(rec.payroll.paye).toBe(15000);
    expect(rec.payroll.uif).toBe(177);
    expect(rec.payroll.grossEarnings).toBe(100000);
    expect(rec.payroll.taxableIncome).toBe(80000);
  });

  it('includes trueDisposableIncome and disposableBreakdown on recommendations', () => {
    const result = mapper.mapToAdvisoryResponse(
      'run-tdi-1', 'MAX_NET', 100000, undefined,
      [makeRanked(75000)],
      'EMPLOYER_FUNDED', 10000,
    );
    const rec = result.recommendations[0];
    expect(rec.trueDisposableIncome).toBe(85000);
    expect(rec.disposableBreakdown.netPay).toBe(75000);
    expect(rec.disposableBreakdown.employerFundedBenefits).toBe(10000);
    expect(rec.disposableBreakdown.personalObligations).toBe(0);
  });

  it('maps breakdown fields correctly', () => {
    const result = mapper.mapToAdvisoryResponse(
      'run-10', 'MAX_NET', 100000, undefined,
      [makeRanked(75000)],
    );
    const b = result.recommendations[0].breakdown;
    expect(b.basicSalary).toBe(70000);
    expect(b.travelAllowance).toBe(10000);
    expect(b.medicalAidEmployerContribution).toBe(10000);
    expect(b.retirementContribution).toBe(10000);
  });

  it('includes suggestions for no-result scenario', () => {
    const result = mapper.mapToAdvisoryResponse('run-11', 'TARGET_NET', 100000, 70000, []);
    expect(result.suggestions.some((s) => s.includes('constraints'))).toBe(true);
  });

  describe('medical funding model in summary', () => {
    it('includes medicalFundingModel in summary', () => {
      const result = mapper.mapToAdvisoryResponse(
        'run-12', 'MAX_NET', 100000, undefined,
        [makeRanked(75000)],
        'EMPLOYER_FUNDED', 15000,
      );
      expect(result.summary.medicalFundingModel).toBe('EMPLOYER_FUNDED');
      expect(result.summary.medicalAmount).toBe(15000);
    });

    it('defaults to EMPLOYER_FUNDED when not specified', () => {
      const result = mapper.mapToAdvisoryResponse(
        'run-13', 'MAX_NET', 100000, undefined,
        [makeRanked(75000)],
      );
      expect(result.summary.medicalFundingModel).toBe('EMPLOYER_FUNDED');
      expect(result.summary.medicalAmount).toBe(0);
    });

    it('passes EMPLOYEE_PAID through to summary', () => {
      const result = mapper.mapToAdvisoryResponse(
        'run-14', 'TARGET_NET', 100000, 70000,
        [makeRanked(65000)],
        'EMPLOYEE_PAID', 12000,
      );
      expect(result.summary.medicalFundingModel).toBe('EMPLOYEE_PAID');
      expect(result.summary.medicalAmount).toBe(12000);
    });
  });

  describe('true disposable income (TDI)', () => {
    it('summary TDI adds employer-funded medical to best net', () => {
      const result = mapper.mapToAdvisoryResponse(
        'tdi-1', 'MAX_NET', 120000, undefined,
        [makeRanked(61000)],
        'EMPLOYER_FUNDED', 15000,
      );
      expect(result.summary.trueDisposableIncome).toBe(76000);
      expect(result.summary.disposableBreakdown.netPay).toBe(61000);
      expect(result.summary.disposableBreakdown.employerFundedBenefits).toBe(15000);
      expect(result.summary.disposableBreakdown.personalObligations).toBe(0);
    });

    it('summary TDI subtracts employee-paid medical from best net', () => {
      const result = mapper.mapToAdvisoryResponse(
        'tdi-2', 'MAX_NET', 120000, undefined,
        [makeRanked(80000)],
        'EMPLOYEE_PAID', 15000,
      );
      expect(result.summary.trueDisposableIncome).toBe(65000);
      expect(result.summary.disposableBreakdown.personalObligations).toBe(15000);
      expect(result.summary.disposableBreakdown.employerFundedBenefits).toBe(0);
    });

    it('each recommendation has its own TDI based on its net pay', () => {
      const items = [makeRanked(70000), makeRanked(65000)];
      items.forEach((item, i) => { item.rank = i + 1; });
      const result = mapper.mapToAdvisoryResponse(
        'tdi-3', 'MAX_NET', 120000, undefined,
        items,
        'EMPLOYER_FUNDED', 10000,
      );
      expect(result.recommendations[0].trueDisposableIncome).toBe(80000);
      expect(result.recommendations[1].trueDisposableIncome).toBe(75000);
    });

    it('zero medical yields TDI equal to net pay', () => {
      const result = mapper.mapToAdvisoryResponse(
        'tdi-4', 'BALANCED', 100000, undefined,
        [makeRanked(70000)],
        'EMPLOYER_FUNDED', 0,
      );
      expect(result.summary.trueDisposableIncome).toBe(70000);
      expect(result.recommendations[0].trueDisposableIncome).toBe(70000);
    });

    it('summary TDI uses the best net across all valid scenarios', () => {
      const items = [makeRanked(60000), makeRanked(65000)];
      items.forEach((item, i) => { item.rank = i + 1; });
      const result = mapper.mapToAdvisoryResponse(
        'tdi-5', 'MAX_NET', 120000, undefined,
        items,
        'EMPLOYER_FUNDED', 15000,
      );
      expect(result.summary.bestAchievedNet).toBe(65000);
      expect(result.summary.trueDisposableIncome).toBe(80000);
    });
  });
});
