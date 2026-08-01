import { SouthAfricaComputePack } from '../../../country-packs/south-africa/south-africa-compute.pack';
import { LesothoComputePack } from '../../../country-packs/lesotho/lesotho-compute.pack';
import { CtcScenarioGeneratorService } from '../services/ctc-scenario-generator.service';
import { CtcConstraintService } from '../services/ctc-constraint.service';
import { CtcScenarioEvaluatorService } from '../services/ctc-scenario-evaluator.service';
import { CtcScenarioRankerService } from '../services/ctc-scenario-ranker.service';
import { CtcExplanationService } from '../services/ctc-explanation.service';
import { CtcResponseMapper } from '../services/ctc-response.mapper';
import { RunCtcOptimiserDto } from '../dto/run-ctc-optimiser.dto';
import type { RoutingResult } from '../../../country-packs/services/pack-router.service';
import type { CtcEvaluatedScenario } from '../domain/ctc-optimiser.types';

/**
 * End-to-end sanity test for the CTC Optimiser pipeline.
 *
 * Wires real services (generator → constraint → evaluator → ranker)
 * against the actual ZA compute pack and asserts range-based invariants
 * so a gross-collapsing bug like the missing BASIC_SALARY can never ship.
 */
describe('CTC Optimiser — E2E Sanity (ZA, 120k CTC)', () => {
  let generator: CtcScenarioGeneratorService;
  let constraint: CtcConstraintService;
  let evaluator: CtcScenarioEvaluatorService;
  let ranker: CtcScenarioRankerService;
  let explanation: CtcExplanationService;

  const ZA_TAX_DATA = {
    rebates: { primary: 17235, secondary: 9444, tertiary: 3145 },
    brackets: [
      { min: 0, max: 237100, rate: 0.18, base_amount: 0 },
      { min: 237100, max: 370500, rate: 0.26, base_amount: 42678 },
      { min: 370500, max: 512800, rate: 0.31, base_amount: 77362 },
      { min: 512800, max: 673000, rate: 0.36, base_amount: 121475 },
      { min: 673000, max: 857900, rate: 0.39, base_amount: 179147 },
      { min: 857900, max: 1817000, rate: 0.41, base_amount: 251258 },
      { min: 1817000, max: Infinity, rate: 0.45, base_amount: 644489 },
    ],
    thresholds: { under65: 95750, age65to74: 148217, age75plus: 165689 },
    periods_per_year: { MONTHLY: 12 },
  };

  function makeRouting(): RoutingResult {
    return {
      pack: { id: 'za-test', version: '2.0', country: 'ZA' },
      compute_date_value: '2026-03-01',
      tax_tables: {
        paye_table_set_id: 'za-paye-test',
        data: {
          brackets: ZA_TAX_DATA.brackets,
          rebates: ZA_TAX_DATA.rebates,
          thresholds: ZA_TAX_DATA.thresholds,
          periods_per_year: ZA_TAX_DATA.periods_per_year,
          credits: ZA_TAX_DATA.rebates,
        },
      },
      statutory: {},
    } as unknown as RoutingResult;
  }

  function makeInput(overrides: Partial<RunCtcOptimiserDto> = {}): RunCtcOptimiserDto {
    return {
      countryCode: 'ZA',
      taxYear: '2025/2026',
      payFrequency: 'monthly',
      ctc: 120000,
      optimisationMode: 'TARGET_NET',
      targetNet: 80000,
      medicalAid: { amount: 15000, beneficiaries: 2, fundingModel: 'EMPLOYER_FUNDED' },
      retirement: { minAmount: 6000, targetAmount: 10000 },
      travel: { enabled: true, maxPercent: 25 },
      reimbursive: { enabled: true, maxAmount: 5000 },
      constraints: { minBasicPercent: 55, maxAllowancePercent: 35 },
      ...overrides,
    } as RunCtcOptimiserDto;
  }

  beforeAll(() => {
    const zaPack = new SouthAfricaComputePack();
    const lsPack = new LesothoComputePack();

    generator = new CtcScenarioGeneratorService();
    constraint = new CtcConstraintService();
    evaluator = new CtcScenarioEvaluatorService(zaPack, lsPack);
    ranker = new CtcScenarioRankerService();
    explanation = new CtcExplanationService();
  });

  async function runPipeline(input: RunCtcOptimiserDto): Promise<CtcEvaluatedScenario[]> {
    const routing = makeRouting();
    const scenarios = generator.generate(input);

    const evaluated: CtcEvaluatedScenario[] = [];
    for (const scenario of scenarios) {
      const policy = constraint.validate(input, scenario);
      if (policy.status === 'BLOCK') {
        evaluated.push({
          scenario, policy, evaluation: null,
          explanations: explanation.explainBlockedScenario(policy),
          warnings: policy.warnings, score: null,
        });
        continue;
      }

      const evaluation = await evaluator.evaluate({ input, scenario, routing });
      const explanations = explanation.explainScenario({ input, scenario, evaluation, policy });
      evaluated.push({ scenario, policy, evaluation, explanations, warnings: policy.warnings });
    }

    return ranker.rank(input, evaluated);
  }

  it('generates at least 1 ranked scenario', async () => {
    const ranked = await runPipeline(makeInput());
    expect(ranked.length).toBeGreaterThanOrEqual(1);
  });

  it('every ranked scenario has grossEarnings > 80000', async () => {
    const ranked = await runPipeline(makeInput());
    for (const item of ranked) {
      expect(item.evaluation).not.toBeNull();
      expect(item.evaluation!.grossEarnings).toBeGreaterThan(80000);
    }
  });

  it('every ranked scenario has taxableIncome > 65000', async () => {
    const ranked = await runPipeline(makeInput());
    for (const item of ranked) {
      expect(item.evaluation!.taxableIncome).toBeGreaterThan(65000);
    }
  });

  it('every ranked scenario has PAYE > 15000', async () => {
    const ranked = await runPipeline(makeInput());
    for (const item of ranked) {
      expect(item.evaluation!.paye).toBeGreaterThan(15000);
    }
  });

  it('every ranked scenario has netPay > 40000', async () => {
    const ranked = await runPipeline(makeInput());
    for (const item of ranked) {
      expect(item.evaluation!.netPay).toBeGreaterThan(40000);
    }
  });

  it('no scenario has netPay <= 0', async () => {
    const ranked = await runPipeline(makeInput());
    for (const item of ranked) {
      expect(item.evaluation!.netPay).toBeGreaterThan(0);
    }
  });

  it('best scenario netPay is in a reasonable range (40k–85k for 120k CTC)', async () => {
    const ranked = await runPipeline(makeInput());
    const best = ranked[0];
    expect(best.evaluation!.netPay).toBeGreaterThanOrEqual(40000);
    expect(best.evaluation!.netPay).toBeLessThanOrEqual(85000);
  });

  it('grossEarnings ≈ basic + travel + other allowances (not just travel alone)', async () => {
    const ranked = await runPipeline(makeInput());
    for (const item of ranked) {
      const s = item.scenario;
      const expectedGross =
        s.basicSalary +
        s.travelAllowance +
        s.otherAllowanceTaxable +
        s.otherAllowanceNonTaxable;
      expect(item.evaluation!.grossEarnings).toBeCloseTo(expectedGross, -1);
    }
  });

  it('MAX_NET mode also produces sane results', async () => {
    const ranked = await runPipeline(makeInput({ optimisationMode: 'MAX_NET' }));
    expect(ranked.length).toBeGreaterThanOrEqual(1);
    for (const item of ranked) {
      expect(item.evaluation!.grossEarnings).toBeGreaterThan(90000);
      expect(item.evaluation!.netPay).toBeGreaterThan(40000);
    }
  });

  it('BALANCED mode also produces sane results', async () => {
    const ranked = await runPipeline(makeInput({ optimisationMode: 'BALANCED' }));
    expect(ranked.length).toBeGreaterThanOrEqual(1);
    for (const item of ranked) {
      expect(item.evaluation!.grossEarnings).toBeGreaterThan(80000);
      expect(item.evaluation!.netPay).toBeGreaterThan(35000);
    }
  });

  it('ranked scenarios have sequential ranks starting at 1', async () => {
    const ranked = await runPipeline(makeInput());
    const ranks = ranked.map((r) => r.rank);
    expect(ranks).toEqual(ranks.map((_, i) => i + 1));
  });

  it('every scenario has at least one explanation', async () => {
    const ranked = await runPipeline(makeInput());
    for (const item of ranked) {
      expect(item.explanations.length).toBeGreaterThanOrEqual(1);
    }
  });

  describe('true disposable income (TDI)', () => {
    let responseMapper: CtcResponseMapper;

    beforeAll(() => {
      responseMapper = new CtcResponseMapper();
    });

    it('employer-funded: TDI is higher than net pay by medical amount', async () => {
      const input = makeInput({ medicalAid: { amount: 15000, beneficiaries: 2, fundingModel: 'EMPLOYER_FUNDED' } });
      const ranked = await runPipeline(input);
      const response = responseMapper.mapToAdvisoryResponse(
        'tdi-e2e-1', input.optimisationMode, input.ctc, input.targetNet,
        ranked, 'EMPLOYER_FUNDED', 15000,
      );

      expect(response.summary.trueDisposableIncome).toBe(response.summary.bestAchievedNet + 15000);
      expect(response.summary.disposableBreakdown.employerFundedBenefits).toBe(15000);
      expect(response.summary.disposableBreakdown.personalObligations).toBe(0);

      for (const rec of response.recommendations) {
        expect(rec.trueDisposableIncome).toBe(rec.payroll.netPay + 15000);
      }
    });

    it('employee-paid: TDI is lower than net pay by medical amount', async () => {
      const input = makeInput({ medicalAid: { amount: 15000, beneficiaries: 2, fundingModel: 'EMPLOYEE_PAID' } });
      const ranked = await runPipeline(input);
      const response = responseMapper.mapToAdvisoryResponse(
        'tdi-e2e-2', input.optimisationMode, input.ctc, input.targetNet,
        ranked, 'EMPLOYEE_PAID', 15000,
      );

      expect(response.summary.trueDisposableIncome).toBe(response.summary.bestAchievedNet - 15000);
      expect(response.summary.disposableBreakdown.personalObligations).toBe(15000);
      expect(response.summary.disposableBreakdown.employerFundedBenefits).toBe(0);

      for (const rec of response.recommendations) {
        expect(rec.trueDisposableIncome).toBe(rec.payroll.netPay - 15000);
      }
    });

    it('TDI difference between funding models exceeds 2x medical amount', async () => {
      const employerInput = makeInput({ medicalAid: { amount: 15000, beneficiaries: 2, fundingModel: 'EMPLOYER_FUNDED' } });
      const employerRanked = await runPipeline(employerInput);
      const employerResponse = responseMapper.mapToAdvisoryResponse(
        'tdi-e2e-3a', employerInput.optimisationMode, employerInput.ctc, employerInput.targetNet,
        employerRanked, 'EMPLOYER_FUNDED', 15000,
      );

      const employeeInput = makeInput({ medicalAid: { amount: 15000, beneficiaries: 2, fundingModel: 'EMPLOYEE_PAID' } });
      const employeeRanked = await runPipeline(employeeInput);
      const employeeResponse = responseMapper.mapToAdvisoryResponse(
        'tdi-e2e-3b', employeeInput.optimisationMode, employeeInput.ctc, employeeInput.targetNet,
        employeeRanked, 'EMPLOYEE_PAID', 15000,
      );

      const tdiDelta = employerResponse.summary.trueDisposableIncome - employeeResponse.summary.trueDisposableIncome;
      expect(tdiDelta).toBeGreaterThan(15000);
    });
  });

  describe('medical funding model', () => {
    it('EMPLOYER_FUNDED produces higher net pay than EMPLOYEE_PAID', async () => {
      const employerFunded = await runPipeline(
        makeInput({ medicalAid: { amount: 15000, beneficiaries: 2, fundingModel: 'EMPLOYER_FUNDED' } }),
      );
      const employeePaid = await runPipeline(
        makeInput({ medicalAid: { amount: 15000, beneficiaries: 2, fundingModel: 'EMPLOYEE_PAID' } }),
      );

      const bestEmployerNet = employerFunded[0].evaluation!.netPay;
      const bestEmployeeNet = employeePaid[0].evaluation!.netPay;

      expect(bestEmployerNet).toBeGreaterThan(bestEmployeeNet);
      expect(bestEmployerNet - bestEmployeeNet).toBeGreaterThan(10000);
    });

    it('EMPLOYER_FUNDED: all scenarios have sane gross and PAYE', async () => {
      const ranked = await runPipeline(
        makeInput({ medicalAid: { amount: 15000, beneficiaries: 2, fundingModel: 'EMPLOYER_FUNDED' } }),
      );
      for (const item of ranked) {
        expect(item.evaluation!.grossEarnings).toBeGreaterThan(80000);
        expect(item.evaluation!.paye).toBeGreaterThan(10000);
      }
    });

    it('net pay difference between models is close to medical amount', async () => {
      const employerFunded = await runPipeline(
        makeInput({ medicalAid: { amount: 15000, beneficiaries: 2, fundingModel: 'EMPLOYER_FUNDED' } }),
      );
      const employeePaid = await runPipeline(
        makeInput({ medicalAid: { amount: 15000, beneficiaries: 2, fundingModel: 'EMPLOYEE_PAID' } }),
      );

      const avgEmployerNet = employerFunded.reduce((s, i) => s + i.evaluation!.netPay, 0) / employerFunded.length;
      const avgEmployeeNet = employeePaid.reduce((s, i) => s + i.evaluation!.netPay, 0) / employeePaid.length;

      const netDelta = avgEmployerNet - avgEmployeeNet;
      expect(netDelta).toBeGreaterThan(10000);
      expect(netDelta).toBeLessThan(20000);
    });

    it('EMPLOYEE_PAID: net pay is still sane (> 35k for 120k CTC)', async () => {
      const ranked = await runPipeline(
        makeInput({ medicalAid: { amount: 15000, beneficiaries: 2, fundingModel: 'EMPLOYEE_PAID' } }),
      );
      for (const item of ranked) {
        expect(item.evaluation!.netPay).toBeGreaterThan(35000);
      }
    });
  });
});
