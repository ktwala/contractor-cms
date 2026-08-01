import { CtcScenarioEvaluatorService } from '../services/ctc-scenario-evaluator.service';
import { CtcScenarioBreakdown, MedicalFundingModel } from '../domain/ctc-optimiser.types';

type EvaluatorWithPrivate = CtcScenarioEvaluatorService & {
  scenarioToPayItems(scenario: CtcScenarioBreakdown, medicalFundingModel?: MedicalFundingModel): Array<{
    code: string;
    type: string;
    amount: number;
    is_taxable: boolean;
    classification: string;
  }>;
  assertPayItemContract(scenario: CtcScenarioBreakdown, items: any[]): void;
};

function buildEvaluator(): EvaluatorWithPrivate {
  const fakeZaPack = {} as any;
  const fakeLsPack = {} as any;
  return new CtcScenarioEvaluatorService(fakeZaPack, fakeLsPack) as EvaluatorWithPrivate;
}

function makeScenario(overrides: Partial<CtcScenarioBreakdown> = {}): CtcScenarioBreakdown {
  return {
    basicSalary: 72000,
    travelAllowance: 14400,
    reimbursiveTravelNonTaxable: 0,
    otherAllowanceTaxable: 12600,
    otherAllowanceNonTaxable: 0,
    medicalAidEmployerContribution: 15000,
    retirementContribution: 6000,
    ...overrides,
  };
}

describe('CtcScenarioEvaluatorService', () => {
  let evaluator: EvaluatorWithPrivate;

  beforeEach(() => {
    evaluator = buildEvaluator();
  });

  describe('scenarioToPayItems — pay item contract', () => {
    it('includes BASIC_SALARY as a taxable earning when basicSalary > 0', () => {
      const items = evaluator['scenarioToPayItems'](makeScenario());
      const basic = items.find((i) => i.code === 'BASIC_SALARY');

      expect(basic).toBeDefined();
      expect(basic!.type).toBe('EARNING');
      expect(basic!.amount).toBe(72000);
      expect(basic!.is_taxable).toBe(true);
      expect(basic!.classification).toBe('BASIC_SALARY');
    });

    it('omits BASIC_SALARY when basicSalary is 0', () => {
      const items = evaluator['scenarioToPayItems'](makeScenario({ basicSalary: 0 }));
      const basic = items.find((i) => i.code === 'BASIC_SALARY');
      expect(basic).toBeUndefined();
    });

    it('includes TRAVEL_ALLOWANCE when travelAllowance > 0', () => {
      const items = evaluator['scenarioToPayItems'](makeScenario());
      const travel = items.find((i) => i.code === 'TRAVEL_ALLOWANCE');

      expect(travel).toBeDefined();
      expect(travel!.type).toBe('EARNING');
      expect(travel!.amount).toBe(14400);
      expect(travel!.is_taxable).toBe(true);
    });

    it('includes RETIREMENT_FUND as a deduction', () => {
      const items = evaluator['scenarioToPayItems'](makeScenario());
      const retirement = items.find((i) => i.code === 'RETIREMENT_FUND');

      expect(retirement).toBeDefined();
      expect(retirement!.type).toBe('DEDUCTION');
      expect(retirement!.amount).toBe(6000);
    });

    it('total earnings in pay items covers basic + allowances (full gross)', () => {
      const scenario = makeScenario();
      const items = evaluator['scenarioToPayItems'](scenario);
      const totalEarnings = items
        .filter((i) => i.type === 'EARNING')
        .reduce((sum, i) => sum + i.amount, 0);

      const expectedGross =
        scenario.basicSalary +
        scenario.travelAllowance +
        scenario.otherAllowanceTaxable +
        scenario.otherAllowanceNonTaxable;

      expect(totalEarnings).toBe(expectedGross);
    });

    it('regression: a 120k CTC scenario produces earnings >> travel alone', () => {
      const scenario = makeScenario({
        basicSalary: 72000,
        travelAllowance: 14400,
        otherAllowanceTaxable: 12600,
      });
      const items = evaluator['scenarioToPayItems'](scenario);
      const totalEarnings = items
        .filter((i) => i.type === 'EARNING')
        .reduce((sum, i) => sum + i.amount, 0);

      expect(totalEarnings).toBe(99000);
      expect(totalEarnings).toBeGreaterThan(14400);
    });
  });

  describe('medical funding model', () => {
    it('EMPLOYER_FUNDED: excludes medical from pay items (not deducted from net)', () => {
      const items = evaluator['scenarioToPayItems'](makeScenario(), 'EMPLOYER_FUNDED');
      const medical = items.find((i) => i.code === 'MEDICAL_AID_CONTRIBUTION');
      expect(medical).toBeUndefined();
    });

    it('EMPLOYEE_PAID: includes medical as DEDUCTION (deducted from net)', () => {
      const items = evaluator['scenarioToPayItems'](makeScenario(), 'EMPLOYEE_PAID');
      const medical = items.find((i) => i.code === 'MEDICAL_AID_CONTRIBUTION');

      expect(medical).toBeDefined();
      expect(medical!.type).toBe('DEDUCTION');
      expect(medical!.amount).toBe(15000);
    });

    it('defaults to EMPLOYER_FUNDED when no model specified', () => {
      const items = evaluator['scenarioToPayItems'](makeScenario());
      const medical = items.find((i) => i.code === 'MEDICAL_AID_CONTRIBUTION');
      expect(medical).toBeUndefined();
    });

    it('EMPLOYER_FUNDED: retirement is still included as deduction', () => {
      const items = evaluator['scenarioToPayItems'](makeScenario(), 'EMPLOYER_FUNDED');
      const retirement = items.find((i) => i.code === 'RETIREMENT_FUND');
      expect(retirement).toBeDefined();
      expect(retirement!.type).toBe('DEDUCTION');
    });

    it('EMPLOYER_FUNDED: total deductions in pay items = retirement only', () => {
      const scenario = makeScenario();
      const items = evaluator['scenarioToPayItems'](scenario, 'EMPLOYER_FUNDED');
      const totalDeductions = items
        .filter((i) => i.type === 'DEDUCTION')
        .reduce((sum, i) => sum + i.amount, 0);

      expect(totalDeductions).toBe(scenario.retirementContribution);
    });

    it('EMPLOYEE_PAID: total deductions = retirement + medical', () => {
      const scenario = makeScenario();
      const items = evaluator['scenarioToPayItems'](scenario, 'EMPLOYEE_PAID');
      const totalDeductions = items
        .filter((i) => i.type === 'DEDUCTION')
        .reduce((sum, i) => sum + i.amount, 0);

      expect(totalDeductions).toBe(
        scenario.retirementContribution + scenario.medicalAidEmployerContribution,
      );
    });
  });

  describe('assertPayItemContract — fail-fast guard', () => {
    it('throws if basicSalary > 0 but BASIC_SALARY pay item is missing', () => {
      const scenario = makeScenario({ basicSalary: 72000 });
      const itemsWithoutBasic = [
        { code: 'TRAVEL_ALLOWANCE', type: 'EARNING', amount: 14400, is_taxable: true, classification: 'ALLOWANCE_TAXABLE' },
      ];

      expect(() => {
        evaluator['assertPayItemContract'](scenario, itemsWithoutBasic);
      }).toThrow(/BASIC_SALARY/);
    });

    it('does not throw when basicSalary is 0 and no BASIC_SALARY item exists', () => {
      const scenario = makeScenario({ basicSalary: 0 });
      const items = [
        { code: 'TRAVEL_ALLOWANCE', type: 'EARNING', amount: 14400, is_taxable: true, classification: 'ALLOWANCE_TAXABLE' },
      ];

      expect(() => {
        evaluator['assertPayItemContract'](scenario, items);
      }).not.toThrow();
    });

    it('does not throw when basicSalary > 0 and BASIC_SALARY item exists', () => {
      const scenario = makeScenario({ basicSalary: 72000 });
      const items = evaluator['scenarioToPayItems'](scenario);

      expect(() => {
        evaluator['assertPayItemContract'](scenario, items);
      }).not.toThrow();
    });
  });
});
